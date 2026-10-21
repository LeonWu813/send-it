/**
 * useLikeState — like/unlike async state machine for a single beta video (AC-052).
 *
 * Fetches like info from `get_like_info` RPC when the videoId or visibility
 * changes. Exposes an optimistic toggleLike handler with server-side
 * reconciliation and automatic revert on error.
 *
 * @param videoId  - ID of the currently-displayed video, or null when no video.
 * @param visible  - Whether the reel viewer is currently visible.
 * @param indexKey - A value that changes when the active index changes; used as
 *                   a dependency for the reset effect so stale state from the
 *                   previous video is cleared before the new fetchLikeInfo
 *                   response arrives. Pass `currentIndex` from the caller.
 */

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { fetchLikeInfo, likeBetaVideo, unlikeBetaVideo } from '../../mod-social-feed';

export interface LikeState {
  /** Whether the current user has liked this video. */
  liked: boolean;
  /** Total like count for this video. */
  likeCount: number;
  /** Whether a like/unlike request is in flight (prevents double-tap). */
  pending: boolean;
  /** Toggle the like state. Optimistic update with server reconciliation. */
  toggleLike: () => Promise<void>;
}

export function useLikeState(
  videoId: string | null,
  visible: boolean,
  indexKey: number,
): LikeState {
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [pending, setPending] = useState<boolean>(false);

  // Reset like UI state when the active index changes to avoid stale display
  // between the index change and the new fetchLikeInfo response.
  useEffect(() => {
    setLiked(false);
    setLikeCount(0);
    setPending(false);
  }, [indexKey]);

  // Fetch like info whenever the active video changes or visibility changes.
  useEffect(() => {
    if (!visible || videoId === null) return;

    let cancelled = false;
    fetchLikeInfo(videoId)
      .then(({ like_count, user_has_liked }) => {
        if (cancelled) return;
        setLikeCount(like_count);
        setLiked(user_has_liked);
      })
      .catch(() => {
        // Non-fatal: keep whatever state was already showing.
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, visible, indexKey]);

  const toggleLike = useCallback(async (): Promise<void> => {
    if (pending || videoId === null) return;

    // Optimistic update.
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);
    setPending(true);

    try {
      if (wasLiked) {
        await unlikeBetaVideo(videoId);
      } else {
        await likeBetaVideo(videoId);
      }
      // Re-fetch authoritative count from DB after mutation.
      const { like_count, user_has_liked } = await fetchLikeInfo(videoId);
      setLikeCount(like_count);
      setLiked(user_has_liked);
    } catch {
      // Revert optimistic update on error.
      setLiked(wasLiked);
      setLikeCount(prevCount);
    } finally {
      setPending(false);
    }
  }, [pending, liked, likeCount, videoId]);

  return { liked, likeCount, pending, toggleLike };
}
