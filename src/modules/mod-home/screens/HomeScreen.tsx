/**
 * HomeScreen — Tab 1 content (AC-111 rev, AC-112, AC-113, AC-114, AC-115,
 *   AC-174, AC-175, AC-176, AC-177, AC-178, AC-181, AC-182, AC-189, AC-190,
 *   AC-191, AC-192).
 *
 * Four sections in order (AC-111):
 *   1. Events Banner (AC-112, AC-174) — single admin-managed banner from
 *      `admin_banners WHERE is_active = true LIMIT 1`; placeholder card shown
 *      when no active banner exists (section never hidden — AC-112 Rev 38).
 *   2. Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) — horizontal scroll
 *      strip ordered by most-recently-viewed via `user_route_visits` MAX
 *      `last_viewed_at` per gym; tapping navigates to RouteListScreen.
 *   3. Projecting Routes (AC-177, AC-178, AC-181) — sourced from `saved_routes`
 *      via MOD-003's fetchSavedRouteIds(); V-grade filter tabs; uses RouteCard
 *      with betaVideoCount (placeholder 0 until fetchBetaVideoCounts lands in
 *      MOD-003), hasSend/sendStyle from fetchUserAchievements (MOD-004),
 *      isSaved/onBookmarkToggle from saveRoute/unsaveRoute (MOD-003).
 *      hasNewBetaVideo chip removed (AC-181 Rev 39).
 *   4. Following Activity (AC-182, Rev 38) — followed user IDs via MOD-006's
 *      service; beta_videos grouped by uploader using updated_at (not created_at);
 *      avatar + display_name + "new video upload" label + MAX(updated_at)
 *      relative timestamp; no video count; tap → UserProfileScreen.
 *
 * Safe area:
 *   - Top inset NOT applied here — AppHeader (mounted by AppShell) owns the top.
 *   - Bottom inset handled by AppShell's TabBar.
 *
 * Cross-module imports (allowed per spec Integration Points):
 *   - fetchSavedRouteIds(), saveRoute(), unsaveRoute(), routes_with_new_beta RPC
 *     from mod-route-catalog
 *   - fetchUserAchievements() from mod-send-logging (AC-190)
 *   - fetchFollowing() from mod-social-feed (for followed user list)
 *   - RouteCard from src/components/RouteCard (app-level shared component)
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import RouteCard from '../../../components/RouteCard';
import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PressableScale } from '../../../components/ui/PressableScale';
import { useToast } from '../../../components/ui/Toast';
import { ICON } from '../../../lib/icons';
import { useMotion } from '../../../lib/motion';
import { supabase } from '../../../lib/supabase';
import { useLayout, useTheme } from '../../../lib/theme';
import { getGymInitials } from '../../mod-gym-directory/gym-initials';
import { fetchSavedRouteIds, saveRoute, unsaveRoute } from '../../mod-route-catalog/route-service';
import type { RouteGrade } from '../../mod-route-catalog/types';
import { fetchUserAchievements } from '../../mod-send-logging';
import { fetchFollowing } from '../../mod-social-feed/social-feed-service';
import type { FollowingUser } from '../../mod-social-feed/types';
import { useAppHeaderRoot } from '../components/AppHeaderContext';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cache TTL for `routes_with_new_beta` RPC results (milliseconds). */
const NEW_BETA_CACHE_TTL_MS = 60_000;

/** How many days back to look for "new" beta videos in the Following section. */
const FOLLOWING_ACTIVITY_DAYS = 14;

// ── Types ─────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  session: Session;
  /** True when the Home tab is active. Triggers re-fetch on tab switch. */
  isActive: boolean;
  onViewAllGyms: () => void;
  /** Called when a gym chip is tapped. Navigates to that gym's RouteListScreen. */
  onSelectGym: (gymId: string, gymName: string) => void;
  /** Called when a route card is tapped. Navigates to RouteDetailScreen. */
  onSelectRoute: (routeId: string, gymId: string) => void;
  /** Called when a following-activity row is tapped. Opens UserProfileScreen. */
  onSelectClimber: (userId: string) => void;
  /** Called when the notifications bell is tapped (no-op here; handled by AppHeader). */
  onNavigateToNotifications?: () => void;
}

/** Admin-managed Events Banner row. */
interface AdminBanner {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
}

/** Minimal gym shape for the saved-gyms strip. */
interface SavedGymItem {
  id: string;
  name: string;
  photo_url: string | null;
  /** Google Places cover photo (Rev 44). Null = initials avatar fallback. */
  cover_photo_url: string | null;
  /** MAX last_viewed_at for this gym from user_route_visits; null = no visits. */
  lastViewedAt: string | null;
}

/** Route row for the Projecting Routes section. */
interface ProjectingRoute {
  id: string;
  gym_id: string;
  grade: RouteGrade;
  color_tag: string;
  photo_url: string | null;
  section_label: string | null;
  gym_name: string | null;
}

/** Following-activity row per followed climber. */
interface FollowingActivity {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** ISO timestamp of the most-recent beta video activity (MAX updated_at). */
  latestAt: string | null;
}

// ── In-memory cache for routes_with_new_beta RPC ─────────────────────────────

interface NewBetaCache {
  /** Route IDs that have a new beta video (Set for O(1) lookup). */
  data: Set<string>;
  /** Timestamp when this cache entry was populated. */
  populatedAt: number;
  /**
   * Stable key derived from the route-id set this cache entry was computed for.
   * Formed by sorting the route IDs and joining with ','.
   * A cache hit is only valid when the current route-id set produces the same key.
   */
  routeIdsKey: string;
}

let newBetaCache: NewBetaCache | null = null;

/** Exported only for test use — clears the in-memory new-beta RPC cache. */
export function clearNewBetaCacheForTests(): void {
  newBetaCache = null;
}

function clearNewBetaCache(): void {
  newBetaCache = null;
}

// ── Relative timestamp helper ─────────────────────────────────────────────────

function relativeTime(
  isoDate: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diffDays === 0) return t('home.followingActivity.today');
  if (diffDays === 1) return t('home.followingActivity.dayAgo');
  return t('home.followingActivity.daysAgo', { count: diffDays });
}

// ── Grade filter helpers ──────────────────────────────────────────────────────

const ALL_GRADE_FILTER = 'ALL' as const;
type GradeFilter = typeof ALL_GRADE_FILTER | RouteGrade;

/** Capitalizes the first letter of a string (used for color_tag display). */
function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({
  session,
  isActive,
  onViewAllGyms,
  onSelectGym,
  onSelectRoute,
  onSelectClimber,
}: HomeScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { haptic } = useMotion();
  const toast = useToast();
  const c = theme.colors;
  const header = useAppHeaderRoot();
  const styles = makeStyles(theme, screenMargin, header.contentTopInset, header.contentBottomInset);

  // ── Section 1: Admin Events Banner ────────────────────────────────────────

  const [activeBanner, setActiveBanner] = useState<AdminBanner | null>(null);
  const [bannerLoading, setBannerLoading] = useState(true);

  const loadBanner = useCallback(async () => {
    setBannerLoading(true);
    const { data, error } = await supabase
      .from('admin_banners')
      .select('id, title, body, image_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[HomeScreen] loadBanner error:', error);
      setActiveBanner(null);
      setBannerLoading(false);
      return;
    }
    setActiveBanner((data as AdminBanner | null) ?? null);
    setBannerLoading(false);
  }, []);

  // ── Section 2: Saved Gyms ─────────────────────────────────────────────────

  const [savedGyms, setSavedGyms] = useState<SavedGymItem[]>([]);
  const [savedGymsLoading, setSavedGymsLoading] = useState(true);

  const loadSavedGyms = useCallback(async () => {
    setSavedGymsLoading(true);
    try {
      // Fetch saved gyms joined with gym details, and LEFT JOIN user_route_visits
      // to get the most-recently-viewed timestamp per gym (AC-175).
      // The join on user_route_visits uses routes' gym_id to aggregate recency.
      // When no visits exist, last_viewed_at is null — gym still appears (AC-175).
      const { data: savedRows, error: savedError } = await supabase
        .from('saved_gyms')
        .select('gym_id, gyms(id, name, photo_url, cover_photo_url)')
        .eq('user_id', session.user.id);

      if (savedError) {
        console.error('[HomeScreen] loadSavedGyms saved_gyms error:', savedError);
        setSavedGyms([]);
        return;
      }

      if (!savedRows || savedRows.length === 0) {
        setSavedGyms([]);
        return;
      }

      // Extract gym IDs for the recency query.
      const gymIds = (savedRows as unknown as Array<{ gym_id: string; gyms: { id: string; name: string; photo_url: string | null; cover_photo_url: string | null } | null }>)
        .filter((r) => r.gyms !== null)
        .map((r) => r.gym_id);

      // Fetch recency data: MAX(last_viewed_at) per gym via user_route_visits → routes.
      // This uses a raw SQL approach via RPC isn't available; instead we query
      // user_route_visits directly with a join to routes to get per-gym recency.
      let recencyMap: Map<string, string> = new Map();

      if (gymIds.length > 0) {
        const { data: visitRows, error: visitError } = await supabase
          .from('user_route_visits')
          .select('last_viewed_at, routes(gym_id)')
          .eq('user_id', session.user.id);

        if (!visitError && visitRows) {
          // Group by gym_id, take MAX last_viewed_at.
          for (const row of visitRows as unknown as Array<{ last_viewed_at: string; routes: { gym_id: string } | null }>) {
            if (!row.routes) continue;
            const gId = row.routes.gym_id;
            if (!gymIds.includes(gId)) continue;
            const existing = recencyMap.get(gId);
            if (existing === undefined || row.last_viewed_at > (existing ?? '')) {
              recencyMap.set(gId, row.last_viewed_at);
            }
          }
        }
        // On visitError: recencyMap stays empty — gyms still render, no ordering data.
      }

      // Build SavedGymItem list.
      const gymItems: SavedGymItem[] = (savedRows as unknown as Array<{
        gym_id: string;
        gyms: { id: string; name: string; photo_url: string | null; cover_photo_url: string | null } | null;
      }>)
        .filter((r) => r.gyms !== null)
        .map((r) => ({
          id: r.gyms!.id,
          name: r.gyms!.name,
          photo_url: r.gyms!.photo_url,
          cover_photo_url: r.gyms!.cover_photo_url,
          lastViewedAt: recencyMap.get(r.gym_id) ?? null,
        }));

      // Sort: gyms with recency data first (descending), then gyms without (AC-175).
      gymItems.sort((a, b) => {
        if (a.lastViewedAt === null && b.lastViewedAt === null) return 0;
        if (a.lastViewedAt === null) return 1;
        if (b.lastViewedAt === null) return -1;
        return b.lastViewedAt.localeCompare(a.lastViewedAt);
      });

      setSavedGyms(gymItems);
    } catch (err) {
      console.error('[HomeScreen] loadSavedGyms error:', err);
      setSavedGyms([]);
    } finally {
      setSavedGymsLoading(false);
    }
  }, [session.user.id]);

  // ── Section 3: Projecting Routes ──────────────────────────────────────────

  const [projectingRoutes, setProjectingRoutes] = useState<ProjectingRoute[]>([]);
  const [projectingLoading, setProjectingLoading] = useState(true);
  const [newBetaRouteIds, setNewBetaRouteIds] = useState<Set<string>>(new Set());
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter>(ALL_GRADE_FILTER);
  /**
   * Per-route achievement map: route_id → 'flash' | 'top' | 'attempt' (AC-190).
   * Fetched once per load via MOD-004's fetchUserAchievements.
   */
  const [achievementMap, setAchievementMap] = useState<Record<string, 'flash' | 'top' | 'attempt'>>({});
  /**
   * Set of saved route IDs for the Projecting Routes section (AC-046/047).
   * Used to derive isSaved per card. Mutated optimistically on bookmark toggle.
   */
  const [savedProjectingIds, setSavedProjectingIds] = useState<Set<string>>(new Set());

  const loadProjectingRoutes = useCallback(async () => {
    setProjectingLoading(true);
    try {
      // Step 1: Get saved route IDs via MOD-003's public service.
      const savedRouteIds = await fetchSavedRouteIds();

      if (savedRouteIds.length === 0) {
        setProjectingRoutes([]);
        setNewBetaRouteIds(new Set());
        setAchievementMap({});
        setSavedProjectingIds(new Set());
        return;
      }

      // Step 2: Fetch route details for the saved route IDs.
      const { data: routeRows, error: routeError } = await supabase
        .from('routes')
        .select('id, gym_id, grade, color_tag, photo_url, section_label, gyms!routes_gym_id_fkey(name)')
        .in('id', savedRouteIds)
        .eq('status', 'active');

      if (routeError) {
        console.error('[HomeScreen] loadProjectingRoutes routes error:', routeError);
        setProjectingRoutes([]);
        return;
      }

      const routes: ProjectingRoute[] = ((routeRows as unknown as Array<{
        id: string;
        gym_id: string;
        grade: RouteGrade;
        color_tag: string;
        photo_url: string | null;
        section_label: string | null;
        gyms: { name: string } | null;
      }>) ?? []).map((row) => ({
        id: row.id,
        gym_id: row.gym_id,
        grade: row.grade,
        color_tag: row.color_tag,
        photo_url: row.photo_url,
        section_label: row.section_label,
        gym_name: row.gyms?.name ?? null,
      }));
      setProjectingRoutes(routes);

      // All projecting routes are saved routes — initialize savedProjectingIds
      // from the saved route IDs that are still active (AC-046/047).
      const activeRouteIds = routes.map((r) => r.id);
      setSavedProjectingIds(new Set(activeRouteIds.filter((id) => savedRouteIds.includes(id))));

      // Step 3: Fetch user achievements for send badges (AC-190).
      // Batched once for all visible routes via MOD-004's fetchUserAchievements.
      if (activeRouteIds.length > 0) {
        try {
          const achievements = await fetchUserAchievements(activeRouteIds);
          setAchievementMap(achievements);
        } catch (achieveErr) {
          // Non-fatal: send badges not shown on failure.
          console.error('[HomeScreen] fetchUserAchievements error:', achieveErr);
          setAchievementMap({});
        }
      } else {
        setAchievementMap({});
      }

      // Step 4: Call routes_with_new_beta RPC (with in-memory cache, ~60s TTL).
      // Retained for AC-175 Saved Gyms ordering — not used for the card chip
      // (chip removed per AC-181 Rev 39). Cache keyed by route-id set + time.
      const now = Date.now();
      const currentRouteIdsKey = savedRouteIds.slice().sort().join(',');
      if (
        newBetaCache !== null &&
        newBetaCache.routeIdsKey === currentRouteIdsKey &&
        now - newBetaCache.populatedAt < NEW_BETA_CACHE_TTL_MS
      ) {
        // Cache still valid for the same route-id set — reuse.
        setNewBetaRouteIds(newBetaCache.data);
      } else {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'routes_with_new_beta',
          { route_ids: savedRouteIds },
        );

        if (rpcError) {
          console.error('[HomeScreen] routes_with_new_beta RPC error:', rpcError);
          setNewBetaRouteIds(new Set());
        } else {
          const ids = new Set<string>(
            ((rpcData as Array<{ route_id: string }>) ?? []).map((r) => r.route_id),
          );
          newBetaCache = { data: ids, populatedAt: now, routeIdsKey: currentRouteIdsKey };
          setNewBetaRouteIds(ids);
        }
      }
    } catch (err) {
      console.error('[HomeScreen] loadProjectingRoutes error:', err);
      setProjectingRoutes([]);
    } finally {
      setProjectingLoading(false);
    }
  }, []);

  // ── Section 4: Following Activity ─────────────────────────────────────────

  const [followingActivity, setFollowingActivity] = useState<FollowingActivity[]>([]);
  const [followingLoading, setFollowingLoading] = useState(true);

  const loadFollowingActivity = useCallback(async () => {
    setFollowingLoading(true);
    try {
      // Step 1: Get followed users via MOD-006's public service (block-filtered).
      const followingUsers: FollowingUser[] = await fetchFollowing(session.user.id);

      if (followingUsers.length === 0) {
        setFollowingActivity([]);
        return;
      }

      const followedIds = followingUsers.map((u) => u.id);

      // Step 2: Query beta_videos for followed users in the last 14 days.
      // Batched single query — no N+1 per user.
      const cutoff = new Date(
        Date.now() - FOLLOWING_ACTIVITY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: betaRows, error: betaError } = await supabase
        .from('beta_videos')
        .select('user_id, updated_at')
        .in('user_id', followedIds)
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false });

      if (betaError) {
        console.error('[HomeScreen] loadFollowingActivity beta_videos error:', betaError);
        setFollowingActivity([]);
        return;
      }

      // Step 3: Group by uploader to get MAX updated_at per climber (AC-182/AC-188).
      // Rows are already ordered by updated_at DESC, so the first row per user_id is
      // already the latest — but we iterate all rows for correctness.
      const activityMap = new Map<string, { latestAt: string }>();
      for (const row of (betaRows as Array<{ user_id: string; updated_at: string }>) ?? []) {
        const existing = activityMap.get(row.user_id);
        if (existing) {
          if (row.updated_at > existing.latestAt) {
            existing.latestAt = row.updated_at;
          }
        } else {
          activityMap.set(row.user_id, { latestAt: row.updated_at });
        }
      }

      // Step 4: Build the activity list — dedup by user (already done via activityMap),
      // sort by latest upload date descending, then cap at 10 (AC-182).
      const activities: FollowingActivity[] = followingUsers
        .filter((u) => activityMap.has(u.id))
        .map((u) => {
          const entry = activityMap.get(u.id)!;
          return {
            userId: u.id,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            latestAt: entry.latestAt,
          };
        })
        // Sort descending by latestAt (most recent first). Null entries go last.
        .sort((a, b) => {
          if (a.latestAt === null && b.latestAt === null) return 0;
          if (a.latestAt === null) return 1;
          if (b.latestAt === null) return -1;
          return b.latestAt.localeCompare(a.latestAt);
        })
        // Cap at 10 entries.
        .slice(0, 10);

      setFollowingActivity(activities);
    } catch (err) {
      console.error('[HomeScreen] loadFollowingActivity error:', err);
      setFollowingActivity([]);
    } finally {
      setFollowingLoading(false);
    }
  }, [session.user.id]);

  // ── Load all sections on mount ─────────────────────────────────────────────

  useEffect(() => {
    void loadBanner();
    void loadSavedGyms();
    void loadProjectingRoutes();
    void loadFollowingActivity();
  }, [loadBanner, loadSavedGyms, loadProjectingRoutes, loadFollowingActivity]);

  // ── Re-fetch on tab activation (keep-alive mount pattern) ─────────────────

  useEffect(() => {
    if (isActive) {
      void loadBanner();
      void loadSavedGyms();
      void loadProjectingRoutes();
      void loadFollowingActivity();
    }
  }, [isActive, loadBanner, loadSavedGyms, loadProjectingRoutes, loadFollowingActivity]);

  // ── Clear cache on sign-out (auth-clear convention) ───────────────────────

  const prevUserIdRef = useRef<string | null>(session.user.id);
  useEffect(() => {
    if (prevUserIdRef.current !== session.user.id) {
      clearNewBetaCache();
      prevUserIdRef.current = session.user.id;
    }
  }, [session.user.id]);

  // ── Derived: available grades + filtered projecting routes ───────────────

  const availableGrades = useMemo<GradeFilter[]>(() => {
    const grades = [...new Set(projectingRoutes.map((r) => r.grade))].sort();
    return [ALL_GRADE_FILTER, ...grades];
  }, [projectingRoutes]);

  const filteredRoutes = useMemo(() => {
    if (selectedGrade === ALL_GRADE_FILTER) return projectingRoutes;
    return projectingRoutes.filter((r) => r.grade === selectedGrade);
  }, [projectingRoutes, selectedGrade]);

  // ── Bookmark toggle (optimistic, reverts + error toast on failure) ─────────

  function toggleProjectingBookmark(routeId: string): void {
    const isCurrentlySaved = savedProjectingIds.has(routeId);
    // Optimistic update.
    setSavedProjectingIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
    // Persist to backend; revert on failure.
    const persist = isCurrentlySaved ? unsaveRoute(routeId) : saveRoute(routeId);
    persist.catch(() => {
      setSavedProjectingIds((prev) => {
        const revert = new Set(prev);
        if (isCurrentlySaved) {
          revert.add(routeId);
        } else {
          revert.delete(routeId);
        }
        return revert;
      });
      haptic('error', `bookmark-${routeId}`);
      toast.show({ message: t('home.projectingRoutes.bookmarkFailed'), tone: 'error' });
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const sectionHeader = (title: string, action?: React.ReactNode): React.JSX.Element => (
    <View style={styles.sectionHeader}>
      <AppText variant="pageSection" accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );

  return (
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollIndicatorInsets={{ top: header.contentTopInset, bottom: header.indicatorBottomInset }}
      onScroll={header.onScroll}
      onContentSizeChange={header.onContentSizeChange}
      onLayout={header.onLayout}
      scrollEventThrottle={header.scrollEventThrottle}
    >
      {/* ── Section 1: Events Banner (AC-112, AC-174) ─────────────────── */}
      {/* Section is NEVER hidden in Phase 1 (AC-112 Rev 38). When no active    */}
      {/* banner exists (and loading is complete), a placeholder card is shown. */}
      <View style={styles.section}>
        {!bannerLoading && activeBanner === null ? (
          <Card variant="static" style={styles.bannerPlaceholderCard}>
            <AppText variant="subhead" color="textSecondary" align="center">
              {t('home.banner.noEvents')}
            </AppText>
          </Card>
        ) : (
          activeBanner !== null && (
            <View style={styles.bannerCard}>
              {activeBanner.image_url !== null ? (
                <Image
                  source={{ uri: activeBanner.image_url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                  accessibilityLabel={activeBanner.title}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.bannerImagePlaceholder} />
              )}
              <View style={styles.bannerOverlay}>
                <AppText variant="headline" color="onMedia">
                  {activeBanner.title}
                </AppText>
                {activeBanner.body.length > 0 && (
                  <AppText variant="subhead" color="onMedia" numberOfLines={2}>
                    {activeBanner.body}
                  </AppText>
                )}
              </View>
            </View>
          )
        )}
      </View>

      {/* ── Section 2: Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) */}
      <View style={styles.section}>
        {sectionHeader(
          t('home.savedGyms.title'),
          <Button
            variant="ghost"
            size="sm"
            on="background"
            label={t('home.savedGyms.viewAll')}
            onPress={onViewAllGyms}
          />,
        )}

        {!savedGymsLoading && savedGyms.length === 0 ? (
          <EmptyState variant="inline" description={t('home.savedGyms.empty')} style={styles.inset} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gymStripRow}
          >
            {savedGyms.map((gym) => (
              <Pressable
                key={gym.id}
                style={styles.gymChip}
                onPress={() => onSelectGym(gym.id, gym.name)}
                accessibilityRole="button"
                accessibilityLabel={gym.name}
              >
                {gym.cover_photo_url !== null ? (
                  <Image
                    source={{ uri: gym.cover_photo_url }}
                    style={styles.gymChipImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.gymChipInitialsAvatar}>
                    <AppText variant="caption1" color="textSecondary">
                      {getGymInitials(gym.name)}
                    </AppText>
                  </View>
                )}
                <AppText variant="caption1" align="center" numberOfLines={2}>
                  {gym.name}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Section 3: Projecting Routes (AC-177, AC-178, AC-181) ─────── */}
      <View style={styles.section}>
        {sectionHeader(t('home.projectingRoutes.title'))}

        {/* Grade filter chips (AC-178): single choice */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradeTabsRow}
          accessibilityRole="radiogroup"
        >
          {availableGrades.map((grade) => (
            <Chip
              key={grade}
              variant="choice"
              label={grade === ALL_GRADE_FILTER ? t('home.projectingRoutes.allGrades') : grade}
              selected={selectedGrade === grade}
              onPress={() => setSelectedGrade(grade)}
            />
          ))}
        </ScrollView>

        {!projectingLoading && projectingRoutes.length === 0 ? (
          <EmptyState variant="inline" description={t('home.projectingRoutes.empty')} style={styles.inset} />
        ) : !projectingLoading && filteredRoutes.length === 0 ? (
          <EmptyState variant="inline" description={t('home.projectingRoutes.emptyFiltered')} style={styles.inset} />
        ) : (
          <View style={styles.routeList}>
            {filteredRoutes.map((route) => {
              const achievement = achievementMap[route.id];
              const hasSend = achievement === 'flash' || achievement === 'top';
              const sendStyle: 'flash' | 'top' | null =
                achievement === 'flash' ? 'flash' :
                achievement === 'top' ? 'top' :
                null;
              return (
                <RouteCard
                  key={route.id}
                  route={{
                    id: route.id,
                    name: `${route.grade} ${capitalize(route.color_tag)}${route.section_label ? ` (${route.section_label})` : ''}`,
                    grade: route.grade,
                    section: route.section_label,
                    photo_url: route.photo_url,
                    gymName: route.gym_name ?? undefined,
                    colorTag: route.color_tag,
                  }}
                  onPress={() => onSelectRoute(route.id, route.gym_id)}
                  // TODO: replace with fetchBetaVideoCounts once MOD-003 migration is shipped (AC-189)
                  betaVideoCount={0}
                  hasSend={hasSend}
                  sendStyle={sendStyle}
                  isSaved={savedProjectingIds.has(route.id)}
                  onBookmarkToggle={() => toggleProjectingBookmark(route.id)}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ── Section 4: Following Activity (AC-182) ─────────────────────── */}
      <View style={styles.section}>
        {sectionHeader(t('home.followingActivity.title'))}

        {!followingLoading && followingActivity.length === 0 ? (
          <EmptyState variant="inline" description={t('home.followingActivity.empty')} style={styles.inset} />
        ) : (
          <View style={styles.activityList}>
            {followingActivity.map((item, index) => (
              <PressableScale
                key={item.userId}
                feedback="row"
                inScroll
                pressedColor={c.surfacePressed}
                style={[
                  styles.activityRow,
                  index < followingActivity.length - 1 && styles.activityRowDivider,
                ]}
                onPress={() => onSelectClimber(item.userId)}
                accessibilityRole="button"
                accessibilityLabel={item.displayName}
              >
                <Avatar size="md" uri={item.avatarUrl} name={item.displayName} decorative />

                {/* Info */}
                <View style={styles.activityInfo}>
                  <AppText variant="headline" numberOfLines={1}>
                    {item.displayName}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {t('home.following.newUpload')}
                  </AppText>
                  {item.latestAt !== null && (
                    <AppText variant="caption1" color="textSecondary">
                      {relativeTime(item.latestAt, t)}
                    </AppText>
                  )}
                </View>
              </PressableScale>
            ))}
          </View>
        )}
      </View>
    </Animated.ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  screenMargin: number,
  topInset: number,
  bottomInset: number,
) {
  const c = theme.colors;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    contentContainer: {
      // The large title floats over the list (AppHeader overlay); the TabBar floats over the bottom.
      paddingTop: topInset,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.xl,
    },
    section: {
      marginBottom: theme.layout.sectionGap,
    },
    inset: {
      paddingHorizontal: screenMargin,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.layout.minTouchTarget,
      paddingHorizontal: screenMargin,
      marginBottom: theme.layout.sectionHeaderGap,
    },
    // ── Banner ──────────────────────────────────────────────────────────────
    bannerPlaceholderCard: {
      marginHorizontal: screenMargin,
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerCard: {
      marginHorizontal: screenMargin,
      height: 160,
      borderRadius: theme.radius.card,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: c.surfaceAlt,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    bannerImagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: c.surfaceAlt,
    },
    bannerOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.overlay,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    // ── Saved Gyms ──────────────────────────────────────────────────────────
    gymStripRow: {
      paddingHorizontal: screenMargin,
      columnGap: theme.layout.inlineGap,
    },
    gymChip: {
      width: 96,
      alignItems: 'center',
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
      paddingBottom: theme.spacing.xs,
    },
    gymChipImage: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
      marginBottom: theme.spacing.xs,
    },
    gymChipInitialsAvatar: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xs,
    },
    // ── Grade filter chips ──────────────────────────────────────────────────
    gradeTabsRow: {
      paddingHorizontal: screenMargin,
      // Chips carry 6pt hitSlop above and below: leave room so the ScrollView does not clip it.
      paddingVertical: theme.spacing.sm,
      columnGap: theme.layout.inlineGap,
    },
    // ── Projecting Routes ────────────────────────────────────────────────────
    routeList: {
      paddingHorizontal: screenMargin,
      rowGap: theme.layout.cardGap,
    },
    // ── Following Activity ───────────────────────────────────────────────────
    activityList: {
      marginHorizontal: screenMargin,
      backgroundColor: c.surface,
      borderRadius: theme.radius.card,
      borderCurve: 'continuous',
      overflow: 'hidden',
      borderWidth: theme.isDark ? theme.stroke.thin : 0,
      borderColor: c.border,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.spacing.smd,
      minHeight: theme.layout.minTouchTarget,
      paddingHorizontal: theme.layout.cardPadding,
      paddingVertical: theme.layout.listRowPaddingV,
    },
    activityRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    activityInfo: {
      flex: 1,
    },
  });
}
