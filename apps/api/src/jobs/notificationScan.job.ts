/**
 * Notification Scan Jobs
 *
 * ── Responsibility ────────────────────────────────────────────────────────────
 * Two independent scan functions that run on a fixed polling interval.
 * Both delegate message construction and anti-duplicate guards to
 * `queueNotificationService` — job logic here is limited to DB queries,
 * fan-out, and structured logging.
 *
 * ── Why polling instead of event-driven? ─────────────────────────────────────
 * At MVP scale with a single Express + PostgreSQL instance, interval polling
 * is operationally simpler than a message queue (no Redis) and resilient to
 * missed events (server restarts, in-flight request failures). The anti-
 * duplicate registry ensures each notification fires at most once even when
 * the scanner visits the same entry on successive cycles.
 *
 * ── Jobs ─────────────────────────────────────────────────────────────────────
 * scanEtaWarnings  — Finds waiting entries within the ETA warning threshold
 *                    and pushes "you're almost up!" notifications. Skips the
 *                    first-in-line entry (ahead_count = 0) — those customers
 *                    receive the "called" notification from staff action.
 *
 * scanCalledRenotify — Finds recently-called entries where initial delivery
 *                      may have failed (e.g. LINE API was temporarily down)
 *                      and re-attempts the push. On server restart the in-
 *                      memory log is cleared, so all currently-called entries
 *                      are re-notified — intentional "at-least-once" delivery.
 */

import { queueEntriesRepository } from '../db/repositories/queue-entries.repository';
import {
  ETA_WARNING_THRESHOLD,
  queueNotificationService,
} from '../modules/notifications/queue-notification.service';
import { logger } from '../utils/logger';

// ── Config ────────────────────────────────────────────────────────────────────

/** Maximum age (minutes) of a called entry to include in the re-notify scan. */
const CALLED_RENOTIFY_MAX_AGE_MINUTES = 30;

/**
 * Minimum age (seconds) before re-notifying a called entry.
 * Gives the initial delivery (fired synchronously by callNextTicket) time
 * to succeed before the scanner re-attempts.
 */
const CALLED_RENOTIFY_MIN_AGE_SECONDS = 30;

// ── Scan: ETA warnings ────────────────────────────────────────────────────────

/**
 * Scan waiting entries near the front of the queue and push ETA warnings.
 *
 * Runs every `ETA_WARNING_INTERVAL_MS` (see scheduler.ts).
 *
 * The window-function query returns only entries where
 * `1 ≤ ahead_count ≤ ETA_WARNING_THRESHOLD`, so the first-in-line
 * (ahead_count = 0) is excluded.
 *
 * `queueNotificationService.notifyEtaWarning` is idempotent — the anti-
 * duplicate registry prevents duplicate pushes if the same entry appears on
 * successive scan cycles.
 *
 * Exported for direct invocation in integration tests and manual triggers
 * (`scheduler.runOnce()`).
 */
export async function scanEtaWarnings(): Promise<void> {
  const entries = await queueEntriesRepository.findNearThresholdWaiting(ETA_WARNING_THRESHOLD);

  logger.debug({ count: entries.length }, 'etaScan: entries near threshold');

  if (entries.length === 0) return;

  await Promise.allSettled(
    entries.map((entry) =>
      queueNotificationService
        .notifyEtaWarning(entry, entry.ahead_count)
        .catch((err) => logger.error({ entryId: entry.id, err }, 'etaScan: unexpected error'))
    )
  );
}

// ── Scan: Called re-notify ────────────────────────────────────────────────────

/**
 * Re-send "your number is called" notifications for entries where the initial
 * push may have failed.
 *
 * Runs every `CALLED_RENOTIFY_INTERVAL_MS` (see scheduler.ts).
 *
 * Only entries called within `CALLED_RENOTIFY_MAX_AGE_MINUTES` and at least
 * `CALLED_RENOTIFY_MIN_AGE_SECONDS` ago are candidates. The buffer window
 * avoids racing with the synchronous delivery in `queueService.callNextTicket`.
 *
 * `queueNotificationService.notifyTicketCalled` is idempotent — entries whose
 * initial delivery succeeded are skipped because `notificationLogRepository`
 * has already marked them as sent.
 *
 * Exported for direct invocation in integration tests and manual triggers.
 */
export async function scanCalledRenotify(): Promise<void> {
  const entries = await queueEntriesRepository.findRecentlyCalled(
    CALLED_RENOTIFY_MAX_AGE_MINUTES,
    CALLED_RENOTIFY_MIN_AGE_SECONDS
  );

  logger.debug({ count: entries.length }, 'calledScan: entries to recheck');

  if (entries.length === 0) return;

  await Promise.allSettled(
    entries.map((entry) =>
      queueNotificationService
        .notifyTicketCalled(entry)
        .catch((err) => logger.error({ entryId: entry.id, err }, 'calledScan: unexpected error'))
    )
  );
}
