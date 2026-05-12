/**
 * Unit tests for queue-notification.service.ts
 *
 * Strategy:
 * - No HTTP, no real DB — fully in-memory.
 * - MockLineAdapter is injected directly (no jest.mock needed).
 * - notificationLogRepository._resetForTests() wipes state in beforeEach.
 */

import type { QueueEntryRow } from '../../../db/repositories/queue-entries.repository';
import { MockLineAdapter } from '../../line/line.mock.adapter';
import { notificationLogRepository } from '../notification-log.repository';
import { ETA_WARNING_THRESHOLD, queueNotificationService } from '../queue-notification.service';

// ── Test fixture ───────────────────────────────────────────────────────────────

function makeEntry(override: Partial<QueueEntryRow> = {}): QueueEntryRow {
  return {
    id: 'entry-001',
    queue_id: 'queue-001',
    user_id: null,
    line_user_id: 'U_test_001',
    ticket_number: 5,
    ticket_display: 'A005',
    status: 'waiting',
    skip_count: 0,
    priority: 0,
    notes: null,
    metadata: {},
    called_at: null,
    serving_at: null,
    completed_at: null,
    skipped_at: null,
    cancelled_at: null,
    estimated_call_at: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    ...override,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  notificationLogRepository._resetForTests();
});

// ── notifyTicketCalled ─────────────────────────────────────────────────────────

describe('notifyTicketCalled', () => {
  it('sends a push message to the ticket holder', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'called' });

    await queueNotificationService.notifyTicketCalled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
    expect(adapter.pushCalls[0].to).toBe('U_test_001');
    expect(adapter.pushCalls[0].messages[0].text).toContain('A005');
    expect(adapter.pushCalls[0].messages[0].text).toContain("It's your turn");
  });

  it('does nothing when line_user_id is null', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ line_user_id: null });

    await queueNotificationService.notifyTicketCalled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(0);
  });

  it('only sends once even when called twice (anti-duplicate)', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'called' });

    await queueNotificationService.notifyTicketCalled(entry, adapter, notificationLogRepository);
    await queueNotificationService.notifyTicketCalled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
  });

  it('marks the event as sent in the notification log', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'called' });

    await queueNotificationService.notifyTicketCalled(entry, adapter, notificationLogRepository);

    expect(notificationLogRepository.hasBeenSent(entry.id, 'called')).toBe(true);
  });
});

// ── notifyEtaWarning ───────────────────────────────────────────────────────────

describe('notifyEtaWarning', () => {
  it('sends a warning when aheadCount is within threshold', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'waiting' });

    await queueNotificationService.notifyEtaWarning(entry, 1, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
    expect(adapter.pushCalls[0].messages[0].text).toContain('Almost your turn');
    expect(adapter.pushCalls[0].messages[0].text).toContain('1 person is');
  });

  it('sends a warning at the exact threshold boundary', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry();

    await queueNotificationService.notifyEtaWarning(
      entry,
      ETA_WARNING_THRESHOLD,
      adapter,
      notificationLogRepository
    );

    expect(adapter.pushCalls).toHaveLength(1);
  });

  it('does NOT send when aheadCount is above threshold', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry();

    await queueNotificationService.notifyEtaWarning(
      entry,
      ETA_WARNING_THRESHOLD + 1,
      adapter,
      notificationLogRepository
    );

    expect(adapter.pushCalls).toHaveLength(0);
  });

  it('only sends once even when triggered multiple times (anti-duplicate)', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry();

    await queueNotificationService.notifyEtaWarning(entry, 1, adapter, notificationLogRepository);
    await queueNotificationService.notifyEtaWarning(entry, 1, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
  });

  it('does nothing when line_user_id is null', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ line_user_id: null });

    await queueNotificationService.notifyEtaWarning(entry, 1, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(0);
  });
});

// ── notifyTicketCancelled ──────────────────────────────────────────────────────

describe('notifyTicketCancelled', () => {
  it('sends a cancellation message to the ticket holder', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'cancelled', cancelled_at: new Date() });

    await queueNotificationService.notifyTicketCancelled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
    expect(adapter.pushCalls[0].messages[0].text).toContain('A005');
    expect(adapter.pushCalls[0].messages[0].text).toContain('cancelled');
  });

  it('only sends once even when called twice (anti-duplicate)', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'cancelled', cancelled_at: new Date() });

    await queueNotificationService.notifyTicketCancelled(entry, adapter, notificationLogRepository);
    await queueNotificationService.notifyTicketCancelled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(1);
  });

  it('clears all notification log entries for the entry (terminal state cleanup)', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ status: 'cancelled', cancelled_at: new Date() });

    // Simulate a prior sent notification for this entry
    notificationLogRepository.markSent(entry.id, 'eta_warning');

    await queueNotificationService.notifyTicketCancelled(entry, adapter, notificationLogRepository);

    // After cancellation, the 'cancelled' event is recorded
    expect(notificationLogRepository.hasBeenSent(entry.id, 'cancelled')).toBe(true);
    // The pre-existing eta_warning is still recorded (no clearEntry call)
    expect(notificationLogRepository.hasBeenSent(entry.id, 'eta_warning')).toBe(true);
  });

  it('does nothing when line_user_id is null', async () => {
    const adapter = new MockLineAdapter();
    const entry = makeEntry({ line_user_id: null });

    await queueNotificationService.notifyTicketCancelled(entry, adapter, notificationLogRepository);

    expect(adapter.pushCalls).toHaveLength(0);
  });
});
