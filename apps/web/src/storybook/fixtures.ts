import { QueueStatus, type QueueSummary, type TicketStatus } from '@line-queue/shared';

import type { LiffContext } from '../types/liff';
import type { TicketPositionResult } from '../types/queue-entry';

export const queueFixtures: Record<string, QueueSummary> = {
  active: {
    id: 'queue-salon',
    name: 'Salon reception',
    description: 'Haircut, color, and head spa services.',
    status: QueueStatus.ACTIVE,
    currentNumber: 18,
    waitingCount: 4,
    calledCount: 1,
    servingCount: 1,
    maxCapacity: 40,
    avgServiceTimeMinutes: 20,
    organizationId: 'org-demo',
    branchId: 'branch-tokyo',
    ticketPrefix: 'A',
    productIds: ['product-cut', 'product-color'],
    createdAt: new Date('2026-08-01T09:00:00+09:00'),
    updatedAt: new Date('2026-08-09T10:30:00+09:00'),
  },
  paused: {
    id: 'queue-clinic',
    name: 'Clinic reception',
    description: 'Reception is temporarily paused.',
    status: QueueStatus.PAUSED,
    currentNumber: 7,
    waitingCount: 0,
    calledCount: 0,
    servingCount: 0,
    maxCapacity: 20,
    avgServiceTimeMinutes: 30,
    organizationId: 'org-demo',
    branchId: 'branch-tokyo',
    ticketPrefix: 'B',
    productIds: ['product-consultation'],
    createdAt: new Date('2026-08-01T09:00:00+09:00'),
    updatedAt: new Date('2026-08-09T10:30:00+09:00'),
  },
};

function ticketStatus(status: string): TicketStatus {
  return status as unknown as TicketStatus;
}

export const ticketFixtures: Record<string, TicketPositionResult> = {
  waiting: {
    entry: {
      id: 'entry-waiting',
      queue_id: 'queue-salon',
      user_id: 'user-demo',
      order_id: 'order-demo',
      line_user_id: 'U-demo',
      ticket_number: 19,
      ticket_code: 'A019',
      status: ticketStatus('waiting'),
      priority: 0,
      position_snapshot: 5,
      estimated_wait_seconds: 1200,
      called_at: null,
      serving_started_at: null,
      served_at: null,
      skipped_at: null,
      cancelled_at: null,
      no_show_at: null,
      created_at: '2026-08-09T10:20:00+09:00',
      updated_at: '2026-08-09T10:30:00+09:00',
    },
    order: null,
    aheadCount: 4,
    estimatedWaitSeconds: 1200,
  },
  called: {
    entry: {
      id: 'entry-called',
      queue_id: 'queue-salon',
      user_id: 'user-demo',
      order_id: 'order-demo',
      line_user_id: 'U-demo',
      ticket_number: 20,
      ticket_code: 'A020',
      status: ticketStatus('called'),
      priority: 0,
      position_snapshot: 0,
      estimated_wait_seconds: 0,
      called_at: '2026-08-09T10:31:00+09:00',
      serving_started_at: null,
      served_at: null,
      skipped_at: null,
      cancelled_at: null,
      no_show_at: null,
      created_at: '2026-08-09T10:00:00+09:00',
      updated_at: '2026-08-09T10:31:00+09:00',
    },
    order: null,
    aheadCount: 0,
    estimatedWaitSeconds: 0,
  },
};

export function friendshipContext(status: LiffContext['friendshipStatus']): LiffContext {
  return {
    initStatus: 'ready',
    authStatus: 'authenticated',
    friendshipStatus: status,
    isInitialized: true,
    isLoggedIn: true,
    isInClient: true,
    profile: { userId: 'U-demo', displayName: 'Demo Customer' },
    accessToken: 'storybook-access-token',
    idToken: 'storybook-id-token',
    error: null,
    authError: null,
    login: () => undefined,
    logout: async () => undefined,
    refreshFriendship: async () => status === 'friend',
    requestFriendship: async () => false,
    scanQrCode: async () => null,
  };
}
