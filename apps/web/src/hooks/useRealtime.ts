import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  realtimeClient,
  type RealtimeConnectionState,
  type RealtimeEvent,
} from '../services/realtime';

interface RealtimeSubscriptionOptions {
  enabled?: boolean;
  onEvent: (event: RealtimeEvent) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

export function useRealtimeSubscription(
  endpoint: string,
  options: RealtimeSubscriptionOptions
): RealtimeConnectionState {
  const [state, setState] = useState<RealtimeConnectionState>('idle');
  const onEventRef = useRef(options.onEvent);
  const onStateChangeRef = useRef(options.onStateChange);
  onEventRef.current = options.onEvent;
  onStateChangeRef.current = options.onStateChange;

  useEffect(() => {
    if (!endpoint || options.enabled === false) {
      setState('idle');
      return;
    }
    return realtimeClient.subscribe(endpoint, {
      onEvent: (event) => onEventRef.current(event),
      onStateChange: (nextState) => {
        setState(nextState);
        onStateChangeRef.current?.(nextState);
      },
    });
  }, [endpoint, options.enabled]);

  return state;
}

export function useTicketRealtime(
  entryId: string,
  queryKeys: QueryKey[],
  enabled = true
): RealtimeConnectionState {
  return useRealtimeQueryInvalidation(
    entryId ? `/api/v1/realtime/tickets/${encodeURIComponent(entryId)}` : '',
    queryKeys,
    enabled
  );
}

export function useQueueRealtime(
  queueId: string,
  queryKeys: QueryKey[],
  enabled = true
): RealtimeConnectionState {
  return useRealtimeQueryInvalidation(
    queueId ? `/api/v1/realtime/queues/${encodeURIComponent(queueId)}` : '',
    queryKeys,
    enabled
  );
}

function useRealtimeQueryInvalidation(
  endpoint: string,
  queryKeys: QueryKey[],
  enabled: boolean
): RealtimeConnectionState {
  const queryClient = useQueryClient();
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  const reconcile = () => {
    for (const queryKey of queryKeysRef.current) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return useRealtimeSubscription(endpoint, {
    enabled,
    onEvent: reconcile,
    onStateChange: (state) => {
      if (state === 'connected') reconcile();
    },
  });
}
