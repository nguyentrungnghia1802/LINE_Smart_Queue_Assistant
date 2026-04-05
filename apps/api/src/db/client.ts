import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';

// ── Connection pool ────────────────────────────────────────────────────────────
// One pool per process. Shared by all repositories and the transaction helper.
// Configured via DATABASE_URL; individual DB_* parts used as fallback.

const connectionString =
  config.database.url ||
  `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;

export const pool = new Pool({
  connectionString,
  max: config.nodeEnv === 'test' ? 2 : 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Unexpected error on idle client — log but do not crash; the next acquire
  // will obtain a fresh connection.
  console.error('[db] Unexpected pool error:', err.message);
});

// ── Typed query helpers ────────────────────────────────────────────────────────

/**
 * Run a parameterized query on a pool connection.
 * Returns typed rows array (empty array when zero rows).
 */
export async function query<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result: QueryResult<T> = await pool.query<T>(sql, params);
  return result.rows;
}

/**
 * Run a query and return the first row, or `null` if no rows match.
 */
export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const result: QueryResult<T> = await pool.query<T>(sql, params);
  return result.rows[0] ?? null;
}

/**
 * Run a query on an existing PoolClient (within a transaction).
 */
export async function queryWithClient<T extends Record<string, unknown>>(
  client: PoolClient,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result: QueryResult<T> = await client.query<T>(sql, params);
  return result.rows;
}

/**
 * Gracefully close the pool (called on SIGTERM/SIGINT in server.ts).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
