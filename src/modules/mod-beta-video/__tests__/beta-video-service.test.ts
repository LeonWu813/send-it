/**
 * Tests for beta-video-service (MOD-005).
 *
 * Tests behaviour — not implementation.
 * The Supabase singleton is mocked; no real network activity.
 *
 * AC-032: one BetaVideo attached to exactly one route (route_id).
 * AC-036: upload progress reported via onProgress callback.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

// Mock global fetch for uriToBlob
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jest global setup
(globalThis as any).fetch = jest.fn();

import { supabase } from '../../../lib/supabase';
import {
  fetchBetaVideosForRoute,
  uploadBetaVideo,
  getVideoSignedUrl,
  getThumbnailSignedUrl,
} from '../beta-video-service';
import type { BetaVideo } from '../types';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jest global setup
const mockFetch = (globalThis as any).fetch as jest.MockedFunction<typeof fetch>;

const MOCK_VIDEO_ROW: BetaVideo = {
  id: 'vid-001',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/1234567890.mp4',
  thumbnail_url: 'user-001/route-001/1234567890_thumb.jpg',
  duration_seconds: 30,
  caption: 'Nice heel hook sequence',
  created_at: '2026-09-24T10:00:00Z',
};

describe('fetchBetaVideosForRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of BetaVideo rows on success', async () => {
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [MOCK_VIDEO_ROW], error: null }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    const result = await fetchBetaVideosForRoute('route-001');

    expect(result).toHaveLength(1);
    expect(result[0].route_id).toBe('route-001');
    expect(result[0].id).toBe('vid-001');
  });

  it('returns an empty array when there are no videos', async () => {
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    const result = await fetchBetaVideosForRoute('route-001');

    expect(result).toHaveLength(0);
  });

  it('throws a user-facing error when Supabase returns an error', async () => {
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    await expect(fetchBetaVideosForRoute('route-001')).rejects.toThrow(
      'Failed to load beta videos',
    );
  });
});

describe('getVideoSignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a signed URL on success', async () => {
    const storageBucket = {
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.example.com/video.mp4?token=abc' },
        error: null,
      }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    const url = await getVideoSignedUrl('user-001/route-001/video.mp4');

    expect(url).toBe('https://signed.example.com/video.mp4?token=abc');
    expect(storageBucket.createSignedUrl).toHaveBeenCalledWith(
      'user-001/route-001/video.mp4',
      3600,
    );
  });

  it('throws when Supabase returns an error', async () => {
    const storageBucket = {
      createSignedUrl: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('storage error'),
      }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    await expect(getVideoSignedUrl('user-001/route-001/video.mp4')).rejects.toThrow(
      'Failed to generate video URL',
    );
  });
});

describe('getThumbnailSignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a signed URL on success', async () => {
    const storageBucket = {
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.example.com/thumb.jpg?token=abc' },
        error: null,
      }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    const url = await getThumbnailSignedUrl('user-001/route-001/thumb.jpg');

    expect(url).toBe('https://signed.example.com/thumb.jpg?token=abc');
  });

  it('throws when Supabase returns an error', async () => {
    const storageBucket = {
      createSignedUrl: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('storage error'),
      }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    await expect(getThumbnailSignedUrl('user-001/route-001/thumb.jpg')).rejects.toThrow(
      'Failed to generate thumbnail URL',
    );
  });
});

describe('uploadBetaVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeStorageMock({
    uploadError = null,
    removeResult = { data: null, error: null },
  }: {
    uploadError?: Error | null;
    removeResult?: { data: unknown; error: unknown };
  } = {}) {
    return {
      upload: jest.fn().mockResolvedValue({ data: {}, error: uploadError }),
      remove: jest.fn().mockResolvedValue(removeResult),
    };
  }

  function makeFromMock(insertResult: { data: BetaVideo | null; error: Error | null }) {
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(insertResult),
    };
  }

  it('AC-032: uploads video + thumbnail then inserts row with route_id', async () => {
    // fetch mock: returns a blob for both video and thumbnail URIs
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['video-data'], { type: 'video/mp4' }),
    } as Response);

    const storageBucket = makeStorageMock();
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    const fromChain = makeFromMock({ data: MOCK_VIDEO_ROW, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(fromChain);

    const progressCalls: Array<{ percent: number }> = [];
    const result = await uploadBetaVideo(
      {
        route_id: 'route-001',
        localVideoUri: 'file:///path/to/video.mp4',
        localThumbnailUri: 'file:///path/to/thumb.jpg',
        duration_seconds: 30,
      },
      'user-001',
      (prog) => progressCalls.push(prog),
    );

    expect(result.route_id).toBe('route-001');
    expect(result.id).toBe('vid-001');
    // AC-036: progress was reported
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1].percent).toBe(100);
  });

  it('throws and cleans up thumbnail when video upload fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['data'], { type: 'video/mp4' }),
    } as Response);

    const storageBucket = {
      upload: jest
        .fn()
        // First call (thumbnail) succeeds, second call (video) fails
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('upload failed') }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    await expect(
      uploadBetaVideo(
        {
          route_id: 'route-001',
          localVideoUri: 'file:///path/to/video.mp4',
          localThumbnailUri: 'file:///path/to/thumb.jpg',
          duration_seconds: 30,
        },
        'user-001',
      ),
    ).rejects.toThrow('Failed to upload video');

    // Cleanup: thumbnail should have been removed
    expect(storageBucket.remove).toHaveBeenCalled();
  });

  it('throws and cleans up both artifacts when row insert fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['data'], { type: 'video/mp4' }),
    } as Response);

    const storageBucket = {
      upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    const fromChain = makeFromMock({ data: null, error: new Error('insert failed') });
    (mockSupabase.from as jest.Mock).mockReturnValue(fromChain);

    await expect(
      uploadBetaVideo(
        {
          route_id: 'route-001',
          localVideoUri: 'file:///path/to/video.mp4',
          localThumbnailUri: 'file:///path/to/thumb.jpg',
          duration_seconds: 30,
        },
        'user-001',
      ),
    ).rejects.toThrow('Failed to save beta video');

    // Cleanup: both artifacts should have been removed
    expect(storageBucket.remove).toHaveBeenCalled();
  });
});
