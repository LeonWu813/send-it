/**
 * Shared in-memory signed URL cache.
 *
 * Used by any service that calls Supabase Storage `createSignedUrl`.
 * Supabase signs URLs for 3600 seconds; this cache uses a 3300-second TTL
 * (55 minutes) to ensure callers always receive a URL with meaningful
 * remaining validity.
 *
 * Cache key format: `"<bucket>:<storagePath>"`
 * Max entries: 500 (FIFO eviction on overflow using Map insertion order).
 *
 * WARNING: If a file is ever deleted and re-uploaded at the exact same storage
 * path, the stale cache entry will be served until TTL expires. This pattern
 * does not occur in the current codebase — all uploads use unique paths.
 * If it is introduced, add an explicit `invalidate(bucket, path)` call at
 * the write site.
 */

const TTL_MS = 3300 * 1000; // 55 minutes
const MAX_ENTRIES = 500;

type CacheEntry = { signedUrl: string; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string>>();

/**
 * Returns a signed URL for the given bucket + storage path, using the cache
 * when possible.
 *
 * Logic:
 *  1. Cache hit (not expired) → return cached URL immediately.
 *  2. In-flight deduplication → return the existing Promise so all concurrent
 *     callers share a single network round-trip.
 *  3. Cache miss, no in-flight → call `fetcher`, store result, evict oldest
 *     entry if the cache exceeds MAX_ENTRIES.
 *  4. On `fetcher` rejection → remove the in-flight entry so the next caller
 *     retries rather than receiving a stale rejection.
 *
 * @param bucket    Supabase Storage bucket name (e.g. 'route-photos').
 * @param path      Storage path within the bucket (no leading slash).
 * @param fetcher   Zero-arg async function that calls `createSignedUrl` and
 *                  returns the signed URL string. Thrown errors propagate to
 *                  all callers sharing this in-flight request.
 * @returns         A signed URL string.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  const key = `${bucket}:${path}`;
  const now = Date.now();

  // 1. Cache hit — return immediately if entry exists and has not expired.
  const entry = cache.get(key);
  if (entry && now < entry.expiresAt) {
    return entry.signedUrl;
  }

  // 2. In-flight deduplication — join existing request if one is in progress.
  const pending = inFlight.get(key);
  if (pending) return pending;

  // 3. Cache miss, no in-flight — start a new network request.
  const request = fetcher()
    .then((signedUrl) => {
      cache.set(key, { signedUrl, expiresAt: Date.now() + TTL_MS });
      inFlight.delete(key);
      // FIFO eviction: Map iterates in insertion order; first key = oldest.
      if (cache.size > MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
      return signedUrl;
    })
    .catch((err: unknown) => {
      // Always clean up on error so future callers retry rather than receiving
      // the prior rejection.
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, request);
  return request;
}

/**
 * For test use only. Clears all cache and in-flight state.
 *
 * Must NOT be called in production code.
 */
export function clearCacheForTesting(): void {
  cache.clear();
  inFlight.clear();
}
