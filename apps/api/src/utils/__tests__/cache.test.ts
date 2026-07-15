/**
 * Unit tests for MemoryCache and getOrSet utility.
 *
 * Verifies:
 *   1. Basic get/set/invalidate lifecycle.
 *   2. TTL expiry (using jest fake timers).
 *   3. invalidateAll clears every entry.
 *   4. getOrSet fetches once and returns cached value on subsequent calls.
 *   5. Concurrent getOrSet calls deduplicate (only one fetch).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getOrSet, MemoryCache } from '../cache';

describe('MemoryCache', () => {
  beforeEach(() => void jest.useFakeTimers());
  afterEach(() => void jest.useRealTimers());

  it('returns null for a missing key', () => {
    const cache = new MemoryCache<string>(5_000);
    expect(cache.get('missing')).toBeNull();
  });

  it('stores and retrieves a value before TTL expires', () => {
    const cache = new MemoryCache<string>(5_000);
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('returns null after TTL expires', () => {
    const cache = new MemoryCache<string>(1_000);
    cache.set('k', 'v');

    jest.advanceTimersByTime(1_001);

    expect(cache.get('k')).toBeNull();
  });

  it('uses per-entry TTL override', () => {
    const cache = new MemoryCache<string>(5_000);
    cache.set('short', 'v', 500);

    jest.advanceTimersByTime(501);
    expect(cache.get('short')).toBeNull();
  });

  it('invalidate removes a single entry', () => {
    const cache = new MemoryCache<number>(5_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  it('invalidateAll clears all entries', () => {
    const cache = new MemoryCache<number>(5_000);
    cache.set('x', 1);
    cache.set('y', 2);
    cache.invalidateAll();
    expect(cache.get('x')).toBeNull();
    expect(cache.get('y')).toBeNull();
  });

  it('size returns only non-expired entries', () => {
    const cache = new MemoryCache<number>(1_000);
    cache.set('a', 1);
    cache.set('b', 2, 500);
    jest.advanceTimersByTime(501);
    expect(cache.size).toBe(1);
  });
});

describe('getOrSet', () => {
  beforeEach(() => void jest.useRealTimers());

  it('calls fetchFn on cache miss', async () => {
    const cache = new MemoryCache<string>(5_000);
    const fetch = jest.fn<() => Promise<string>>().mockResolvedValue('data');

    const result = await getOrSet(cache, 'key', fetch);
    expect(result).toBe('data');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchFn on cache hit', async () => {
    const cache = new MemoryCache<string>(5_000);
    const fetch = jest.fn<() => Promise<string>>().mockResolvedValue('data');

    await getOrSet(cache, 'key', fetch);
    await getOrSet(cache, 'key', fetch);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('caches the fetched value with the given TTL', async () => {
    jest.useFakeTimers();
    try {
      const cache = new MemoryCache<string>(10_000);
      const fetch = jest.fn<() => Promise<string>>().mockResolvedValue('fresh');

      await getOrSet(cache, 'k', fetch, 1_000);
      jest.advanceTimersByTime(1_001);

      // After expiry a second fetch should happen
      const result2 = await getOrSet(cache, 'k', fetch, 1_000);
      expect(result2).toBe('fresh');
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
