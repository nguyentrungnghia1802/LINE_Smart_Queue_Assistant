import os from 'node:os';

import { pool } from '../db/client';
import { logger } from '../utils/logger';

const ownerId = `${os.hostname()}:${process.pid}`;

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 500);
}

export async function withAdvisoryJobLock(
  jobName: string,
  run: () => Promise<void>
): Promise<boolean> {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lock = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [`line-smart-queue:${jobName}`]
    );
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) {
      logger.debug({ job: jobName }, 'scheduler.lock: owned by another instance');
      return false;
    }

    await client.query(
      `INSERT INTO scheduler_job_runs (job_name, owner_id, status, started_at, updated_at)
       VALUES ($1,$2,'running',NOW(),NOW())
       ON CONFLICT (job_name) DO UPDATE
       SET owner_id = EXCLUDED.owner_id, status = 'running', started_at = NOW(),
           last_error = NULL, updated_at = NOW()`,
      [jobName, ownerId]
    );

    try {
      await run();
      await client.query(
        `UPDATE scheduler_job_runs
         SET status = 'succeeded', finished_at = NOW(), last_success_at = NOW(),
             last_error = NULL, updated_at = NOW()
         WHERE job_name = $1`,
        [jobName]
      );
      return true;
    } catch (error) {
      await client.query(
        `UPDATE scheduler_job_runs
         SET status = 'failed', finished_at = NOW(), last_error = $2, updated_at = NOW()
         WHERE job_name = $1`,
        [jobName, safeError(error)]
      );
      throw error;
    }
  } finally {
    if (acquired) {
      await client
        .query(`SELECT pg_advisory_unlock(hashtext($1))`, [`line-smart-queue:${jobName}`])
        .catch(() => undefined);
    }
    client.release();
  }
}

export async function schedulerHealth() {
  const { rows } = await pool.query<{
    job_name: string;
    status: string;
    started_at: Date | null;
    finished_at: Date | null;
    last_success_at: Date | null;
  }>(
    `SELECT job_name, status, started_at, finished_at, last_success_at
     FROM scheduler_job_runs ORDER BY job_name`
  );
  return rows;
}
