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

import { lineNotificationService } from './line-notification.service';
import {
  etaWarningMessage,
  ticketCalledMessage,
  ticketCancelledMessage,
  ticketCompletedMessage,
  ticketNoShowMessage,
  ticketServingMessage,
} from './line-notification.templates';
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

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      ticketCalledMessage(entry.ticket_code),
      { entryId: entry.id, eventType: 'called' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'called');
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

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      etaWarningMessage(entry.ticket_code, aheadCount),
      { entryId: entry.id, eventType: 'eta_warning' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'eta_warning');
    }
  },

  async notifyTicketServing(
    entry: QueueEntryRow,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;

    if (log.hasBeenSent(entry.id, 'serving')) {
      logger.debug({ entryId: entry.id }, 'Duplicate serving notification suppressed');
      return;
    }

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      ticketServingMessage(entry.ticket_code),
      { entryId: entry.id, eventType: 'serving' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'serving');
    }
  },

  async notifyTicketCompleted(
    entry: QueueEntryRow,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;

    if (log.hasBeenSent(entry.id, 'completed')) {
      logger.debug({ entryId: entry.id }, 'Duplicate completed notification suppressed');
      return;
    }

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      ticketCompletedMessage(entry.ticket_code),
      { entryId: entry.id, eventType: 'completed' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'completed');
    }
  },

  async notifyTicketNoShow(
    entry: QueueEntryRow,
    adapter: ILineMessagingAdapter = lineMessagingAdapter,
    log: INotificationLogRepository = notificationLogRepository
  ): Promise<void> {
    if (!entry.line_user_id) return;

    if (log.hasBeenSent(entry.id, 'no_show')) {
      logger.debug({ entryId: entry.id }, 'Duplicate no-show notification suppressed');
      return;
    }

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      ticketNoShowMessage(entry.ticket_code),
      { entryId: entry.id, eventType: 'no_show' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'no_show');
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

    const sent = await lineNotificationService.pushText(
      entry.line_user_id,
      ticketCancelledMessage(entry.ticket_code),
      { entryId: entry.id, eventType: 'cancelled' },
      adapter
    );
    if (sent) {
      log.markSent(entry.id, 'cancelled');
    }
  },
};
