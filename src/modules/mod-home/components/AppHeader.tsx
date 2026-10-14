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
 * Theme tokens — no hardcoded hex colors.
 * i18n for all accessible labels.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useUnreadCount } from '../../mod-notifications/UnreadCountProvider';
import { useTheme } from '../../../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  /** Top safe-area inset applied as paddingTop (passed from AppShell). */
  topInset: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum badge count displayed numerically; shows "99+" above this. */
const MAX_BADGE_COUNT = 99;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppHeader({
  onNavigateToNotifications,
  onNavigateToSettings,
  topInset,
}: AppHeaderProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const unreadCount = useUnreadCount();
  const styles = makeStyles(theme, topInset);

  const badgeLabel =
    unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount);

  return (
    <View style={styles.header}>
      {/* Bell icon — left side */}
      <Pressable
        style={styles.iconButton}
        onPress={onNavigateToNotifications}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? t('home.appHeader.bellA11yUnread', { count: unreadCount })
            : t('home.appHeader.bellA11y')
        }
        hitSlop={8}
      >
        {/* Bell glyph — simple text placeholder matching icon convention */}
        <Text style={styles.iconText}>{'🔔'}</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </Pressable>

      {/* App name — centre */}
      <Text style={styles.appName}>{t('app.name')}</Text>

      {/* Settings icon — right side */}
      <Pressable
        style={styles.iconButton}
        onPress={onNavigateToSettings}
        accessibilityRole="button"
        accessibilityLabel={t('home.appHeader.settingsA11y')}
        hitSlop={8}
      >
        <Text style={styles.iconText}>{'⚙️'}</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: topInset + theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: theme.fontSize.xl,
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textInverse,
    },
    appName: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
  });
}
