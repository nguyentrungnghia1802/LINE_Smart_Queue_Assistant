import { Pool, PoolClient } from 'pg';

import { config } from '../config';
import { logger } from '../utils/logger';
import { metricsService } from '../utils/metrics';

// ── Connection pool ────────────────────────────────────────────────────────────
// One pool per process. Shared by all repositories and the transaction helper.
// Configured via DATABASE_URL; individual DB_* parts used as fallback.

const connectionString =
  config.database.url ||
  `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;

export const pool = new Pool({
  connectionString,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.poolIdleTimeoutMs,
  connectionTimeoutMillis: config.database.poolConnectionTimeoutMs,
});

pool.on('error', (err) => {
  // Unexpected error on idle client — log but do not crash; the next acquire
  // will obtain a fresh connection.
  logger.error({ errorType: err.name }, 'Unexpected PostgreSQL pool error');
});

export function updatePoolMetrics(): void {
  metricsService.setGauge('postgres_pool_total', pool.totalCount);
  metricsService.setGauge('postgres_pool_idle', pool.idleCount);
  metricsService.setGauge('postgres_pool_waiting', pool.waitingCount);
}

// ── Typed query helpers ────────────────────────────────────────────────────────

/**
 * Run a parameterized query on a pool connection.
 * Returns typed rows array (empty array when zero rows).
 */
export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(sql, params);
  updatePoolMetrics();
  return result.rows as T[];
}

/**
 * Run a query and return the first row, or `null` if no rows match.
 */
export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(sql, params);
  updatePoolMetrics();
  return (result.rows[0] as T) ?? null;
}

/**
 * Run a query on an existing PoolClient (within a transaction).
 */
export async function queryWithClient<T>(
  client: PoolClient,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await client.query(sql, params);
  updatePoolMetrics();
  return result.rows as T[];
}

/**
 * Gracefully close the pool (called on SIGTERM/SIGINT in server.ts).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
