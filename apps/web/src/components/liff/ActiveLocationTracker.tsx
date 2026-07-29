import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { get, post } from '../../services/apiClient';

interface LocationConsent {
  enabled: boolean;
}

/**
 * Shares location only while the opted-in LINE customer has an active ticket.
 * No UI is rendered; consent remains controlled from booking and preferences.
 */
export function ActiveLocationTracker() {
  const lastSentAt = useRef(0);
  const activeTickets = useQuery<unknown[]>({
    queryKey: ['my-active-tickets'],
    queryFn: () => get('/api/v1/queue/me'),
    refetchInterval: 30_000,
  });
  const consent = useQuery<LocationConsent>({
    queryKey: ['line-location-consent'],
    queryFn: () => get('/api/v1/line/location-consent'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!consent.data?.enabled || !activeTickets.data?.length || !('geolocation' in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt.current < 60_000) return;
        lastSentAt.current = now;
        void post('/api/v1/line/location-snapshot', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        }).catch(() => {
          lastSentAt.current = 0;
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTickets.data?.length, consent.data?.enabled]);

  return null;
}
