import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RealtimeConnectionState, RealtimeEvent } from '../realtime.types';
import { RealtimeClient, type RealtimeClientDependencies } from '../realtimeClient';

const event: RealtimeEvent = {
  id: 'event-1',
  name: 'ticket.called',
  version: 1,
  occurredAt: '2026-08-08T00:00:00.000Z',
  scope: {
    organizationId: 'org-1',
    branchId: 'branch-1',
    queueId: 'queue-1',
    ticketId: 'ticket-1',
  },
  payload: { status: 'called', aheadCount: 0, estimatedWaitSeconds: 0 },
};

describe('RealtimeClient', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('shares one connection, delivers delayed events, and suppresses duplicates', async () => {
    const stream = controlledStream();
    const fetch = vi.fn().mockImplementation((_input, init) => {
      stream.captureSignal(init?.signal as AbortSignal | undefined);
      return Promise.resolve(stream.response);
    });
    const { client } = makeClient({ fetch });
    const first = vi.fn();
    const second = vi.fn();

    const releaseFirst = client.subscribe('/api/v1/realtime/tickets/ticket-1', {
      onEvent: first,
    });
    const releaseSecond = client.subscribe('/api/v1/realtime/tickets/ticket-1', {
      onEvent: second,
    });
    await waitForCondition(() => fetch.mock.calls.length === 1);

    stream.push(sse(event));
    stream.push(sse(event));
    await waitForCondition(() => first.mock.calls.length === 1 && second.mock.calls.length === 1);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
    releaseFirst();
    releaseSecond();
    expect(stream.signal?.aborted).toBe(true);
  });

  it('reconnects with Last-Event-ID after a stream closes', async () => {
    vi.useFakeTimers();
    try {
      const firstStream = controlledStream();
      const secondStream = controlledStream();
      const fetch = vi.fn().mockImplementationOnce((_input, init) => {
        firstStream.captureSignal(init?.signal as AbortSignal | undefined);
        return Promise.resolve(firstStream.response);
      });
      fetch.mockImplementationOnce((_input, init) => {
        secondStream.captureSignal(init?.signal as AbortSignal | undefined);
        return Promise.resolve(secondStream.response);
      });
      const { client } = makeClient({ fetch });
      const release = client.subscribe('/api/v1/realtime/tickets/ticket-1', {
        onEvent: vi.fn(),
      });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      firstStream.push(sse(event));
      firstStream.close();
      await flushPromises();

      await vi.advanceTimersByTimeAsync(10);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ 'Last-Event-ID': event.id });
      release();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes once after 401 and terminates the session if refresh fails', async () => {
    vi.useFakeTimers();
    try {
      let token = 'expired-token';
      const refreshSession = vi.fn().mockImplementation(async () => {
        token = 'new-token';
        return {} as never;
      });
      const activeStream = controlledStream();
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(activeStream.response);
      const { client } = makeClient({ fetch, getToken: () => token, refreshSession });
      const release = client.subscribe('/api/v1/realtime/tickets/ticket-1', {
        onEvent: vi.fn(),
      });

      await vi.waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
      await vi.runOnlyPendingTimersAsync();
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer new-token',
      });
      release();

      const terminateSession = vi.fn().mockResolvedValue(undefined);
      const failedRefreshClient = makeClient({
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        refreshSession: vi.fn().mockRejectedValue(new Error('expired')),
        terminateSession,
      }).client;
      failedRefreshClient.subscribe('/api/v1/realtime/tickets/ticket-2', { onEvent: vi.fn() });
      await vi.waitFor(() => expect(terminateSession).toHaveBeenCalledTimes(1));
      failedRefreshClient.closeAll();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses bounded backoff and keeps polling as the degraded fallback', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn().mockRejectedValue(new TypeError('SSE unavailable'));
      const states: RealtimeConnectionState[] = [];
      const { client } = makeClient({ fetch }, { maxReconnectAttempts: 2 });
      const release = client.subscribe('/api/v1/realtime/queues/queue-1', {
        onEvent: vi.fn(),
        onStateChange: (state) => states.push(state),
      });

      await flushPromises();
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();
      expect(states).toContain('degraded');
      expect(fetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(49);
      expect(fetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(fetch).toHaveBeenCalledTimes(3);
      release();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses on mobile lifecycle changes, resumes once, and cleans up on logout', async () => {
    const firstStream = controlledStream();
    const secondStream = controlledStream();
    const fetch = vi.fn().mockImplementationOnce((_input, init) => {
      firstStream.captureSignal(init?.signal as AbortSignal | undefined);
      return Promise.resolve(firstStream.response);
    });
    fetch.mockImplementationOnce((_input, init) => {
      secondStream.captureSignal(init?.signal as AbortSignal | undefined);
      return Promise.resolve(secondStream.response);
    });
    const states: RealtimeConnectionState[] = [];
    const { client } = makeClient({ fetch });
    client.subscribe('/api/v1/realtime/queues/queue-1', {
      onEvent: vi.fn(),
      onStateChange: (state) => states.push(state),
    });
    await waitForCondition(() => fetch.mock.calls.length === 1);

    client.pause();
    expect(firstStream.signal?.aborted).toBe(true);
    expect(states).toContain('paused');
    client.resume();
    await waitForCondition(() => fetch.mock.calls.length === 2);

    client.closeAll();
    expect(secondStream.signal?.aborted).toBe(true);
  });
});

function makeClient(
  overrides: Partial<RealtimeClientDependencies> = {},
  options: ConstructorParameters<typeof RealtimeClient>[1] = {}
) {
  const dependencies: RealtimeClientDependencies = {
    fetch: vi.fn(),
    getToken: () => 'access-token',
    refreshSession: vi.fn(),
    terminateSession: vi.fn().mockResolvedValue(undefined),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    ...overrides,
  };
  return {
    client: new RealtimeClient(dependencies, {
      reconnectBaseMs: 10,
      reconnectMaxMs: 20,
      degradedProbeMs: 50,
      maxReconnectAttempts: 3,
      ...options,
    }),
    dependencies,
  };
}

function controlledStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let signal: AbortSignal | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });
  const response = new Response(body, { status: 200 });
  return {
    response,
    get signal() {
      return signal;
    },
    captureSignal(nextSignal: AbortSignal | undefined) {
      signal = nextSignal;
    },
    push(value: string) {
      controller.enqueue(encoder.encode(value));
    },
    close() {
      controller.close();
    },
  };
}

function sse(value: RealtimeEvent): string {
  return `id: ${value.id}\nevent: ${value.name}\ndata: ${JSON.stringify(value)}\n\n`;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  await vi.waitFor(() => expect(condition()).toBe(true));
}
