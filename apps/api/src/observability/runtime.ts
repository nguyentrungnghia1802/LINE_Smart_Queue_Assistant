import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, tracing } from '@opentelemetry/sdk-node';
import * as Sentry from '@sentry/node';

import { config } from '../config';

import { sanitizeSentryEvent, sanitizeTelemetryValue } from './sanitization';

export type RuntimeRole = 'api' | 'worker';

interface RuntimeState {
  sdk?: NodeSDK;
  sentryEnabled: boolean;
  initialized: boolean;
}

const state: RuntimeState = { sentryEnabled: false, initialized: false };

function serviceName(role: RuntimeRole): string {
  return role === 'worker' && config.observability.serviceName.endsWith('-api')
    ? config.observability.serviceName.replace(/-api$/, '-worker')
    : config.observability.serviceName;
}

export function initializeObservability(role: RuntimeRole): void {
  if (state.initialized) return;
  state.initialized = true;

  if (config.observability.sentry.dsn) {
    try {
      Sentry.init({
        dsn: config.observability.sentry.dsn,
        environment: config.observability.environment,
        release: config.observability.release || undefined,
        sendDefaultPii: false,
        skipOpenTelemetrySetup: true,
        integrations: [],
        beforeSend: (event) => sanitizeSentryEvent(event),
      });
      Sentry.setTag('runtime.role', role);
      state.sentryEnabled = true;
    } catch {
      state.sentryEnabled = false;
    }
  }

  if (!config.observability.otel.enabled) return;

  try {
    state.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': serviceName(role),
        'service.version': config.observability.release || 'development',
        'deployment.environment.name': config.observability.environment,
        'service.instance.role': role,
      }),
      traceExporter: new OTLPTraceExporter({ url: config.observability.otel.endpoint }),
      sampler: new tracing.ParentBasedSampler({
        root: new tracing.TraceIdRatioBasedSampler(config.observability.otel.sampleRatio),
      }),
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) =>
            request.url === '/health' || request.url === '/ready' || request.url === '/metrics',
          redactedQueryParams: ['token', 'code', 'state', 'signature'],
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({ enhancedDatabaseReporting: false }),
        new IORedisInstrumentation(),
        new UndiciInstrumentation(),
      ],
    });
    state.sdk.start();
  } catch {
    state.sdk = undefined;
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!state.sentryEnabled) return;
  try {
    Sentry.withScope((scope) => {
      if (context)
        scope.setContext('application', sanitizeTelemetryValue(context) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } catch {
    // Error reporting must never affect the application path.
  }
}

export async function shutdownObservability(timeoutMs = 2_000): Promise<void> {
  const operations: Promise<unknown>[] = [];
  if (state.sdk) operations.push(state.sdk.shutdown().catch(() => undefined));
  if (state.sentryEnabled) operations.push(Sentry.flush(timeoutMs).catch(() => false));
  await Promise.all(operations);
}

export function resetObservabilityForTests(): void {
  state.sdk = undefined;
  state.sentryEnabled = false;
  state.initialized = false;
}
