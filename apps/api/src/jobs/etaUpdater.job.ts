import { pool } from '../db/client';
import { queueEntriesRepository } from '../db/repositories/queue-entries.repository';
import { logger } from '../utils/logger';

/**
 * ETA updater job.
 *
 * Periodically recalculates `estimated_wait_seconds` for all waiting entries
 * across every open queue.  The recalculated value is used by LIFF screens
 * to display a live countdown and by the ETA warning scan job to determine
 * which entries are approaching the threshold.
 *
 * Schedule: every 30 seconds (see scheduler.ts).
 * Notification delivery is handled separately by `notificationScan.job.ts`.
 *
 * Algorithm:
 *   For each open queue with at least one waiting entry:
 *     estimated_wait_seconds = NOW() + (queue_position × avg_service_seconds)
 *   Uses `queueEntriesRepository.bulkUpdateEta` which runs a single UPDATE
 *   with a window function — one statement per queue, no row-by-row loop.
 */
export async function runEtaUpdater(): Promise<void> {
  logger.debug('etaUpdater: starting cycle');

  const result = await pool.query<{ id: string; avg_service_seconds: number }>(
    `SELECT id, avg_service_seconds FROM queues WHERE is_active = TRUE AND status = 'open'`
  );

  if (result.rows.length === 0) {
    logger.debug('etaUpdater: no open queues');
    return;
  }

  await Promise.allSettled(
    result.rows.map((q) =>
      queueEntriesRepository
        .bulkUpdateEta(q.id, q.avg_service_seconds)
        .then(() => logger.debug({ queueId: q.id }, 'etaUpdater: updated queue'))
        .catch((err) => logger.error({ queueId: q.id, err }, 'etaUpdater: queue failed'))
    )
  );

  logger.debug({ queueCount: result.rows.length }, 'etaUpdater: cycle complete');
}
