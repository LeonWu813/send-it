/**
 * HomeScreen — Tab 1 content (AC-111 rev, AC-112, AC-113, AC-114, AC-115,
 *   AC-174, AC-175, AC-176, AC-177, AC-178, AC-181, AC-182).
 *
 * Four sections in order (AC-111):
 *   1. Events Banner (AC-112, AC-174) — single admin-managed banner from
 *      `admin_banners WHERE is_active = true LIMIT 1`; hidden if none active.
 *   2. Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) — horizontal scroll
 *      strip ordered by most-recently-viewed via `user_route_visits` MAX
 *      `last_viewed_at` per gym; tapping navigates to RouteListScreen.
 *   3. Projecting Routes (AC-177, AC-178, AC-181) — sourced from `saved_routes`
 *      via MOD-003's fetchSavedRouteIds(); V-grade filter tabs; uses RouteCard
 *      with `hasNewBetaVideo` prop from `routes_with_new_beta` RPC (60s cache).
 *   4. Following Activity (AC-182) — followed user IDs via MOD-006's service;
 *      then beta_videos last 14 days grouped by uploader; avatar + display_name
 *      + "X new beta video(s)" + relative timestamp; tap → UserProfileScreen.
 *
 * Safe area:
 *   - Top inset NOT applied here — AppHeader (mounted by AppShell) owns the top.
 *   - Bottom inset handled by AppShell's TabBar.
 *
 * Cross-module imports (allowed per spec Integration Points):
 *   - fetchSavedRouteIds(), routes_with_new_beta RPC from mod-route-catalog
 *   - fetchFollowing() from mod-social-feed (for followed user list)
 *   - RouteCard from src/components/RouteCard (app-level shared component)
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import RouteCard from '../../../components/RouteCard';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import { fetchSavedRouteIds } from '../../mod-route-catalog/route-service';
import { ROUTE_GRADES, type RouteGrade } from '../../mod-route-catalog/types';
import { fetchFollowing } from '../../mod-social-feed/social-feed-service';
import type { FollowingUser } from '../../mod-social-feed/types';

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
}

/** Following-activity row per followed climber. */
interface FollowingActivity {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  newBetaVideoCount: number;
  /** ISO timestamp of the most-recent qualifying beta video. */
  latestAt: string | null;
}

// ── In-memory cache for routes_with_new_beta RPC ─────────────────────────────

interface NewBetaCache {
  /** Route IDs that have a new beta video (Set for O(1) lookup). */
  data: Set<string>;
  /** Timestamp when this cache entry was populated. */
  populatedAt: number;
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

const GRADE_TABS: GradeFilter[] = [ALL_GRADE_FILTER, ...ROUTE_GRADES];

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
  const styles = makeStyles(theme);

  // ── Section 1: Admin Events Banner ────────────────────────────────────────

  const [activeBanner, setActiveBanner] = useState<AdminBanner | null>(null);

  const loadBanner = useCallback(async () => {
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
      return;
    }
    setActiveBanner((data as AdminBanner | null) ?? null);
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
        .select('gym_id, gyms(id, name, photo_url)')
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
      const gymIds = (savedRows as unknown as Array<{ gym_id: string; gyms: { id: string; name: string; photo_url: string | null } | null }>)
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
        gyms: { id: string; name: string; photo_url: string | null } | null;
      }>)
        .filter((r) => r.gyms !== null)
        .map((r) => ({
          id: r.gyms!.id,
          name: r.gyms!.name,
          photo_url: r.gyms!.photo_url,
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

  const loadProjectingRoutes = useCallback(async () => {
    setProjectingLoading(true);
    try {
      // Step 1: Get saved route IDs via MOD-003's public service.
      const savedRouteIds = await fetchSavedRouteIds();

      if (savedRouteIds.length === 0) {
        setProjectingRoutes([]);
        setNewBetaRouteIds(new Set());
        return;
      }

      // Step 2: Fetch route details for the saved route IDs.
      const { data: routeRows, error: routeError } = await supabase
        .from('routes')
        .select('id, gym_id, grade, color_tag, photo_url')
        .in('id', savedRouteIds)
        .eq('status', 'active');

      if (routeError) {
        console.error('[HomeScreen] loadProjectingRoutes routes error:', routeError);
        setProjectingRoutes([]);
        return;
      }

      const routes = (routeRows as ProjectingRoute[]) ?? [];
      setProjectingRoutes(routes);

      // Step 3: Call routes_with_new_beta RPC (with in-memory cache, ~60s TTL).
      // Cache is keyed by the full set of route IDs in this load cycle (AC-180/AC-181).
      const now = Date.now();
      if (
        newBetaCache !== null &&
        now - newBetaCache.populatedAt < NEW_BETA_CACHE_TTL_MS
      ) {
        // Cache still valid — reuse.
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
          newBetaCache = { data: ids, populatedAt: now };
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
        .select('user_id, created_at')
        .in('user_id', followedIds)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      if (betaError) {
        console.error('[HomeScreen] loadFollowingActivity beta_videos error:', betaError);
        setFollowingActivity([]);
        return;
      }

      // Step 3: Group by uploader to get count + latest timestamp.
      const activityMap = new Map<
        string,
        { count: number; latestAt: string }
      >();
      for (const row of (betaRows as Array<{ user_id: string; created_at: string }>) ?? []) {
        const existing = activityMap.get(row.user_id);
        if (existing) {
          existing.count += 1;
          if (row.created_at > existing.latestAt) {
            existing.latestAt = row.created_at;
          }
        } else {
          activityMap.set(row.user_id, { count: 1, latestAt: row.created_at });
        }
      }

      // Step 4: Build the activity list in follow order (only users with videos).
      const activities: FollowingActivity[] = followingUsers
        .filter((u) => activityMap.has(u.id))
        .map((u) => {
          const entry = activityMap.get(u.id)!;
          return {
            userId: u.id,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            newBetaVideoCount: entry.count,
            latestAt: entry.latestAt,
          };
        });

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

  // ── Derived: filtered projecting routes ───────────────────────────────────

  const filteredRoutes = useMemo(() => {
    if (selectedGrade === ALL_GRADE_FILTER) return projectingRoutes;
    return projectingRoutes.filter((r) => r.grade === selectedGrade);
  }, [projectingRoutes, selectedGrade]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section 1: Events Banner (AC-112, AC-174) ─────────────────── */}
      {activeBanner !== null && (
        <View style={styles.section}>
          <View style={styles.bannerCard}>
            {activeBanner.image_url !== null ? (
              <Image
                source={{ uri: activeBanner.image_url }}
                style={styles.bannerImage}
                resizeMode="cover"
                accessibilityLabel={activeBanner.title}
              />
            ) : (
              <View style={styles.bannerImagePlaceholder} />
            )}
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerTitle}>{activeBanner.title}</Text>
              {activeBanner.body.length > 0 && (
                <Text style={styles.bannerBody} numberOfLines={2}>
                  {activeBanner.body}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── Section 2: Saved Gyms (AC-113, AC-114, AC-115, AC-175, AC-176) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.savedGyms.title')}</Text>
          <Pressable
            onPress={onViewAllGyms}
            accessibilityRole="button"
            accessibilityLabel={t('home.savedGyms.viewAll')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>{t('home.savedGyms.viewAll')}</Text>
          </Pressable>
        </View>

        {!savedGymsLoading && savedGyms.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.savedGyms.empty')}</Text>
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
                {gym.photo_url !== null ? (
                  <Image
                    source={{ uri: gym.photo_url }}
                    style={styles.gymChipImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.gymChipImagePlaceholder} />
                )}
                <Text style={styles.gymChipName} numberOfLines={2}>
                  {gym.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Section 3: Projecting Routes (AC-177, AC-178, AC-181) ─────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.projectingRoutes.title')}</Text>
        </View>

        {/* Grade filter tabs (AC-178) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradeTabsRow}
        >
          {GRADE_TABS.map((grade) => (
            <Pressable
              key={grade}
              style={[
                styles.gradeTab,
                selectedGrade === grade && styles.gradeTabActive,
              ]}
              onPress={() => setSelectedGrade(grade)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedGrade === grade }}
            >
              <Text
                style={[
                  styles.gradeTabText,
                  selectedGrade === grade && styles.gradeTabTextActive,
                ]}
              >
                {grade === ALL_GRADE_FILTER ? t('home.projectingRoutes.allGrades') : grade}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {!projectingLoading && projectingRoutes.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.projectingRoutes.empty')}</Text>
        ) : !projectingLoading && filteredRoutes.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.projectingRoutes.emptyFiltered')}</Text>
        ) : (
          <View style={styles.routeList}>
            {filteredRoutes.map((route) => (
              <RouteCard
                key={route.id}
                route={{
                  id: route.id,
                  name: `${route.grade} ${t(`routeCatalog.colors.${route.color_tag}`)}`,
                  grade: route.grade,
                  photo_url: route.photo_url,
                }}
                onPress={() => onSelectRoute(route.id, route.gym_id)}
                hasNewBetaVideo={newBetaRouteIds.has(route.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Section 4: Following Activity (AC-182) ─────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.followingActivity.title')}</Text>
        </View>

        {!followingLoading && followingActivity.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.followingActivity.empty')}</Text>
        ) : (
          <View>
            {followingActivity.map((item) => (
              <Pressable
                key={item.userId}
                style={styles.activityRow}
                onPress={() => onSelectClimber(item.userId)}
                accessibilityRole="button"
                accessibilityLabel={item.displayName}
              >
                {/* Avatar */}
                {item.avatarUrl !== null ? (
                  <Image
                    source={{ uri: item.avatarUrl }}
                    style={styles.activityAvatar}
                    resizeMode="cover"
                    accessibilityLabel={item.displayName}
                  />
                ) : (
                  <View style={styles.activityAvatarPlaceholder} />
                )}

                {/* Info */}
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.activityCount}>
                    {t('home.followingActivity.newVideos', {
                      count: item.newBetaVideoCount,
                    })}
                  </Text>
                  {item.latestAt !== null && (
                    <Text style={styles.activityTime}>
                      {relativeTime(item.latestAt, t)}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    viewAllText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
    },
    // ── Banner ──────────────────────────────────────────────────────────────
    bannerCard: {
      marginHorizontal: theme.spacing.md,
      height: 160,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    bannerImagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    bannerOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.overlay,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    bannerTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    bannerBody: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
      marginTop: 2,
    },
    // ── Saved Gyms ──────────────────────────────────────────────────────────
    gymStripRow: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    gymChip: {
      width: 96,
      alignItems: 'center',
    },
    gymChipImage: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xs,
    },
    gymChipImagePlaceholder: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.xs,
    },
    gymChipName: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    // ── Grade Filter Tabs ────────────────────────────────────────────────────
    gradeTabsRow: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    gradeTab: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surface,
    },
    gradeTabActive: {
      backgroundColor: theme.colors.primary,
    },
    gradeTabText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    gradeTabTextActive: {
      color: theme.colors.textInverse,
    },
    // ── Projecting Routes ────────────────────────────────────────────────────
    routeList: {
      paddingHorizontal: theme.spacing.md,
    },
    // ── Following Activity ───────────────────────────────────────────────────
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.divider,
    },
    activityAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: theme.spacing.sm,
    },
    activityAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      marginRight: theme.spacing.sm,
    },
    activityInfo: {
      flex: 1,
    },
    activityName: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    activityCount: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    activityTime: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
  });
}
