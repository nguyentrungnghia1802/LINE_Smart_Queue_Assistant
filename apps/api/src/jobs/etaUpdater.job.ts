import { pool } from '../db/client';
import { queueEntriesRepository } from '../db/repositories/queue-entries.repository';
import { realtimeService } from '../modules/realtime';
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

  const result = await pool.query<{
    id: string;
    organization_id: string;
    branch_id: string | null;
    avg_service_seconds: number;
  }>(
    `SELECT id, organization_id, branch_id, avg_service_seconds
     FROM queues WHERE is_active = TRUE AND status = 'open'`
  );

  if (result.rows.length === 0) {
    logger.debug('etaUpdater: no open queues');
    return;
  }

  await Promise.allSettled(
    result.rows.map(async (queue) => {
      try {
        const entries = await queueEntriesRepository.bulkUpdateEta(
          queue.id,
          queue.avg_service_seconds
        );
        if (entries.length > 0 && queue.branch_id) {
          const scopedQueue = { ...queue, branch_id: queue.branch_id };
          try {
            for (const entry of entries) {
              await realtimeService.publishTicketEvent({
                name: 'ticket.eta_updated',
                entry,
                queue: scopedQueue,
              });
            }
            await realtimeService.publishQueueSummary({
              queue: scopedQueue,
              reason: 'eta_updated',
            });
          } catch (error) {
            logger.warn(
              {
                queueId: queue.id,
                errorType: error instanceof Error ? error.name : 'UnknownError',
              },
              'etaUpdater: realtime publication failed; REST remains authoritative'
            );
          }
        }
        logger.debug(
          { queueId: queue.id, changedEntries: entries.length },
          'etaUpdater: updated queue'
        );
      } catch (err) {
        logger.error({ queueId: queue.id, err }, 'etaUpdater: queue failed');
      }
    })
  );

  logger.debug({ queueCount: result.rows.length }, 'etaUpdater: cycle complete');
}
