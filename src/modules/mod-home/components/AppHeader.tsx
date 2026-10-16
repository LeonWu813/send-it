/**
 * AppHeader — Global app-level header (AC-184, Rev 35).
 *
 * Rendered by AppShell on all screens EXCEPT:
 *   - The fullscreen beta-video reel viewer (AC-133)
 *   - Auth / signed-out screens
 *
 * Layout:
 *   Left  — notification bell icon + unread-count badge (AC-173).
 *           Subscribes to UnreadCountProvider (MOD-007) via useUnreadCount().
 *           Tapping navigates to MOD-007's NotificationInboxScreen (AC-171).
 *   Right — settings gear icon.
 *           Tapping navigates to MOD-010's SettingsScreen.
 *
 * Props:
 *   onNavigateToNotifications — callback to open NotificationInboxScreen.
 *   onNavigateToSettings      — callback to open SettingsScreen.
 *
 * Safe-area:
 *   Applies the top inset passed from AppShell (derived from useSafeAreaInsets()
 *   at the AppShell level so the header can reserve the correct space).
 *
 * Design system v1.2 (§30 / §32.3): Ionicons from ICON (no emoji), 44pt content height,
 * IconButtons with `on="background"` (pressed disc = surfaceAltPressed), unread count via the
 * IconButton `badge` (Badge §15.9, which owns the 99+ cap and its motion).
 *
 * Theme tokens — no hardcoded hex colors.
 * i18n for all accessible labels.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { IconButton } from '../../../components/ui/IconButton';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useUnreadCount } from '../../mod-notifications/UnreadCountProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  /** Top safe-area inset applied as paddingTop (passed from AppShell). */
  topInset: number;
  /**
   * The unread number just arrived as a live notification while the app is in the foreground:
   * the badge pops in with `topOut`. Default false (launch / resume / refresh: fades in).
   */
  badgeLive?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppHeader({
  onNavigateToNotifications,
  onNavigateToSettings,
  topInset,
  badgeLive = false,
}: AppHeaderProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const unreadCount = useUnreadCount();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: topInset,
          // The 44pt IconButton container sits at screenMargin - 10 so the glyph aligns to the margin.
          paddingHorizontal: screenMargin - 10,
          backgroundColor: theme.colors.background,
          borderBottomWidth: theme.stroke.hairline,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={[styles.content, { minHeight: theme.layout.headerContentHeight }]}>
        {/* Bell — left */}
        <IconButton
          name={ICON.notifications.outline}
          on="background"
          badge={unreadCount}
          badgeLive={badgeLive}
          accessibilityLabel={
            unreadCount > 0
              ? t('home.appHeader.bellA11yUnread', { count: unreadCount })
              : t('home.appHeader.bellA11y')
          }
          onPress={onNavigateToNotifications}
        />

        {/* App name — centre (max width = screen width - 2 x (margin - 10 + 44)) */}
        <AppText
          variant="headline"
          align="center"
          numberOfLines={1}
          accessibilityRole="header"
          style={styles.title}
        >
          {t('app.name')}
        </AppText>

        {/* Settings — right */}
        <IconButton
          name={ICON.settings.outline}
          on="background"
          accessibilityLabel={t('home.appHeader.settingsA11y')}
          onPress={onNavigateToSettings}
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {},
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
});
