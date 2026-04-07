import { pool } from '../db/client';
import { queuesRepository } from '../db/repositories/queues.repository';
import { logger } from '../utils/logger';

/**
 * Daily ticket counter reset job.
 *
 * Resets `daily_ticket_counter` to 0 for every active queue.
 * Intended to run once per day at midnight (local org time ideally, UTC acceptable for MVP).
 *
 * Schedule: "0 0 * * *" (cron)  →  run via node-cron or pg_cron in production.
 * For now this is a standalone async function invocable from a cron wrapper.
 */
export async function runCounterReset(): Promise<void> {
  logger.info('counterReset job: starting');

  try {
    const result = await pool.query<{ id: string }>(`SELECT id FROM queues WHERE is_active = TRUE`);

    const ids = result.rows.map((r) => r.id);
    logger.info({ queueCount: ids.length }, 'counterReset job: queues to reset');

    for (const id of ids) {
      await queuesRepository.resetDailyCounter(id);
    }

    logger.info({ reset: ids.length }, 'counterReset job: done');
  } catch (err) {
    logger.error({ err }, 'counterReset job: failed');
    throw err;
  }
}
