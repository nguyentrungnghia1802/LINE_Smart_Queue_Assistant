import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { QueueOverview } from '../services/staff.api';
import { staffApi } from '../services/staff.api';

// ── Query keys ────────────────────────────────────────────────────────────────

export const staffKeys = {
  overview: (queueId: string) => ['staff', 'overview', queueId] as const,
};

// ── Query ─────────────────────────────────────────────────────────────────────

export function useStaffQueueOverview(queueId: string) {
  return useQuery({
    queryKey: staffKeys.overview(queueId),
    queryFn: () => staffApi.getQueueOverview(queueId),
    enabled: Boolean(queueId),
    refetchInterval: 10_000, // poll every 10 s for live updates
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function useInvalidateOverview(queueId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: staffKeys.overview(queueId) });
}

export function useCallNext(queueId: string) {
  const invalidate = useInvalidateOverview(queueId);
  return useMutation({
    mutationFn: () => staffApi.callNext(queueId),
    onSuccess: () => void invalidate(),
  });
}

export function useServeEntry(queueId: string) {
  const invalidate = useInvalidateOverview(queueId);
  return useMutation({
    mutationFn: (entryId: string) => staffApi.serve(entryId),
    onSuccess: () => void invalidate(),
  });
}

export function useCompleteEntry(queueId: string) {
  const invalidate = useInvalidateOverview(queueId);
  return useMutation({
    mutationFn: (entryId: string) => staffApi.complete(entryId),
    onSuccess: () => void invalidate(),
  });
}

export function useNoShowEntry(queueId: string) {
  const invalidate = useInvalidateOverview(queueId);
  return useMutation({
    mutationFn: (entryId: string) => staffApi.noShow(entryId),
    onSuccess: () => void invalidate(),
  });
}

export function useCancelEntry(queueId: string) {
  const invalidate = useInvalidateOverview(queueId);
  return useMutation({
    mutationFn: (entryId: string) => staffApi.cancel(entryId),
    onSuccess: () => void invalidate(),
  });
}

export type { QueueOverview };
