import { PoolClient } from 'pg';

import { query, queryOne, queryWithClient } from '../client';

/**
 * BaseRepository provides typed query helpers usable both on the shared pool
 * and on a PoolClient (for use inside withTransaction).
 *
 * Domain repositories extend this class and expose named methods that
 * encapsulate the SQL. No raw SQL should appear in service-layer code.
 */
export abstract class BaseRepository {
  protected async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return query<T>(sql, params);
  }

  protected async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    return queryOne<T>(sql, params);
  }

  /**
   * Run a query on an existing client (within a transaction).
   * Service code passes the client from withTransaction(client => …).
   */
  protected async queryTx<T>(client: PoolClient, sql: string, params?: unknown[]): Promise<T[]> {
    return queryWithClient<T>(client, sql, params);
  }

  protected async queryOneTx<T>(
    client: PoolClient,
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const rows = await queryWithClient<T>(client, sql, params);
    return rows[0] ?? null;
  }

  /**
   * Assert a row was returned (e.g. after INSERT … RETURNING *).
   * Throws a clear error if the query unexpectedly returned nothing.
   */
  protected firstOrThrow<T>(rows: T[], context?: string): T {
    if (rows[0] === undefined) {
      const detail = context ? ` (${context})` : '';
      throw new Error('Expected at least one row from database' + detail);
    }
    return rows[0];
  }
}
