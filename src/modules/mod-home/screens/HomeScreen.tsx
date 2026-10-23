/**
 * HomeScreen — Tab 1 content (AC-111 rev, AC-112, AC-113, AC-114, AC-115,
 *   AC-174, AC-175, AC-176, AC-177, AC-178, AC-181, AC-182, AC-189, AC-190,
 *   AC-191, AC-192).
 *
 * Four sections in order (AC-111, restored by home-v2: banner, Saved Gyms, Projecting, Following).
 * The scroll container owns the margin and the gaps (R0). Everything is flat on `background`.
 *   1. Events Banner (AC-112, AC-174) — single admin-managed banner from
 *      `admin_banners WHERE is_active = true LIMIT 1`; flat 52pt centred placeholder card shown
 *      when no active banner exists (section never hidden — AC-112 Rev 38).
 *   2. Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) — horizontal scroll
 *      strip of 64pt tiles ordered by most-recently-viewed via `user_route_visits` MAX
 *      `last_viewed_at` per gym; tapping navigates to RouteListScreen.
 *   3. Projecting Routes (AC-177, AC-178, AC-181) — sourced from `saved_routes`
 *      via MOD-003's fetchSavedRouteIds(); V-grade filter tabs; uses RouteCard
 *      with betaVideoCount (placeholder 0 until fetchBetaVideoCounts lands in
 *      MOD-003), grade chips only when >= 2 grades (AC-177), hasSend/sendStyle from fetchUserAchievements (MOD-004),
 *      isSaved/onBookmarkToggle from saveRoute/unsaveRoute (MOD-003).
 *      hasNewBetaVideo chip removed (AC-181 Rev 39).
 *   4. Following (AC-182, home-v2) — avatar strip like Saved Gyms: 64pt avatar + 2-line caption
 *      (name, MAX(updated_at) relative time), 108pt, no marker; tap → UserProfileScreen; 「查看全部」 →
 *      FollowingListScreen. At fontScale >= 1.6 the strip becomes 52pt vertical rows.
 *      Empty states of all sections: inline sentence + optional ghost sm action 8pt below.
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
 *
 * Data-access layer:
 *   - Saved Gyms query and Projecting Routes query are extracted to home-service.ts.
 *   - The in-memory new-beta RPC cache singleton lives in home-service.ts (not here).
 */

import type { Session } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import RouteCard from '../../../components/RouteCard';
import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { PressableScale } from '../../../components/ui/PressableScale';
import { useToast } from '../../../components/ui/Toast';
import { useMotion } from '../../../lib/motion';
import { supabase } from '../../../lib/supabase';
import { useLayout, useTheme } from '../../../lib/theme';
import { fetchSavedRouteIds, saveRoute, unsaveRoute } from '../../mod-route-catalog';
import type { RouteGrade } from '../../mod-route-catalog';
import { fetchUserAchievements } from '../../mod-send-logging';
import { fetchFollowing } from '../../mod-social-feed';
import type { FollowingUser } from '../../mod-social-feed';
import { useAppHeaderRoot } from '../components/AppHeaderContext';
import {
  clearCache,
  fetchSavedGym,
  fetchProjectingRoutes,
  fetchRoutesWithNewBeta,
} from '../home-service';
import type { SavedGymItem, ProjectingRoute } from '../home-service';

// ── Constants ─────────────────────────────────────────────────────────────────

/** How many days back to look for "new" beta videos in the Following section. */
const FOLLOWING_ACTIVITY_DAYS = 14;
/** Fixed caption box under a strip tile: 2 x footnote 20 (both strips are 108pt). */
const CAPTION_HEIGHT = 40;
/** Font scale from which the Following strip becomes vertical rows (home-v2 2.2). */
const AX_FONT_SCALE = 1.6;
/** Section-header action target: 22pt line + 11 + 11 = 44pt; layout never changes. */
const LINK_HIT_SLOP = { top: 11, bottom: 11, left: 8, right: 0 };
/** Skeleton tiles while Following loads. */
const SKELETON_TILES = 4;
/** Section header row = title3 line height (A3). */
const SECTION_HEADER_HEIGHT = 28;
/** Ghost `sm` button side padding (Button dims). */
const INLINE_BUTTON_PAD = 14;
/** Saved-gym tile edge (= Avatar lg = compact RouteCard thumb) (H-3). */
const GYM_TILE = 64;
/** Banner height when an active banner exists. */
const BANNER_HEIGHT = 160;

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
  /** Called when a following-activity tile is tapped. Opens UserProfileScreen. */
  onSelectClimber: (userId: string) => void;
  /** Called by 「查看全部」 in the Following header. Opens FollowingListScreen for the signed-in user. */
  onViewAllFollowing?: (userId: string) => void;
  /** Called when the notifications bell is tapped (no-op here; handled by AppHeader). */
  onNavigateToNotifications?: () => void;
  /**
   * Called by the 「找攀岩者」 action of the Following empty state. The action is hidden when
   * no destination is wired. The empty-state actions of Saved Gyms / Projecting use `onViewAllGyms`.
   */
  onFindClimbers?: () => void;
}

/** Admin-managed Events Banner row. */
interface AdminBanner {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
}

/** Following-activity row per followed climber. */
interface FollowingActivity {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** ISO timestamp of the most-recent beta video activity (MAX updated_at). */
  latestAt: string | null;
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
  onViewAllFollowing,
  onFindClimbers,
}: HomeScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { haptic } = useMotion();
  const { fontScale } = useWindowDimensions();
  const isAx = fontScale >= AX_FONT_SCALE;
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
      const gymItems = await fetchSavedGym(session.user.id);
      setSavedGyms(gymItems);

      // Prefetch all non-null cover photos into memory-disk cache (fire-and-forget).
      // cover_photo_url uses permanent public URLs, so disk caching is safe.
      // Images are warmed before the user sees the chips (AC-113/AC-175).
      gymItems.forEach((gym) => {
        if (gym.cover_photo_url !== null) {
          void Image.prefetch(gym.cover_photo_url);
        }
      });
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

      // Step 2: Fetch route details via home-service (no inline Supabase query here).
      let routes: ProjectingRoute[];
      try {
        routes = await fetchProjectingRoutes(savedRouteIds);
      } catch (routeErr) {
        console.error('[HomeScreen] loadProjectingRoutes routes error:', routeErr);
        setProjectingRoutes([]);
        return;
      }
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

      // Step 4: Call routes_with_new_beta RPC via home-service (with in-memory
      // cache, ~60s TTL). Retained for AC-175 Saved Gyms ordering — not used for
      // the card chip (chip removed per AC-181 Rev 39). Non-fatal on failure.
      try {
        const newBetaIds = await fetchRoutesWithNewBeta(savedRouteIds);
        setNewBetaRouteIds(newBetaIds);
      } catch (rpcErr) {
        // Non-fatal: new-beta data unavailable; AC-175 ordering degrades gracefully.
        console.error('[HomeScreen] routes_with_new_beta RPC error:', rpcErr);
        setNewBetaRouteIds(new Set());
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
      clearCache();
      prevUserIdRef.current = session.user.id;
    }
  }, [session.user.id]);

  // ── Derived: available grades + filtered projecting routes ───────────────

  const availableGrades = useMemo<GradeFilter[]>(() => {
    const grades = [...new Set(projectingRoutes.map((r) => r.grade))].sort();
    return [ALL_GRADE_FILTER, ...grades];
  }, [projectingRoutes]);

  // AC-177: the chip row only appears when the saved routes span at least two grades.
  const showGradeChips = availableGrades.length > 2;

  // If the selected grade disappears (its last route was unbookmarked), fall back to 「全部」.
  useEffect(() => {
    if (selectedGrade !== ALL_GRADE_FILTER && !availableGrades.includes(selectedGrade)) {
      setSelectedGrade(ALL_GRADE_FILTER);
    }
  }, [availableGrades, selectedGrade]);

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
  // R0: the scroll container owns the horizontal margin (screenMargin) and the section gap
  // (sectionGap); sections set neither. Horizontal strips bleed with a negative margin and re-inset.

  // A3: the title and its action share one 28pt row; the action is `subhead` 600, baseline-aligned,
  // right edge on the keyline; the 44pt target comes from hitSlop (no layout change).
  const sectionHeader = (title: string, action?: { label: string; onPress: () => void }): React.JSX.Element => (
    <View style={styles.sectionHeader}>
      <AppText variant="pageSection" accessibilityRole="header">
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={LINK_HIT_SLOP} accessibilityRole="button" accessibilityLabel={action.label}>
          <AppText variant="subhead" weight="600" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  // One inline empty state for every section (A6/A8): sentence on the keyline, optional ghost `sm`
  // action 8pt under it with its glyph on x16 (marginLeft -14 cancels the button's 14pt padding).
  const inlineEmpty = (sentence: string, action?: { label: string; onPress: () => void }): React.JSX.Element => (
    <View style={styles.inlineEmpty}>
      <AppText variant="subhead" color="textSecondary">
        {sentence}
      </AppText>
      {action ? (
        <View style={styles.inlineEmptyAction}>
          <Button variant="ghost" size="sm" on="background" label={action.label} onPress={action.onPress} style={styles.inlineEmptyButton} />
        </View>
      ) : null}
    </View>
  );

  const followingA11y = (name: string, time: string | null): string =>
    t('home.followingActivity.rowA11y', { name, label: t('home.following.newUpload'), time: time ?? '' });

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
      {/* banner exists (and loading is complete), a 52pt placeholder row is shown (H-2). */}
      {!bannerLoading && activeBanner === null ? (
        <Card variant="static" style={styles.bannerPlaceholderCard}>
          <AppText variant="subhead" color="textSecondary" align="center">
            {t('home.banner.noEvents')}
          </AppText>
        </Card>
      ) : activeBanner !== null ? (
        <View style={styles.bannerCard}>
          {activeBanner.image_url !== null ? (
            <Image
              source={{ uri: activeBanner.image_url }}
              style={styles.bannerImage}
              contentFit="cover"
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
      ) : null}

      {/* ── Section 2: Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) */}
      <View>
        {sectionHeader(
          t('home.savedGyms.title'),
          !savedGymsLoading && savedGyms.length === 0
            ? undefined
            : { label: t('home.savedGyms.viewAll'), onPress: onViewAllGyms },
        )}

        {!savedGymsLoading && savedGyms.length === 0 ? (
          inlineEmpty(t('home.savedGyms.empty'), { label: t('home.savedGyms.explore'), onPress: onViewAllGyms })
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
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
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.gymChipInitialsAvatar}>
                    <AppText variant="title3" color="textSecondary">
                      {Array.from(gym.name)[0] ?? ''}
                    </AppText>
                  </View>
                )}
                <View style={styles.caption}>
                  <AppText variant="footnote" align="center" numberOfLines={2}>
                    {gym.name}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Section 3: Projecting Routes (AC-177, AC-178, AC-181) ─────── */}
      <View>
        {sectionHeader(t('home.projectingRoutes.title'))}

        {/* Grade filter chips (AC-177/178): single choice, only when the routes span >= 2 grades */}
        {showGradeChips ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
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
        ) : null}

        {!projectingLoading && projectingRoutes.length === 0 ? (
          inlineEmpty(t('home.projectingRoutes.empty'), {
            label: t('home.projectingRoutes.browse'),
            onPress: onViewAllGyms,
          })
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
                  variant="compact"
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

      {/* ── Section 4: Following (AC-182, home-v2 avatar strip) ───────── */}
      <View>
        {sectionHeader(
          t('home.followingActivity.title'),
          !followingLoading && followingActivity.length > 0 && onViewAllFollowing
            ? { label: t('home.followingActivity.viewAll'), onPress: () => onViewAllFollowing(session.user.id) }
            : undefined,
        )}

        {followingLoading ? (
          <View style={styles.followingSkeleton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: SKELETON_TILES }, (_, i) => (
              <View key={i} style={styles.followingTile}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonBar} />
              </View>
            ))}
          </View>
        ) : followingActivity.length === 0 ? (
          inlineEmpty(
            t('home.followingActivity.empty'),
            onFindClimbers ? { label: t('home.followingActivity.findClimbers'), onPress: onFindClimbers } : undefined,
          )
        ) : isAx ? (
          <View>
            {followingActivity.map((item) => {
              const time = item.latestAt !== null ? relativeTime(item.latestAt, t) : null;
              return (
                <PressableScale
                  key={item.userId}
                  feedback="row"
                  inScroll
                  pressedColor={c.surfacePressed}
                  style={styles.followingRow}
                  onPress={() => onSelectClimber(item.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={followingA11y(item.displayName, time)}
                  accessibilityHint={t('home.followingActivity.openProfileHint')}
                >
                  <Avatar size="sm" uri={item.avatarUrl} name={item.displayName} decorative />
                  <View style={styles.flex}>
                    <AppText variant="subhead" weight="600" numberOfLines={2}>
                      {item.displayName}
                    </AppText>
                    {time !== null ? (
                      <AppText variant="footnote" color="textSecondary">
                        {time}
                      </AppText>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.gymStripRow}
          >
            {followingActivity.map((item) => {
              const time = item.latestAt !== null ? relativeTime(item.latestAt, t) : null;
              return (
                <Pressable
                  key={item.userId}
                  style={styles.followingTile}
                  onPress={() => onSelectClimber(item.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={followingA11y(item.displayName, time)}
                  accessibilityHint={t('home.followingActivity.openProfileHint')}
                >
                  <Avatar size="lg" uri={item.avatarUrl} name={item.displayName} decorative />
                  <View style={styles.caption}>
                    <AppText variant="footnote" align="center" numberOfLines={1}>
                      {item.displayName}
                    </AppText>
                    {time !== null ? (
                      <AppText variant="footnote" color="textSecondary" align="center" numberOfLines={1}>
                        {time}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
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
      // R0: the container owns the margin and the gaps. The large title floats over the list
      // (AppHeader overlay), so the content starts R2 (16) below the header; the TabBar floats over the bottom.
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.xl,
      paddingHorizontal: screenMargin,
      rowGap: theme.layout.sectionGap,
    },
    flex: {
      flex: 1,
    },
    // A horizontal strip that bleeds to the screen edges; its content re-insets by screenMargin.
    bleed: {
      marginHorizontal: -screenMargin,
    },
    // A3: 28pt (title3 line height) with or without an action; baseline-aligned.
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      height: SECTION_HEADER_HEIGHT,
      marginBottom: theme.layout.sectionHeaderGap,
    },
    // Inline empty state: 16 + 22 + 16 = 54pt; with an action + 8 + 32.
    inlineEmpty: {
      paddingVertical: theme.spacing.md,
    },
    inlineEmptyAction: {
      marginTop: theme.spacing.sm,
      alignItems: 'flex-start',
    },
    inlineEmptyButton: {
      marginLeft: -INLINE_BUTTON_PAD,
    },
    // ── Banner ──────────────────────────────────────────────────────────────
    bannerPlaceholderCard: {
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerCard: {
      height: BANNER_HEIGHT,
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
      // mediaScrimStrong keeps onMedia text at 6.85:1 (H-2).
      backgroundColor: c.mediaScrimStrong,
      // C1 row band: listRowPaddingV 12 top/bottom, cardPadding 16 left/right; C3 xs between lines.
      paddingHorizontal: theme.layout.cardPadding,
      paddingVertical: theme.layout.listRowPaddingV,
      rowGap: theme.spacing.xs,
    },
    // ── Saved Gyms ──────────────────────────────────────────────────────────
    gymStripRow: {
      paddingHorizontal: screenMargin,
      columnGap: theme.layout.cardGap,
    },
    gymChip: {
      width: GYM_TILE,
      alignItems: 'center',
      rowGap: theme.spacing.xs,
    },
    gymChipImage: {
      width: GYM_TILE,
      height: GYM_TILE,
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
    },
    gymChipInitialsAvatar: {
      width: GYM_TILE,
      height: GYM_TILE,
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
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
      rowGap: theme.layout.cardGap,
    },
    // ── Following (strip shares gymStripRow / the tile geometry of Saved Gyms) ──
    followingTile: {
      width: GYM_TILE,
      alignItems: 'center',
      rowGap: theme.spacing.xs,
    },
    caption: {
      alignSelf: 'stretch',
      height: CAPTION_HEIGHT,
    },
    followingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.spacing.smd,
      minHeight: theme.layout.listRowMinHeight,
    },
    followingSkeleton: {
      flexDirection: 'row',
      columnGap: theme.layout.cardGap,
    },
    skeletonAvatar: {
      width: GYM_TILE,
      height: GYM_TILE,
      borderRadius: theme.radius.full,
      backgroundColor: c.surfaceAlt,
    },
    skeletonBar: {
      width: GYM_TILE,
      height: CAPTION_HEIGHT / 2,
      borderRadius: theme.radius.minor,
      backgroundColor: c.surfaceAlt,
    },
  });
}
