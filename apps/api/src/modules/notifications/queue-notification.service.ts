/**
 * Queue Notification Service
 *
 * ── Responsibility ───────────────────────────────────────────────────────────
 * Translates queue lifecycle events into LINE push messages.
 * This service owns the "when to notify" and "what to say" decisions.
 * The LINE transport is hidden behind ILineMessagingAdapter.
 *
 * ── Source of truth ─────────────────────────────────────────────────────────
 * - Queue entry STATE → queue_entries.status (set by queueService before
 *   calling any function here).
 * - Notification SENT status → notificationLogRepository (anti-duplicate
 *   registry keyed by entryId + event type).
 *
 * ── Coupling policy ──────────────────────────────────────────────────────────
 * This service MUST NOT import from line.service (webhook layer) or
 * queue.service (domain layer). queueService calls this service — not the
 * reverse. That one-way dependency prevents circular imports and keeps
 * webhook events decoupled from queue domain state transitions.
 *
 * ── Anti-duplicate guarantee ─────────────────────────────────────────────────
 * Every public function checks `notificationLogRepository.hasBeenSent()`
 * before sending. Duplicate calls (e.g. retried RPC, race condition) are
 * silently dropped after the first successful delivery.
 */

import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { logger } from '../../utils/logger';
import type { ILineMessagingAdapter } from '../line/line.adapter';
import { lineMessagingAdapter } from '../line/line.messaging';

import type { INotificationLogRepository } from './notification-log.repository';
import { notificationLogRepository } from './notification-log.repository';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Send an ETA warning when this many entries are still ahead of the customer.
 * Threshold of 2 means "you are 3rd in line or closer".
 *
 * Exported so tests can reference the same value without magic numbers.
 */
export const ETA_WARNING_THRESHOLD = 2;

// ── Service ───────────────────────────────────────────────────────────────────

export const queueNotificationService = {
  /**
   * Push a "your number is called" message to the ticket holder.
   *
   * Pre-condition: `entry.status` has already been set to `'called'` by
   * queueService.callNextTicket. This function does NOT transition status.
   *
   * Silently skipped when:
   *   - `entry.line_user_id` is null (customer has no LINE account)
   *   - the same notification has already been sent for this entry
   */
  async notifyTicketCalled(
    entry: QueueEntryRow,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;

    if (log.hasBeenSent(entry.id, 'called')) {
      logger.debug({ entryId: entry.id }, 'Duplicate called notification suppressed');
      return;
    }

    try {
      await adapter.pushMessage(entry.line_user_id, [
        {
          type: 'text',
          text:
            `🔔 Ticket ${entry.ticket_display} — It's your turn!\n\n` +
            'Please proceed to the counter now. Thank you for your patience! 🙏',
        },
      ]);
      log.markSent(entry.id, 'called');
      logger.info(
        { entryId: entry.id, lineUserId: entry.line_user_id },
        'Called notification sent'
      );
    } catch (err) {
      // A notification failure must never roll back the queue state transition.
      logger.error({ err, entryId: entry.id }, 'Failed to send called notification');
    }
  },

  /**
   * Push an "almost your turn" warning when the customer is near the front.
   *
   * Only fires when `aheadCount <= ETA_WARNING_THRESHOLD`.
   * Anti-duplicate: at most one eta_warning per entry regardless of how many
   * times callNextTicket advances the queue past this threshold.
   *
   * Typically triggered by queueService.callNextTicket for the second entry
   * in line each time a ticket is called.
   */
  async notifyEtaWarning(
    entry: QueueEntryRow,
    aheadCount: number,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;
    if (aheadCount > ETA_WARNING_THRESHOLD) return;

    if (log.hasBeenSent(entry.id, 'eta_warning')) {
      logger.debug({ entryId: entry.id }, 'Duplicate ETA warning suppressed');
      return;
    }

    const who = aheadCount === 1 ? '1 person is' : `${aheadCount} people are`;

    try {
      await adapter.pushMessage(entry.line_user_id, [
        {
          type: 'text',
          text:
            `⏰ Ticket ${entry.ticket_display} — Almost your turn!\n\n` +
            `${who} ahead of you. Please make your way to the counter.`,
        },
      ]);
      log.markSent(entry.id, 'eta_warning');
      logger.info({ entryId: entry.id, aheadCount }, 'ETA warning notification sent');
    } catch (err) {
      logger.error({ err, entryId: entry.id }, 'Failed to send ETA warning');
    }
  },

  /**
   * Push a "ticket cancelled" confirmation to the ticket holder.
   * Called after queueService.cancelTicket completes successfully.
   * Anti-duplicate: at most once per entry.
   */
  async notifyTicketCancelled(
    entry: QueueEntryRow,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;

    if (log.hasBeenSent(entry.id, 'cancelled')) {
      logger.debug({ entryId: entry.id }, 'Duplicate cancelled notification suppressed');
      return;
    }

    try {
      await adapter.pushMessage(entry.line_user_id, [
        {
          type: 'text',
          text: `✅ Ticket ${entry.ticket_display} has been cancelled. Thank you!`,
        },
      ]);
      log.markSent(entry.id, 'cancelled');
      logger.info({ entryId: entry.id }, 'Cancelled notification sent');
    } catch (err) {
      logger.error({ err, entryId: entry.id }, 'Failed to send cancelled notification');
    }
  },
};
