/**
 * Tests for src/lib/signedUrlCache.ts
 *
 * Covers: cache hit, TTL expiry, in-flight deduplication, error propagation,
 * FIFO eviction at MAX_ENTRIES, and bucket isolation.
 */

import { clearCacheForTesting, getSignedUrl } from '../signedUrlCache';

describe('signedUrlCache', () => {
  beforeEach(() => {
    clearCacheForTesting();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Cache hit ────────────────────────────────────────────────────────────────

  it('calls fetcher only once for two requests to the same key (cache hit)', async () => {
    const fetcher = jest.fn().mockResolvedValue('https://signed.url/photo.jpg');

    const first = await getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    const second = await getSignedUrl('route-photos', 'user/photo.jpg', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toBe('https://signed.url/photo.jpg');
    expect(second).toBe('https://signed.url/photo.jpg');
  });

  // ── TTL expiry ───────────────────────────────────────────────────────────────

  it('calls fetcher again after advancing fake timers past 3300 seconds (TTL expiry)', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce('https://signed.url/first.jpg')
      .mockResolvedValueOnce('https://signed.url/second.jpg');

    const first = await getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toBe('https://signed.url/first.jpg');

    // Advance past TTL (3300 seconds = 3,300,000 ms).
    jest.advanceTimersByTime(3300 * 1000 + 1);

    const second = await getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second).toBe('https://signed.url/second.jpg');
  });

  // ── In-flight deduplication ───────────────────────────────────────────────────

  it('invokes fetcher exactly once for two concurrent calls to the same key', async () => {
    let resolveFirst!: (url: string) => void;
    const inflightPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const fetcher = jest.fn().mockReturnValue(inflightPromise);

    const p1 = getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    const p2 = getSignedUrl('route-photos', 'user/photo.jpg', fetcher);

    // Fetcher must have been called exactly once even though two calls are in
    // progress — the second call joins the in-flight Promise.
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFirst('https://signed.url/dedup.jpg');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('https://signed.url/dedup.jpg');
    expect(r2).toBe('https://signed.url/dedup.jpg');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // ── Error path ───────────────────────────────────────────────────────────────

  it('propagates rejection to all callers and clears in-flight so next call retries', async () => {
    const error = new Error('signing failed');
    let rejectFirst!: (err: unknown) => void;
    const inflightPromise = new Promise<string>((_res, rej) => {
      rejectFirst = rej;
    });
    const fetcher = jest
      .fn()
      .mockReturnValueOnce(inflightPromise)
      .mockResolvedValueOnce('https://signed.url/retry.jpg');

    const p1 = getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    const p2 = getSignedUrl('route-photos', 'user/photo.jpg', fetcher);

    rejectFirst(error);

    await expect(p1).rejects.toThrow('signing failed');
    await expect(p2).rejects.toThrow('signing failed');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // In-flight entry must be cleared — next call should retry (fetcher called again).
    const result = await getSignedUrl('route-photos', 'user/photo.jpg', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe('https://signed.url/retry.jpg');
  });

  // ── FIFO eviction at MAX_ENTRIES (500) ────────────────────────────────────────

  it('evicts the oldest entry when the 501st entry is inserted (FIFO)', async () => {
    const MAX_ENTRIES = 500;

    // Fill the cache to exactly MAX_ENTRIES distinct keys.
    for (let i = 0; i < MAX_ENTRIES; i++) {
      const fetcher = jest.fn().mockResolvedValue(`https://signed.url/${i}.jpg`);
      await getSignedUrl('route-photos', `user/path-${i}.jpg`, fetcher);
    }

    // The first-inserted key must still be present.
    const fetcherFirst = jest.fn().mockResolvedValue('https://signed.url/0-new.jpg');
    await getSignedUrl('route-photos', 'user/path-0.jpg', fetcherFirst);
    // path-0 was cached — fetcher must NOT be called (cache hit).
    expect(fetcherFirst).not.toHaveBeenCalled();

    // Insert the 501st unique entry — this should evict path-0.
    const fetcherNew = jest.fn().mockResolvedValue('https://signed.url/501.jpg');
    await getSignedUrl('route-photos', 'user/path-500.jpg', fetcherNew);
    expect(fetcherNew).toHaveBeenCalledTimes(1);

    // path-0 was the oldest; it should have been evicted — fetcher called again.
    const fetcherEvicted = jest.fn().mockResolvedValue('https://signed.url/0-after-eviction.jpg');
    await getSignedUrl('route-photos', 'user/path-0.jpg', fetcherEvicted);
    expect(fetcherEvicted).toHaveBeenCalledTimes(1);
  });

  // ── Bucket isolation ─────────────────────────────────────────────────────────

  it('treats the same path in different buckets as distinct cache entries', async () => {
    const fetcherA = jest.fn().mockResolvedValue('https://signed.url/route-photo.jpg');
    const fetcherB = jest.fn().mockResolvedValue('https://signed.url/beta-video.jpg');

    const resultA = await getSignedUrl('route-photos', 'user/shared-path.jpg', fetcherA);
    const resultB = await getSignedUrl('beta-videos', 'user/shared-path.jpg', fetcherB);

    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
    expect(resultA).toBe('https://signed.url/route-photo.jpg');
    expect(resultB).toBe('https://signed.url/beta-video.jpg');

    // Second call to each bucket should hit the cache — no additional fetcher calls.
    await getSignedUrl('route-photos', 'user/shared-path.jpg', fetcherA);
    await getSignedUrl('beta-videos', 'user/shared-path.jpg', fetcherB);
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });
});
