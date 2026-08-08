import {
  type Context,
  context,
  propagation,
  type Span,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

const tracer = trace.getTracer('line-smart-queue');

export type TraceCarrier = Record<string, string>;

export function currentTraceFields(): { traceId?: string; spanId?: string } {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext?.traceId || /^0+$/.test(spanContext.traceId)) return {};
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

export function injectTraceContext(): TraceCarrier | undefined {
  const carrier: TraceCarrier = {};
  propagation.inject(context.active(), carrier);
  return Object.keys(carrier).length > 0 ? carrier : undefined;
}

export function extractTraceContext(carrier?: TraceCarrier): Context {
  return carrier ? propagation.extract(context.active(), carrier) : context.active();
}

export async function withSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
  options: { parent?: Context; attributes?: Record<string, string | number | boolean> } = {}
): Promise<T> {
  const parent = options.parent ?? context.active();
  return tracer.startActiveSpan(name, { attributes: options.attributes }, parent, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
      });
      if (error instanceof Error) span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
