/**
 * ProfileScreen.
 *
 * Displays the current user's profile: avatar, display name, bio.
 * Exposes an Edit Profile entry point (AC-117).
 * Embeds the MOD-008 send history surface (AC-118).
 * Renders the current user's own beta-video grid below the send history (AC-164).
 *
 * AC-116: shows display name, avatar, bio.
 * AC-117: "Edit Profile" navigates to EditProfileScreen.
 * AC-118: send history section via MOD-008 SendHistoryProfile.
 * AC-145: follower/following count links immediately below bio, tapping
 *          navigates to FollowersListScreen / FollowingListScreen.
 * AC-164: 3-column BetaVideoGrid below send history; tapping opens
 *          BetaVideoReelViewer with reelContext="profile".
 * AC-167: Logout control removed from ProfileScreen (moved to MOD-010 SettingsScreen).
 * AC-184: Notification bell and settings gear removed from ProfileScreen header —
 *          both controls now live on MOD-012's global app-level header.
 *
 * Scroll architecture: SendHistoryProfile owns the FlatList as the sole
 * scroll container. The profile header (avatar, name, bio, Edit Profile
 * button) is passed as `listHeaderComponent` and the beta-video grid
 * section is passed as `listFooterComponent` so they scroll with the list.
 * This avoids nesting a vertical FlatList inside a vertical ScrollView,
 * which triggers the VirtualizedList-nested-in-ScrollView warning.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppText, Avatar, Button, PressableScale } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import {
  BetaVideoGrid,
  BetaVideoReelViewer,
  fetchBetaVideosByUser,
} from '../../mod-beta-video';
import type { BetaVideo } from '../../mod-beta-video';
import { SendHistoryProfile } from '../../mod-profile-history';
import { fetchFollowerCounts } from '../../mod-social-feed/social-feed-service';
import { useAppHeaderRoot } from '../../mod-home/components/AppHeaderContext';
import { useSession } from '../hooks/useSession';

interface ProfileScreenProps {
  session: Session;
  onNavigateEditProfile: () => void;
  /** True when the Profile tab is the active tab. Used to trigger refetch on
   *  tab focus (AC-062) — the keep-alive pattern means the component never
   *  remounts on tab switch, so we increment refetchKey when isActive flips
   *  from false to true. */
  isActive?: boolean;
  /**
   * Callback invoked when the user taps a route card in the send history
   * surface. Switches to the Gyms tab and opens the route detail screen within
   * the correct gym's route list.
   */
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
  /** Callback to navigate to the FollowersListScreen (AC-145). */
  onNavigateToFollowers?: () => void;
  /** Callback to navigate to the FollowingListScreen (AC-145). */
  onNavigateToFollowing?: () => void;
}

export default function ProfileScreen({
  session: _session,
  onNavigateEditProfile,
  isActive = false,
  onNavigateToRoute,
  onNavigateToFollowers,
  onNavigateToFollowing,
}: ProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  // v2.2: bind the list (owned by SendHistoryProfile) to the AppShell header and TabBar insets.
  const h = useAppHeaderRoot();
  const styles = makeStyles(theme, screenMargin);

  const { profile } = useSession();

  // AC-145: follower/following counts — loaded on mount; 0 placeholder during load.
  // On fetch failure, counts remain at 0 (non-critical display, no error banner).
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // AC-164: beta video grid state.
  const [betaVideos, setBetaVideos] = useState<BetaVideo[]>([]);
  const [reelStartIndex, setReelStartIndex] = useState(0);
  const [showReel, setShowReel] = useState(false);

  // AC-062: Increment refetchKey each time the Profile tab becomes active so
  // SendHistoryProfile re-fetches stats even though the component never
  // unmounts (keep-alive display:none pattern in AppShell).
  const [refetchKey, setRefetchKey] = useState(0);
  useEffect(() => {
    if (isActive) setRefetchKey((prev) => prev + 1);
  }, [isActive]);

  // Tracks whether the first data load has completed. Used to decide whether to
  // show a loading state (first load only) or silently refetch in the background
  // on subsequent focus events without resetting counts/videos to empty.
  const hasLoadedOnce = useRef(false);

  // AC-145 + AC-164: Memoised fetch — does NOT reset state before fetching so
  // existing data stays visible during a silent background refresh (no flash).
  const loadData = useCallback(async (): Promise<void> => {
    if (!profile?.id) return;
    const userId = profile.id;
    const [counts, videos] = await Promise.all([
      fetchFollowerCounts(userId),
      fetchBetaVideosByUser(userId),
    ]);
    setFollowerCount(counts.follower_count);
    setFollowingCount(counts.following_count);
    setBetaVideos(videos);
    hasLoadedOnce.current = true;
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load: fires on mount once profile.id is available.
  // Keep-alive pattern — no NavigationContainer, no useFocusEffect.
  useEffect(() => {
    if (!profile?.id) return;
    void loadData();
  }, [profile?.id, loadData]);

  // Trigger refetch when tab becomes active (keep-alive pattern — no NavigationContainer).
  // Guard with hasLoadedOnce so we don't double-fetch on the first mount cycle.
  useEffect(() => {
    if (isActive && hasLoadedOnce.current) void loadData();
  }, [isActive, loadData]);

  // ── Profile header (AC-116 + AC-117 + AC-145) ───────────────────────────────
  // Passed as listHeaderComponent to SendHistoryProfile so it scrolls with
  // the FlatList rather than requiring a wrapping ScrollView.
  // AC-184: Notification bell and settings gear are NOT rendered here — they
  //         live on MOD-012's global app-level header.
  const profileHeader = (
    <View style={styles.headerContainer}>
      {/* Avatar + display name + bio (AC-116) */}
      <View style={styles.header}>
        <Avatar
          size="xl"
          uri={profile?.avatar_url}
          name={profile?.display_name}
          decorative
        />
        <AppText variant="title2" align="center">
          {profile?.display_name ?? ''}
        </AppText>
        {profile?.bio ? (
          <AppText variant="body" color="textSecondary" align="center">
            {profile.bio}
          </AppText>
        ) : null}
      </View>

      {/* AC-145: Follower / following count links — immediately below bio */}
      <View style={styles.followCountsRow}>
        <PressableScale
          feedback="row"
          pressedColor={theme.colors.surfaceAltPressed}
          style={styles.followCountItem}
          onPress={onNavigateToFollowers}
          accessibilityRole="button"
          accessibilityLabel={`${followerCount} ${t('socialFeed.followers')}`}
        >
          <AppText variant="headline" numeric>
            {followerCount}
          </AppText>
          <AppText variant="footnote" color="primary">
            {t('socialFeed.followers')}
          </AppText>
        </PressableScale>

        <PressableScale
          feedback="row"
          pressedColor={theme.colors.surfaceAltPressed}
          style={styles.followCountItem}
          onPress={onNavigateToFollowing}
          accessibilityRole="button"
          accessibilityLabel={`${followingCount} ${t('socialFeed.following')}`}
        >
          <AppText variant="headline" numeric>
            {followingCount}
          </AppText>
          <AppText variant="footnote" color="primary">
            {t('socialFeed.following')}
          </AppText>
        </PressableScale>
      </View>

      {/* Edit Profile entry (AC-117) */}
      <Button
        label={t('profile.editProfile')}
        onPress={onNavigateEditProfile}
        variant="secondary"
        size="md"
        fullWidth
        accessibilityLabel={t('profile.editProfile')}
      />
    </View>
  );

  // ── Profile footer (AC-164) ───────────────────────────────────────────────
  // Beta-video grid section — passed as listFooterComponent to SendHistoryProfile
  // so it appears after the send history list and scrolls with it.
  // AC-167: Logout button removed from ProfileScreen (moved to MOD-010 SettingsScreen).
  const profileFooter = (
    <View style={styles.videoSectionContainer}>
      <AppText variant="pageSection" style={styles.videoSectionTitle}>
        {t('betaVideo.myVideos')}
      </AppText>
      <BetaVideoGrid
        videos={betaVideos}
        onPressVideo={(index) => {
          setReelStartIndex(index);
          setShowReel(true);
        }}
        horizontalPadding={screenMargin}
        emptyState={
          <AppText
            variant="footnote"
            color="textSecondary"
            align="center"
            style={styles.videoSectionEmpty}
          >
            {t('betaVideo.noVideosYet')}
          </AppText>
        }
      />
    </View>
  );

  // ── Root: View (no ScrollView) — FlatList inside SendHistoryProfile scrolls ──
  return (
    <View style={styles.root}>
      {profile?.id ? (
        <SendHistoryProfile
          userId={profile.id}
          isOwnProfile
          refetchKey={refetchKey}
          listHeaderComponent={profileHeader}
          listFooterComponent={profileFooter}
          onNavigateToRoute={onNavigateToRoute}
          scrollProps={{
            onScroll: h.onScroll,
            onContentSizeChange: h.onContentSizeChange,
            onLayout: h.onLayout,
            scrollEventThrottle: h.scrollEventThrottle,
            contentContainerStyle: { paddingTop: h.contentTopInset, paddingBottom: h.contentBottomInset },
            scrollIndicatorInsets: { top: h.contentTopInset, bottom: h.indicatorBottomInset },
          }}
        />
      ) : (
        // Profile not yet loaded — show header and footer without history list.
        <>
          {profileHeader}
          {profileFooter}
        </>
      )}

      {/* AC-164: Beta video reel viewer — rendered as a fullscreen Modal overlay */}
      {showReel ? (
        <BetaVideoReelViewer
          videos={betaVideos}
          initialIndex={reelStartIndex}
          visible={showReel}
          onDismiss={() => { setShowReel(false); }}
          session={_session}
          reelContext="profile"
        />
      ) : null}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  screenMargin: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.md,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    // AC-145: follower / following count row
    followCountsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    followCountItem: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
      minHeight: theme.layout.minTouchTarget,
    },
    // AC-164: beta-video grid section (listFooterComponent)
    videoSectionContainer: {
      paddingTop: theme.layout.sectionGap,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: screenMargin,
    },
    videoSectionTitle: {
      marginBottom: theme.spacing.sm,
    },
    videoSectionEmpty: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
