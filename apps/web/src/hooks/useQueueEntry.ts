import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queueEntryApi } from '../services/queueEntry.api';
import type { JoinQueueInput } from '../types';

// ── Query keys ─────────────────────────────────────────────────────────────────

export const queueEntryKeys = {
  all: ['queueEntry'] as const,
  myTickets: () => [...queueEntryKeys.all, 'me'] as const,
  detail: (entryId: string) => [...queueEntryKeys.all, 'entry', entryId] as const,
  status: (queueId: string) => [...queueEntryKeys.all, 'status', queueId] as const,
  current: (queueId: string) => [...queueEntryKeys.all, 'current', queueId] as const,
};

// ── Queries ────────────────────────────────────────────────────────────────────

/** Active tickets for the current caller across all queues. */
export function useMyTickets(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queueEntryKeys.myTickets(),
    queryFn: () => queueEntryApi.myTickets(),
    enabled: options.enabled ?? true,
    // Re-fetch every 30 s for live position updates
    refetchInterval: 30_000,
  });
}

/** Live status of a specific queue (by path param). Auto-refreshes every 30 s. */
export function useQueueStatus(queueId: string) {
  return useQuery({
    queryKey: queueEntryKeys.status(queueId),
    queryFn: () => queueEntryApi.getStatus(queueId),
    enabled: Boolean(queueId),
    refetchInterval: 30_000,
  });
}

/** Live status for one ticket by entry ID. Used by LIFF notification deep links. */
export function useTicketStatus(entryId: string) {
  return useQuery({
    queryKey: queueEntryKeys.detail(entryId),
    queryFn: () => queueEntryApi.getEntry(entryId),
    enabled: Boolean(entryId),
    refetchInterval: 15_000,
  });
}

/** Live status of a specific queue (by query param — same data, different URL). */
export function useCurrentQueue(queueId: string) {
  return useQuery({
    queryKey: queueEntryKeys.current(queueId),
    queryFn: () => queueEntryApi.getCurrent(queueId),
    enabled: Boolean(queueId),
    refetchInterval: 30_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/** Join a queue. Invalidates the myTickets list on success. */
export function useJoinQueue() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: JoinQueueInput) => queueEntryApi.join(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queueEntryKeys.myTickets() });
    },
  });
}
