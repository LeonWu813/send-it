/**
 * Tests for beta-video-service (MOD-005).
 *
 * Tests behaviour — not implementation.
 * The Supabase singleton is mocked; no real network activity.
 *
 * AC-032: one BetaVideo attached to exactly one route (route_id).
 * AC-036: upload progress reported via onProgress callback.
 *
 * Upload pattern: expo-file-system File class → File.bytes() → Uint8Array
 *   → supabase.storage.upload(Uint8Array).
 * expo-file-system is mocked via moduleNameMapper → __mocks__/expo-file-system.js.
 * ExpoFile.prototype.bytes is spied on in beforeEach to return a known Uint8Array.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

import * as ExpoFileSystem from 'expo-file-system';
import { supabase } from '../../../lib/supabase';
import {
  fetchBetaVideosForRoute,
  uploadBetaVideo,
  getVideoSignedUrl,
  getThumbnailSignedUrl,
  reportBetaVideo,
} from '../beta-video-service';
import type { BetaVideo } from '../types';

// Access the File class from the expo-file-system mock. The moduleNameMapper routes
// 'expo-file-system' → __mocks__/expo-file-system.js which exports { File, ... }.
// We use the namespace import so prototype spying works regardless of Babel CJS interop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExpoFile = (ExpoFileSystem as any).File as { new (uri: string): unknown; prototype: { bytes: () => Promise<Uint8Array> } };

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const MOCK_VIDEO_ROW: BetaVideo = {
  id: 'vid-001',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/1234567890.mp4',
  thumbnail_url: 'user-001/route-001/1234567890_thumb.jpg',
  duration_seconds: 30,
  caption: 'Nice heel hook sequence',
  created_at: '2026-09-24T10:00:00Z',
  is_reported: false,
  report_dismissed: false,
  display_name: 'Test Climber',
  avatar_url: null,
};

describe('fetchBetaVideosForRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of BetaVideo rows on success', async () => {
    // Supabase chain: select → eq → or → order
    // The row returned by Supabase includes a nested `users` object which the
    // service flattens to display_name / avatar_url at the top level (AC-144).
    const rawRow = {
      ...MOCK_VIDEO_ROW,
      users: { display_name: 'Test Climber', avatar_url: null },
    };
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [rawRow], error: null }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    const result = await fetchBetaVideosForRoute('route-001');

    expect(result).toHaveLength(1);
    expect(result[0].route_id).toBe('route-001');
    expect(result[0].id).toBe('vid-001');
    // AC-144: display_name and avatar_url flattened from nested users object
    expect(result[0].display_name).toBe('Test Climber');
    expect(result[0].avatar_url).toBeNull();
  });

  it('returns an empty array when there are no videos', async () => {
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    const result = await fetchBetaVideosForRoute('route-001');

    expect(result).toHaveLength(0);
  });

  it('AC-142: uses the canonical exclusion predicate to filter reported videos', async () => {
    // Verify .or() is called with the canonical predicate (AC-142/AC-143).
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    (mockSupabase.from as jest.Mock).mockReturnValue(selectChain);

    await fetchBetaVideosForRoute('route-001');

    expect(selectChain.or).toHaveBeenCalledWith('is_reported.eq.false,report_dismissed.eq.true');
  });

  it('throws a user-facing error when Supabase returns an error', async () => {
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
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
    // Spy on ExpoFile.prototype.bytes to return a known Uint8Array.
    // [116, 101, 115, 116] = 'test' (4 bytes). This satisfies the
    // expo-file-system File.bytes() → Uint8Array → upload(Uint8Array) pattern.
    jest.spyOn(ExpoFile.prototype, 'bytes').mockResolvedValue(new Uint8Array([116, 101, 115, 116]));
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

  it('AC-032: uploads video then inserts row with route_id (Phase 1 — no separate thumbnail upload)', async () => {
    // Phase 1: only the video is uploaded; thumbnail_url is set to the video path.
    // Upload uses expo-file-system File.bytes() → Uint8Array → supabase.storage.upload(Uint8Array).
    const storageBucket = makeStorageMock();
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    const fromChain = makeFromMock({ data: MOCK_VIDEO_ROW, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(fromChain);

    const progressCalls: Array<{ percent: number }> = [];
    const result = await uploadBetaVideo(
      {
        route_id: 'route-001',
        localVideoUri: 'file:///path/to/video.mp4',
        localThumbnailUri: 'file:///path/to/video.mp4', // Phase 1: same as video URI
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
    // Phase 1: exactly one Storage upload call (video only — no separate thumbnail).
    // Second arg is the decoded Uint8Array; third arg carries contentType.
    expect(storageBucket.upload).toHaveBeenCalledTimes(1);
    expect(storageBucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.mp4$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'video/mp4' }),
    );
  });

  it('throws (no cleanup needed) when video upload fails', async () => {
    // Phase 1: only one upload — if it fails, nothing was stored, no cleanup needed.
    // Upload uses expo-file-system File.bytes() → Uint8Array → supabase.storage.upload(Uint8Array).
    const storageBucket = {
      upload: jest.fn().mockResolvedValue({ data: null, error: new Error('upload failed') }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageBucket);

    await expect(
      uploadBetaVideo(
        {
          route_id: 'route-001',
          localVideoUri: 'file:///path/to/video.mp4',
          localThumbnailUri: 'file:///path/to/video.mp4',
          duration_seconds: 30,
        },
        'user-001',
      ),
    ).rejects.toThrow('Failed to upload video');

    // No artifact was stored — remove should NOT have been called
    expect(storageBucket.remove).not.toHaveBeenCalled();
  });

  it('throws and cleans up video artifact when row insert fails', async () => {
    // Upload uses expo-file-system File.bytes() → Uint8Array → supabase.storage.upload(Uint8Array).
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
          localThumbnailUri: 'file:///path/to/video.mp4',
          duration_seconds: 30,
        },
        'user-001',
      ),
    ).rejects.toThrow('Failed to save beta video');

    // Cleanup: the video artifact should have been removed
    expect(storageBucket.remove).toHaveBeenCalled();
  });
});

describe('reportBetaVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AC-140: calls supabase.rpc with report_beta_video and the correct video ID', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    await reportBetaVideo('vid-001');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('report_beta_video', {
      p_beta_video_id: 'vid-001',
    });
  });

  it('AC-140: resolves without throwing on RPC success', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    await expect(reportBetaVideo('vid-001')).resolves.toBeUndefined();
  });

  it('throws a user-facing error when the RPC returns an error', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('not_authenticated'),
    });

    await expect(reportBetaVideo('vid-001')).rejects.toThrow(
      'Failed to report video',
    );
  });
});
