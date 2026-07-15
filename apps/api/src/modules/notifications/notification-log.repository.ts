/**
 * Anti-duplicate notification registry.
 *
 * ── Source of truth ─────────────────────────────────────────────────────────
 * Notification *delivery* state is intentionally NOT stored in queue_entries.
 * queue_entries.status is the canonical queue state machine; notification
 * tracking is a separate concern kept here so the two can evolve independently.
 *
 * ── MVP implementation ───────────────────────────────────────────────────────
 * This module uses an in-memory Map. The registry survives the process
 * lifetime (fine for a single-instance API) but is not shared across
 * replicas and is lost on restart.
 *
 * ── Production upgrade path ──────────────────────────────────────────────────
 * Swap `InMemoryNotificationLogRepository` for a `DbNotificationLogRepository`
 * that writes to a `notification_log (entry_id, type, sent_at)` table with a
 * UNIQUE constraint on (entry_id, type). This module's consumers need no
 * changes — they depend only on `INotificationLogRepository`.
 *
 * Key: `${entryId}:${type}` — at most one push per (entry, notification type).
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** All lifecycle events that trigger a LINE push message. */
export type NotificationEventType =
  | 'called'
  | 'eta_warning'
  | 'serving'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface INotificationLogRepository {
  /** Returns true when this (entryId, type) pair has already been sent. */
  hasBeenSent(entryId: string, type: NotificationEventType): boolean;

  /** Record that a notification of `type` was sent for `entryId`. */
  markSent(entryId: string, type: NotificationEventType): void;

  /**
   * Remove all notification records for an entry once it reaches a terminal
   * state (completed, cancelled, no_show). Frees memory in long-running
   * processes.
   */
  clearEntry(entryId: string): void;
}

// ── In-memory implementation ───────────────────────────────────────────────────

class InMemoryNotificationLogRepository implements INotificationLogRepository {
  /** Maps entryId → Set<NotificationEventType> */
  private readonly sent = new Map<string, Set<string>>();

  hasBeenSent(entryId: string, type: NotificationEventType): boolean {
    return this.sent.get(entryId)?.has(type) ?? false;
  }

  markSent(entryId: string, type: NotificationEventType): void {
    let record = this.sent.get(entryId);
    if (!record) {
      record = new Set();
      this.sent.set(entryId, record);
    }
    record.add(type);
  }

  clearEntry(entryId: string): void {
    this.sent.delete(entryId);
  }

  /**
   * Wipe the entire registry.
   * Intended for test `beforeEach` only — do not call in production code.
   */
  _resetForTests(): void {
    this.sent.clear();
  }
}

export const notificationLogRepository = new InMemoryNotificationLogRepository();
