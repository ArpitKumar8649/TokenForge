/**
 * In-memory TTL cache utility with targeted cache busting.
 * Prevents hammering TiDB with redundant queries for settings,
 * configs, availability, and user metadata that rarely change.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

/**
 * Retrieves a cached value or executes the async loader to populate it.
 * @param key Cache key identifier
 * @param ttlMs Time-to-live in milliseconds
 * @param loader Async function that fetches data on cache miss
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = memoryStore.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await loader();
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * Retrieves a synchronously cached value if fresh, or returns undefined.
 */
export function getCachedSync<T>(key: string): T | undefined {
  const hit = memoryStore.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  return undefined;
}

/**
 * Manually sets a cached value with TTL.
 */
export function setCached<T>(key: string, value: T, ttlMs: number): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidates a specific key or all keys starting with prefix.
 */
export function bustCache(keyOrPrefix: string): void {
  for (const k of Array.from(memoryStore.keys())) {
    if (k === keyOrPrefix || k.startsWith(`${keyOrPrefix}:`) || k.startsWith(keyOrPrefix)) {
      memoryStore.delete(k);
    }
  }
}

/**
 * Clears the entire in-memory cache.
 */
export function clearAllMemoryCache(): void {
  memoryStore.clear();
}
