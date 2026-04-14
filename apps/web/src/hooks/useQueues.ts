import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Queue } from '@line-queue/shared';

import { queuesApi } from '../services/queues.api';

// ── Query keys ─────────────────────────────────────────────────────────────────
export const queuesKeys = {
  all: ['queues'] as const,
  list: () => [...queuesKeys.all, 'list'] as const,
  detail: (id: string) => [...queuesKeys.all, 'detail', id] as const,
};

// ── Queries ────────────────────────────────────────────────────────────────────

export function useQueues() {
  return useQuery({
    queryKey: queuesKeys.list(),
    queryFn: () => queuesApi.list(),
  });
}

export function useQueue(id: string) {
  return useQuery({
    queryKey: queuesKeys.detail(id),
    queryFn: () => queuesApi.getById(id),
    enabled: Boolean(id),
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useUpdateQueueStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Queue['status'] }) =>
      queuesApi.updateStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData<Queue>(queuesKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: queuesKeys.list() });
    },
  });
}

export function useDeleteQueue() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => queuesApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queuesKeys.detail(id) });
      qc.invalidateQueries({ queryKey: queuesKeys.list() });
    },
  });
}
