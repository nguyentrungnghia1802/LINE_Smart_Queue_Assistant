/**
 * In-memory TTL cache abstraction
 *
 * A lightweight, zero-dependency cache suitable for single-instance deployments.
 * The API is intentionally narrow so it can be swapped for a Redis-backed
 * implementation later without touching call sites.
 *
 * Suitable for:
 *   - Organization config / settings   (invalidate on update)
 *   - Product catalog per org           (invalidate on product write)
 *   - Queue configuration rows          (invalidate on queue write)
 *
 * NOT suitable for:
 *   - Queue position / ticket counts    (changes every second)
 *   - Auth tokens / sessions            (use proper session store)
 *   - Multi-instance deployments        (use Redis for shared state)
 *
 * Each MemoryCache instance is isolated. Create one per logical domain
 * (e.g. orgCache, queueConfigCache) to keep TTLs and namespaces separate.
 *
 * Expired entries are purged lazily on read (no background timer) to
 * avoid background task overhead in the main Express process.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface ICache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlMs?: number): void;
  invalidate(key: string): void;
  invalidateAll(): void;
}

export class MemoryCache<T> implements ICache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Remove a single entry immediately.
   * Call on write operations (create/update/delete) to prevent stale reads.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Flush the entire cache. Use on broad schema changes or for testing.
   */
  invalidateAll(): void {
    this.store.clear();
  }

  /**
   * Number of non-expired entries currently in the cache.
   * Expired entries are pruned during this call.
   */
  get size(): number {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    return this.store.size;
  }
}

/**
 * getOrSet — fetch-with-cache helper.
 *
 * Returns the cached value if present and unexpired; otherwise calls
 * `fetchFn`, caches the result with `ttlMs`, and returns it.
 *
 * Example:
 *   const queue = await getOrSet(queueCache, `queue:${id}`, () => queuesRepository.findById(id));
 */
export async function getOrSet<T>(
  cache: ICache<T>,
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== null) return cached;

  const value = await fetchFn();
  cache.set(key, value, ttlMs);
  return value;
}

// ── Shared cache instances ────────────────────────────────────────────────────

import type { OrganizationRow } from '../db/repositories/organizations.repository';
import type { ProductRow } from '../db/repositories/products.repository';
import type { QueueRow } from '../db/repositories/queues.repository';

/**
 * Organization config cache — TTL 5 minutes.
 * Stores full OrganizationRow. Invalidated on org settings update.
 */
export const orgCache = new MemoryCache<OrganizationRow>(5 * 60_000);

/**
 * Product catalog cache — TTL 2 minutes.
 * Key: `org:<orgId>` or `slug:<slug>`. Stores the product array.
 * Invalidated on any product create/update/delete for that org.
 */
export const productCatalogCache = new MemoryCache<ProductRow[]>(2 * 60_000);

/**
 * Queue config cache — TTL 30 seconds.
 * Key: `queue:<queueId>`. Stores QueueRow (config fields, not live counter).
 * Short TTL because avg_service_seconds can be updated by managers.
 */
export const queueConfigCache = new MemoryCache<QueueRow>(30_000);
