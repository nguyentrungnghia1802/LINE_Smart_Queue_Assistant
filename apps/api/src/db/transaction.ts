import { PoolClient } from 'pg';
import { pool } from './client';

/**
 * Execute `fn` inside a PostgreSQL transaction.
 *
 * - Acquires a dedicated client from the pool.
 * - Sends BEGIN before calling `fn`.
 * - Sends COMMIT if `fn` resolves successfully.
 * - Sends ROLLBACK and re-throws if `fn` throws.
 * - Always releases the client back to the pool.
 *
 * Usage:
 * ```ts
 * const result = await withTransaction(async (client) => {
 *   const [entry] = await queryWithClient<QueueEntry>(client, insertEntrySql, params);
 *   await queryWithClient(client, incrementCounterSql, [entry.queue_id]);
 *   return entry;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a savepoint within an existing transaction.
 * Useful for nested operations that may partially fail without rolling back
 * the outer transaction.
 *
 * Usage:
 * ```ts
 * await withTransaction(async (client) => {
 *   await doMainWork(client);
 *   await withSavepoint(client, 'notify', async () => {
 *     await sendNotification(client);  // rolls back only this block on failure
 *   });
 * });
 * ```
 */
export async function withSavepoint<T>(
  client: PoolClient,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
}
