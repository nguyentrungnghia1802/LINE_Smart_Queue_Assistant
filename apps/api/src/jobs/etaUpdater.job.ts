import { pool } from '../db/client';
import { notificationsService } from '../modules/notifications/notifications.service';
import { logger } from '../utils/logger';

/**
 * ETA updater job.
 *
 * Periodically recalculates estimated wait time for all currently-waiting
 * queue entries and triggers LINE push notifications for users whose
 * position has changed significantly.
 *
 * Schedule: every 30 seconds (polling interval for MVP; replace with
 * event-driven approach once real-time infrastructure is in place).
 *
 * Algorithm (stub):
 *   For each open queue:
 *     1. Count waiting entries by priority.
 *     2. Recalculate ETA = position * avg_service_seconds.
 *     3. If ETA changed by > 20 % vs stored value → push update to user.
 *     4. If user is next (position = 1) → push "You're up next!" message.
 */
export async function runEtaUpdater(): Promise<void> {
  logger.debug('etaUpdater job: starting cycle');

  try {
    const result = await pool.query<{ id: string; avg_service_seconds: number }>(
      `SELECT id, avg_service_seconds FROM queues WHERE is_active = TRUE AND status = 'open'`
    );

    for (const queue of result.rows) {
      await processQueue(queue.id, queue.avg_service_seconds);
    }

    logger.debug('etaUpdater job: cycle complete');
  } catch (err) {
    logger.error({ err }, 'etaUpdater job: cycle failed');
  }
}

async function processQueue(queueId: string, avgServiceSeconds: number): Promise<void> {
  // TODO: fetch waiting entries, recalculate ETAs, compare to last known ETAs,
  //       and send push notifications via notificationsService.send() for
  //       users whose position or ETA has crossed a threshold.

  void queueId;
  void avgServiceSeconds;
  void notificationsService;
}
