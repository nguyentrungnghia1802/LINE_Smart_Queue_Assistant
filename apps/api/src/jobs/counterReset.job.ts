import { pool } from '../db/client';
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
    const result = await pool.query(
      `UPDATE queues q
       SET daily_ticket_counter = 0,
           counter_business_date = (NOW() AT TIME ZONE o.timezone)::date,
           last_counter_reset_at = NOW()
       FROM organizations o
       WHERE q.organization_id = o.id
         AND q.is_active = TRUE
         AND q.counter_business_date IS DISTINCT FROM (NOW() AT TIME ZONE o.timezone)::date
       RETURNING q.id`
    );
    logger.info({ reset: result.rowCount ?? 0 }, 'counterReset job: done');
  } catch (err) {
    logger.error({ err }, 'counterReset job: failed');
    throw err;
  }
}
