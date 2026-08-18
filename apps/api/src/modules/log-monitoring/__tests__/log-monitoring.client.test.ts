import { jest } from '@jest/globals';

import { runWithRequestId } from '../../../observability/correlation';
import {
  LogMonitoringClient,
  type LogMonitoringClientOptions,
  type LogSubmissionResult,
} from '../log-monitoring.client';

function response(status: number, body = '{}', headers: Record<string, string> = {}): Response {
  return {
    status,
    headers: new Headers(headers),
    text: async () => body,
  } as unknown as Response;
}

function options(fetchImpl: typeof fetch): LogMonitoringClientOptions {
  return {
    enabled: true,
    endpoint: 'http://monitoring.test',
    apiKey: 'lm_live_test_secret',
    service: 'line-smart-queue-api',
    environment: 'test',
    release: 'test-release',
    queueCapacity: 2,
    batchSize: 2,
    maxWaitMs: 10_000,
    maxRetries: 2,
    backoffMs: 0,
    maxBackoffMs: 100,
    jitterMs: 0,
    maxRetryAfterMs: 100,
    requestTimeoutMs: 100,
    flushTimeoutMs: 500,
    maxMessageLength: 32,
    maxExceptionMessageLength: 24,
    maxStackTraceLength: 32,
    maxContextEntries: 2,
    maxTagEntries: 2,
    maxContextKeyLength: 16,
    maxContextValueLength: 20,
    slowQueryThresholdMs: 10,
    fetchImpl,
  };
}

describe('LogMonitoringClient', () => {
  it('is a network-free no-op when disabled', async () => {
    const fetchImpl = jest.fn<typeof fetch>();
    const client = new LogMonitoringClient({ ...options(fetchImpl), enabled: false });

    const result = client.submit({
      level: 'ERROR',
      eventType: 'AUTH_LOGIN_FAILED',
      message: 'Login failed',
      exception: new Error('not sent'),
    });
    await client.close();

    expect(result.outcome).toBe('DROPPED_BY_POLICY');
    expect(result.errorCode).toBe('CLIENT_DISABLED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('batches events, propagates correlation, and redacts sensitive context', async () => {
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValue(response(202, JSON.stringify({ requestId: 'monitoring-request-1' })));
    const results: LogSubmissionResult[] = [];
    const client = new LogMonitoringClient({
      ...options(fetchImpl),
      batchSize: 3,
      queueCapacity: 3,
      maxContextEntries: 3,
      resultListener: (result) => results.push(result),
    });

    await runWithRequestId('request-123', async () => {
      client.error('LINE_PUSH_FAILED', 'Outbound LINE push failed', new Error('provider failed'), {
        queueId: 'queue-1',
        lineUserId: 'U-secret',
        apiKey: 'secret-value',
      });
      client.log('QUEUE_CREATE_FAILED', 'Queue create failed', { branchId: 'branch-1' });
      client.submit({
        level: 'WARN',
        eventType: 'QUEUE_TRANSITION_CONFLICT',
        message: 'Queue transition conflict',
        tags: { source: 'caller-override', release: 'caller-override' },
      });
      await client.flush();
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      events: Array<Record<string, unknown>>;
    };
    expect(request?.headers).toMatchObject({ 'X-API-Key': 'lm_live_test_secret' });
    expect(body.events).toHaveLength(3);
    expect(body.events[0]).toMatchObject({
      requestId: 'request-123',
      traceId: 'request-123',
      service: 'line-smart-queue-api',
      environment: 'test',
    });
    expect((body.events[0]?.context as Record<string, unknown>).lineUserId).toBe('[REDACTED]');
    expect((body.events[0]?.context as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect(body.events[2]?.tags).toMatchObject({
      source: 'line-smart-queue',
      release: 'test-release',
    });
    expect(results.map((result) => result.outcome)).toEqual([
      'QUEUED_LOCALLY',
      'QUEUED_LOCALLY',
      'QUEUED_LOCALLY',
      'ACCEPTED_BY_SERVER_ADMISSION',
      'ACCEPTED_BY_SERVER_ADMISSION',
      'ACCEPTED_BY_SERVER_ADMISSION',
    ]);
    expect(results[3]?.serverRequestId).toBe('monitoring-request-1');
  });

  it('retries 503 with a bounded Retry-After delay before accepting', async () => {
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(503, '{}', { 'retry-after': '0' }))
      .mockResolvedValueOnce(response(202));
    const client = new LogMonitoringClient({ ...options(fetchImpl), batchSize: 1 });

    client.log('DATABASE_QUERY_SLOW', 'Database query was slow');
    await expect(client.flush()).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects local overflow and bounds event payloads before queueing', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(response(202));
    const client = new LogMonitoringClient({
      ...options(fetchImpl),
      batchSize: 10,
      queueCapacity: 1,
    });

    const first = client.submit({
      level: 'ERROR',
      eventType: 'QUEUE_CREATE_FAILED',
      message: 'A'.repeat(100),
      context: { first: 'B'.repeat(100), second: 'C'.repeat(100), third: 'dropped' },
    });
    const overflow = client.submit({ level: 'ERROR', eventType: 'OVERFLOW', message: 'full' });

    expect(first.outcome).toBe('QUEUED_LOCALLY');
    expect(overflow.outcome).toBe('REJECTED_LOCAL_QUEUE');
    await expect(client.flush()).resolves.toBe(true);

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      events: Array<{ message: string; context: Record<string, unknown> }>;
    };
    expect(body.events[0]?.message).toContain('[truncated]');
    expect(Object.keys(body.events[0]?.context ?? {})).toEqual(['first', 'second']);
  });
});
