import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RealtimeConnectionState, RealtimeEvent } from '../../services/realtime';
import { useQueueRealtime, useTicketRealtime } from '../useRealtime';

const realtime = vi.hoisted(() => ({
  subscribe: vi.fn(),
  subscriber: null as null | {
    onEvent: (event: RealtimeEvent) => void;
    onStateChange?: (state: RealtimeConnectionState) => void;
  },
  release: vi.fn(),
}));

vi.mock('../../services/realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/realtime')>();
  return {
    ...original,
    realtimeClient: {
      subscribe: realtime.subscribe,
    },
  };
});

const event: RealtimeEvent = {
  id: 'event-1',
  name: 'queue.summary_updated',
  version: 1,
  occurredAt: '2026-08-08T00:00:00.000Z',
  scope: { organizationId: 'org-1', branchId: 'branch-1', queueId: 'queue-1' },
  payload: { aheadCount: 2, estimatedWaitSeconds: 600 },
};

describe('realtime query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.subscriber = null;
    realtime.subscribe.mockImplementation((_endpoint, subscriber) => {
      realtime.subscriber = subscriber;
      subscriber.onStateChange?.('connecting');
      return realtime.release;
    });
  });

  it('reconciles customer REST state on connect and every delayed ticket event', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const view = render(<TicketProbe />, { wrapper: wrapper(queryClient) });

    expect(realtime.subscribe).toHaveBeenCalledWith(
      '/api/v1/realtime/tickets/ticket-1',
      expect.any(Object)
    );
    act(() => realtime.subscriber?.onStateChange?.('connected'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queueEntry', 'entry', 'ticket-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queueEntry', 'me'] });

    invalidate.mockClear();
    act(() => realtime.subscriber?.onEvent(event));
    expect(invalidate).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(realtime.release).toHaveBeenCalledTimes(1);
  });

  it('invalidates the staff REST workspace and skips disabled subscriptions', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const view = render(<QueueProbe enabled />, { wrapper: wrapper(queryClient) });

    expect(realtime.subscribe).toHaveBeenCalledWith(
      '/api/v1/realtime/queues/queue-1',
      expect.any(Object)
    );
    act(() => realtime.subscriber?.onEvent(event));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-my-queue', 'org-1'] });

    view.rerender(<QueueProbe enabled={false} />);
    expect(realtime.release).toHaveBeenCalledTimes(1);
  });
});

function TicketProbe() {
  useTicketRealtime(
    'ticket-1',
    [
      ['queueEntry', 'entry', 'ticket-1'],
      ['queueEntry', 'me'],
    ],
    true
  );
  return null;
}

function QueueProbe({ enabled }: { enabled: boolean }) {
  useQueueRealtime('queue-1', [['staff-my-queue', 'org-1']], enabled);
  return null;
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
