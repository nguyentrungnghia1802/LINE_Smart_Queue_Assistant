import { randomUUID } from 'node:crypto';

import { config, type LogMonitoringConfiguration } from '../../config';
import { currentRequestId } from '../../observability/correlation';
import { sanitizeTelemetryValue } from '../../observability/sanitization';
import { currentTraceFields } from '../../observability/tracing';

export type LogMonitoringLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type LogSubmissionOutcome =
  | 'QUEUED_LOCALLY'
  | 'ACCEPTED_BY_SERVER_ADMISSION'
  | 'REJECTED_LOCAL_QUEUE'
  | 'REJECTED_SERVER'
  | 'RETRY_EXHAUSTED'
  | 'DROPPED_BY_POLICY';

export interface LogMonitoringException {
  type: string;
  message: string;
  stackTrace: string;
}

export interface LogMonitoringEventInput {
  level: LogMonitoringLevel;
  eventType: string;
  message: string;
  traceId?: string;
  requestId?: string;
  exception?: unknown;
  context?: Record<string, unknown>;
  tags?: Record<string, unknown>;
}

export interface LogMonitoringEvent extends Omit<LogMonitoringEventInput, 'exception'> {
  eventId: string;
  timestamp: string;
  service: string;
  environment: string;
  exception?: LogMonitoringException;
  context: Record<string, unknown>;
  tags: Record<string, unknown>;
}

export interface LogSubmissionResult {
  eventId: string;
  outcome: LogSubmissionOutcome;
  httpStatus: number;
  serverRequestId?: string;
  errorCode?: string;
  message: string;
}

export interface LogMonitoringClientOptions extends LogMonitoringConfiguration {
  fetchImpl?: typeof fetch;
  resultListener?: (result: LogSubmissionResult) => void;
}

const BATCH_PATH = '/api/v1/ingest/logs/batch';

/**
 * Small Node 20 adapter for the platform's batch ingestion contract.
 *
 * The adapter is intentionally bounded and best-effort: business operations
 * never await network delivery, 202 means only server queue admission, and
 * monitoring failure cannot fail the queue/payment/LINE business path.
 */
export class LogMonitoringClient {
  private readonly options: LogMonitoringClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly resultListener?: (result: LogSubmissionResult) => void;
  private readonly queue: LogMonitoringEvent[] = [];
  private pendingEvents = 0;
  private processing = false;
  private accepting: boolean;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private closePromise: Promise<void> | undefined;

  constructor(options: LogMonitoringClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.resultListener = options.resultListener;
    this.accepting = options.enabled;
  }

  get isEnabled(): boolean {
    return this.options.enabled;
  }

  get queuedEventCount(): number {
    return Math.max(0, this.pendingEvents);
  }

  log(
    eventType: string,
    message: string,
    context: Record<string, unknown> = {},
    correlation: Pick<LogMonitoringEventInput, 'traceId' | 'requestId'> = {}
  ): boolean {
    return (
      this.submit({ level: 'INFO', eventType, message, context, ...correlation }).outcome ===
      'QUEUED_LOCALLY'
    );
  }

  error(
    eventType: string,
    message: string,
    exception?: unknown,
    context: Record<string, unknown> = {},
    correlation: Pick<LogMonitoringEventInput, 'traceId' | 'requestId'> = {}
  ): boolean {
    return (
      this.submit({
        level: 'ERROR',
        eventType,
        message,
        exception,
        context,
        ...correlation,
      }).outcome === 'QUEUED_LOCALLY'
    );
  }

  submit(input: LogMonitoringEventInput): LogSubmissionResult {
    const event = this.normalize(input);
    if (!this.accepting) {
      return this.publish({
        eventId: event.eventId,
        outcome: 'DROPPED_BY_POLICY',
        httpStatus: 0,
        errorCode: 'CLIENT_DISABLED',
        message: 'Log monitoring is disabled or closed',
      });
    }

    if (this.pendingEvents >= this.options.queueCapacity) {
      return this.publish({
        eventId: event.eventId,
        outcome: 'REJECTED_LOCAL_QUEUE',
        httpStatus: 0,
        errorCode: 'LOCAL_QUEUE_FULL',
        message: 'The bounded monitoring queue is full',
      });
    }

    this.queue.push(event);
    this.pendingEvents += 1;
    const result = this.publish({
      eventId: event.eventId,
      outcome: 'QUEUED_LOCALLY',
      httpStatus: 0,
      message: 'Queued locally; server admission is pending',
    });

    if (this.queue.length >= this.options.batchSize) {
      this.clearFlushTimer();
      void this.processQueue();
    } else {
      this.scheduleFlush();
    }
    return result;
  }

  async flush(timeoutMs = this.options.flushTimeoutMs): Promise<boolean> {
    if (!this.options.enabled) return true;
    this.clearFlushTimer();
    if (!this.processing && this.queue.length > 0) void this.processQueue();

    const deadline = Date.now() + timeoutMs;
    while (this.pendingEvents > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        this.dropQueued('FLUSH_TIMEOUT', 'Monitoring flush timeout dropped queued events');
        return false;
      }
      await sleep(Math.min(25, remainingMs));
      if (!this.processing && this.queue.length > 0) void this.processQueue();
    }
    return true;
  }

  async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.accepting = false;
    this.clearFlushTimer();
    this.closePromise = (async () => {
      const flushed = await this.flush(this.options.flushTimeoutMs);
      if (!flushed) this.dropQueued('CLIENT_CLOSE_TIMEOUT', 'Monitoring close timeout');
    })();
    return this.closePromise;
  }

  private normalize(input: LogMonitoringEventInput): LogMonitoringEvent {
    const requestId = input.requestId ?? currentRequestId() ?? randomUUID();
    const traceId = input.traceId ?? currentTraceFields().traceId ?? requestId;
    const exception = normalizeException(
      input.exception,
      this.options.maxExceptionMessageLength,
      this.options.maxStackTraceLength
    );

    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      level: input.level,
      service: this.options.service,
      environment: this.options.environment,
      eventType: boundText(input.eventType, 128),
      message: boundText(safeText(input.message), this.options.maxMessageLength),
      traceId: boundText(safeText(traceId), 128),
      requestId: boundText(safeText(requestId), 128),
      ...(exception ? { exception } : {}),
      context: boundRecord(
        input.context,
        this.options.maxContextEntries,
        this.options.maxContextKeyLength,
        this.options.maxContextValueLength
      ),
      tags: {
        ...boundRecord(
          input.tags,
          this.options.maxTagEntries,
          this.options.maxContextKeyLength,
          this.options.maxContextValueLength
        ),
        source: 'line-smart-queue',
        release: this.options.release,
      },
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.processing || this.queue.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.processQueue();
    }, this.options.maxWaitMs);
    this.flushTimer.unref?.();
  }

  private clearFlushTimer(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this.options.enabled) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.options.batchSize);
        const result = await this.sendBatchWithRetry(batch);
        for (const event of batch) {
          this.publish({
            eventId: event.eventId,
            outcome: result.outcome,
            httpStatus: result.httpStatus,
            ...(result.serverRequestId ? { serverRequestId: result.serverRequestId } : {}),
            ...(result.errorCode ? { errorCode: result.errorCode } : {}),
            message: result.message,
          });
          this.pendingEvents = Math.max(0, this.pendingEvents - 1);
        }
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) this.scheduleFlush();
    }
  }

  private async sendBatchWithRetry(batch: LogMonitoringEvent[]): Promise<BatchResult> {
    const body = JSON.stringify({ events: batch });
    let backoffMs = this.options.backoffMs;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        const response = await this.send(body);
        const serverRequestId = await readServerRequestId(response);
        if (response.status === 202) {
          return {
            outcome: 'ACCEPTED_BY_SERVER_ADMISSION',
            httpStatus: response.status,
            serverRequestId,
            message:
              'Server admitted the batch to its bounded in-memory queue; persistence is asynchronous',
          };
        }

        const retryable = isRetryableStatus(response.status);
        if (!retryable) {
          return {
            outcome: 'REJECTED_SERVER',
            httpStatus: response.status,
            errorCode: 'SERVER_REJECTED',
            message: 'The monitoring server rejected the batch',
          };
        }
        if (attempt === this.options.maxRetries) {
          return {
            outcome: 'RETRY_EXHAUSTED',
            httpStatus: response.status,
            errorCode: 'RETRY_EXHAUSTED',
            message: 'The monitoring batch failed after bounded retries',
          };
        }
        await sleep(this.retryDelay(response.headers.get('retry-after'), backoffMs));
        backoffMs = Math.min(this.options.maxBackoffMs, Math.max(backoffMs * 2, backoffMs));
      } catch {
        if (attempt === this.options.maxRetries) {
          return {
            outcome: 'RETRY_EXHAUSTED',
            httpStatus: 0,
            errorCode: 'TRANSPORT_RETRY_EXHAUSTED',
            message: 'The monitoring batch failed after bounded transport retries',
          };
        }
        await sleep(this.retryDelay(undefined, backoffMs));
        backoffMs = Math.min(this.options.maxBackoffMs, Math.max(backoffMs * 2, backoffMs));
      }
    }

    return {
      outcome: 'RETRY_EXHAUSTED',
      httpStatus: 0,
      errorCode: 'RETRY_EXHAUSTED',
      message: 'The monitoring batch failed after bounded retries',
    };
  }

  private async send(body: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);
    try {
      return await this.fetchImpl(`${this.options.endpoint.replace(/\/+$/, '')}${BATCH_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.options.apiKey,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private retryDelay(retryAfter: string | null | undefined, backoffMs: number): number {
    const retryAfterMs = parseRetryAfter(retryAfter, this.options.maxRetryAfterMs);
    const base = retryAfterMs ?? backoffMs;
    const jitter =
      this.options.jitterMs > 0 ? Math.floor(Math.random() * this.options.jitterMs) : 0;
    return Math.min(this.options.maxRetryAfterMs, base + jitter);
  }

  private dropQueued(errorCode: string, message: string): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (!event) continue;
      this.publish({
        eventId: event.eventId,
        outcome: 'DROPPED_BY_POLICY',
        httpStatus: 0,
        errorCode,
        message,
      });
      this.pendingEvents = Math.max(0, this.pendingEvents - 1);
    }
  }

  private publish(result: LogSubmissionResult): LogSubmissionResult {
    try {
      this.resultListener?.(result);
    } catch {
      // A monitoring callback must never stop the application path.
    }
    return result;
  }
}

interface BatchResult {
  outcome: Exclude<
    LogSubmissionOutcome,
    'QUEUED_LOCALLY' | 'REJECTED_LOCAL_QUEUE' | 'DROPPED_BY_POLICY'
  >;
  httpStatus: number;
  serverRequestId?: string;
  errorCode?: string;
  message: string;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null | undefined, maxMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(maxMs, seconds * 1_000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.min(maxMs, Math.max(0, dateMs - Date.now()));
  return undefined;
}

async function readServerRequestId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.text()) as unknown;
    const parsed = JSON.parse(String(body)) as {
      requestId?: unknown;
      meta?: { requestId?: unknown };
    };
    if (typeof parsed.requestId === 'string') return parsed.requestId.slice(0, 128);
    if (typeof parsed.meta?.requestId === 'string') return parsed.meta.requestId.slice(0, 128);
  } catch {
    // A response body is diagnostic-only; status is the authoritative result.
  }
  return undefined;
}

function normalizeException(
  value: unknown,
  maxMessageLength: number,
  maxStackTraceLength: number
): LogMonitoringException | undefined {
  if (value === undefined || value === null) return undefined;
  const error = value instanceof Error ? value : undefined;
  const safeValue = sanitizeTelemetryValue(value);
  const candidate =
    typeof safeValue === 'object' && safeValue !== null
      ? (safeValue as { name?: unknown; message?: unknown; stack?: unknown })
      : undefined;
  return {
    type: boundText(safeText(error?.name ?? candidate?.name ?? 'Error'), 128),
    message: boundText(safeText(error?.message ?? candidate?.message ?? value), maxMessageLength),
    stackTrace: boundText(safeText(error?.stack ?? candidate?.stack ?? ''), maxStackTraceLength),
  };
}

function boundRecord(
  value: Record<string, unknown> | undefined,
  maxEntries: number,
  maxKeyLength: number,
  maxValueLength: number
): Record<string, unknown> {
  if (!value) return {};
  const result: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, maxEntries)) {
    const boundedKey = boundText(key, maxKeyLength);
    const safeValue = sanitizeTelemetryValue(rawValue, key);
    result[boundedKey] =
      typeof safeValue === 'string' ? boundText(safeValue, maxValueLength) : safeValue;
  }
  return result;
}

function safeText(value: unknown): string {
  const sanitized = sanitizeTelemetryValue(value);
  if (typeof sanitized === 'string') return sanitized;
  try {
    return JSON.stringify(sanitized) ?? String(sanitized);
  } catch {
    return String(sanitized);
  }
}

function boundText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 15) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 15)}... [truncated]`;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const disabledLogMonitoringOptions: LogMonitoringClientOptions = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  service: 'line-smart-queue-api',
  environment: 'test',
  release: 'test',
  queueCapacity: 1,
  batchSize: 1,
  maxWaitMs: 1,
  maxRetries: 1,
  backoffMs: 1,
  maxBackoffMs: 1,
  jitterMs: 1,
  maxRetryAfterMs: 1,
  requestTimeoutMs: 1,
  flushTimeoutMs: 1,
  maxMessageLength: 1,
  maxExceptionMessageLength: 1,
  maxStackTraceLength: 1,
  maxContextEntries: 1,
  maxTagEntries: 1,
  maxContextKeyLength: 1,
  maxContextValueLength: 1,
  slowQueryThresholdMs: 1,
};

export const logMonitoringClient = new LogMonitoringClient(
  config.logMonitoring ?? disabledLogMonitoringOptions
);
