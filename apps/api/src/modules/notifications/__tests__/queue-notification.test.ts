/**
 * Unit tests for queue-notification.service.ts
 *
 * Phase 5 behaviour: this service only writes durable outbox records. It must
 * not call LINE directly; delivery is handled by notificationDelivery.job.ts
 * after the business transaction commits.
 */

import type { PoolClient } from 'pg';

import type { QueueEntryRow } from '../../../db/repositories/queue-entries.repository';
import type { NotificationOutboxRepository } from '../notification-outbox.repository';
import { ETA_WARNING_THRESHOLD, queueNotificationService } from '../queue-notification.service';

function makeEntry(override: Partial<QueueEntryRow> = {}): QueueEntryRow {
  return {
    id: 'entry-001',
    queue_id: 'queue-001',
    user_id: 'user-001',
    order_id: null,
    line_user_id: 'U_test_001',
    ticket_number: 5,
    ticket_code: 'A005',
    status: 'waiting',
    priority: 0,
    position_snapshot: null,
    called_at: null,
    serving_started_at: null,
    served_at: null,
    skipped_at: null,
    cancelled_at: null,
    no_show_at: null,
    estimated_wait_seconds: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    ...override,
  };
}

function makeRepository() {
  return {
    enqueue: jest.fn().mockResolvedValue({ id: 'notification-001' }),
    cancelPendingForEntry: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationOutboxRepository>;
}

const client = { query: jest.fn() } as unknown as PoolClient;

describe('queueNotificationService durable outbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues booking-created with a stable event key and ticket payload', async () => {
    const repository = makeRepository();
    const entry = makeEntry();

    await queueNotificationService.notifyBookingCreated(
      entry,
      { organizationId: 'org-001', aheadCount: 2, estimatedWaitSeconds: 600 },
      repository,
      client
    );

    expect(repository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-001',
        queueEntryId: 'entry-001',
        userId: 'user-001',
        lineUserId: 'U_test_001',
        eventType: 'booking_created',
        eventKey: 'queue_entry:entry-001:booking_created',
        payload: {
          ticketCode: 'A005',
          aheadCount: 2,
          estimatedWaitSeconds: 600,
        },
      }),
      client
    );
  });

  it('does not enqueue when the entry has no LINE user ID', async () => {
    const repository = makeRepository();
    await queueNotificationService.notifyTicketCalled(
      makeEntry({ line_user_id: null }),
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.enqueue).not.toHaveBeenCalled();
  });

  it('delegates duplicate protection to the unique outbox event key', async () => {
    const repository = makeRepository();
    const entry = makeEntry({ status: 'called' });

    await queueNotificationService.notifyTicketCalled(
      entry,
      { organizationId: 'org-001' },
      repository,
      client
    );
    await queueNotificationService.notifyTicketCalled(
      entry,
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.enqueue).toHaveBeenCalledTimes(2);
    expect(repository.enqueue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventKey: 'queue_entry:entry-001:called' }),
      client
    );
    expect(repository.enqueue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ eventKey: 'queue_entry:entry-001:called' }),
      client
    );
  });

  it('skips ETA warning when ahead count is above threshold', async () => {
    const repository = makeRepository();
    await queueNotificationService.notifyEtaWarning(
      makeEntry(),
      ETA_WARNING_THRESHOLD + 1,
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues ETA warning at the exact threshold boundary', async () => {
    const repository = makeRepository();
    await queueNotificationService.notifyEtaWarning(
      makeEntry(),
      ETA_WARNING_THRESHOLD,
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'eta_warning',
        eventKey: 'queue_entry:entry-001:eta_warning',
        payload: expect.objectContaining({ aheadCount: ETA_WARNING_THRESHOLD }),
      }),
      client
    );
  });

  it.each([
    ['notifyTicketCalled', 'called'],
    ['notifyTicketServing', 'serving'],
    ['notifyTicketCompleted', 'completed'],
    ['notifyTicketNoShow', 'no_show'],
    ['notifyTicketCancelled', 'cancelled'],
  ] as const)('enqueues %s as %s', async (methodName, eventType) => {
    const repository = makeRepository();
    await queueNotificationService[methodName](
      makeEntry(),
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType,
        eventKey: `queue_entry:entry-001:${eventType}`,
      }),
      client
    );
  });

  it('cancels pending notifications before enqueueing a terminal event', async () => {
    const repository = makeRepository();
    await queueNotificationService.notifyTicketCancelled(
      makeEntry({ status: 'cancelled' }),
      { organizationId: 'org-001' },
      repository,
      client
    );

    expect(repository.cancelPendingForEntry).toHaveBeenCalledWith(
      'entry-001',
      'queue_entry:entry-001:cancelled',
      client
    );
    expect(repository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'cancelled' }),
      client
    );
  });
});
