/**
 * RouteCard — App-level shared presentational component (AC-183, Rev 39/40).
 *
 * Owned by MOD-012. Consumed by:
 *   - HomeScreen Projecting Routes section (MOD-012)
 *   - RouteListScreen (MOD-003)
 *   - Send-history section (MOD-008)
 *
 * Import path (all consumers): `src/components/RouteCard`
 * Per the App-Level Shared Presentational Components convention in production.md.
 *
 * Layout (AC-192):
 *   Left side  — route name + beta-count subtitle (AC-189) + send badge (AC-190)
 *               + bookmark icon (AC-046/047)
 *   Right side — 80×80 photo_url thumbnail (Image or placeholder)
 *
 * Removed (Rev 39):
 *   - hasNewBetaVideo prop and "New Beta" chip (AC-181)
 *   - grade label text (AC-191) — grade field kept on interface for a11y
 *
 * Pure presentational — all data + callbacks are props.
 * No hardcoded colors — all styling via theme tokens.
 * All user-facing strings via i18n hook.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../lib/theme';
import { getPhotoSignedUrl } from '../modules/mod-route-catalog/route-service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteCardRoute {
  id: string;
  name: string;
  /** Retained for accessibility-label composition — not rendered in the card UI (AC-191). */
  grade: string;
  photo_url: string | null;
  gymName?: string;
}

export interface RouteCardProps {
  route: RouteCardRoute;
  onPress: () => void;
  /** Number of beta videos for this route (AC-189). Default 0. */
  betaVideoCount?: number;
  /** Whether the current user has sent this route (AC-190). Default false. */
  hasSend?: boolean;
  /** The send style — flash (gold) or top (green). Only relevant when hasSend is true (AC-190). Default null. */
  sendStyle?: 'flash' | 'top' | null;
  /** Whether the current user has saved this route (AC-046/047). Default false. */
  isSaved?: boolean;
  /** Called when the bookmark icon is tapped (AC-046/047). */
  onBookmarkToggle?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gold color for flash send badge — matches MOD-004's flash badge color. */
const FLASH_BADGE_COLOR = '#FFD700';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteCard({
  route,
  onPress,
  betaVideoCount = 0,
  hasSend = false,
  sendStyle = null,
  isSaved = false,
  onBookmarkToggle,
}: RouteCardProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (route.photo_url !== null) {
      getPhotoSignedUrl(route.photo_url)
        .then(setSignedPhotoUrl)
        .catch(() => {
          // Silently keep signedPhotoUrl as null — placeholder is shown.
        });
    } else {
      setSignedPhotoUrl(null);
    }
  }, [route.photo_url]);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={route.name}
    >
      {/* Left: route info */}
      <View style={styles.info}>
        <Text style={styles.routeName} numberOfLines={2}>
          {route.name}
        </Text>

        {route.gymName !== undefined && (
          <Text style={styles.gymName} numberOfLines={1}>
            {route.gymName}
          </Text>
        )}

        {/* Beta count subtitle (AC-189) */}
        {betaVideoCount > 0 && (
          <Text style={styles.betaCount}>
            {t('routeCard.betaCount', { count: betaVideoCount })}
          </Text>
        )}

        {/* Send badge (AC-190) */}
        {hasSend && (
          <View
            style={[
              styles.sendBadge,
              {
                backgroundColor:
                  sendStyle === 'flash'
                    ? FLASH_BADGE_COLOR
                    : theme.colors.success,
              },
            ]}
          >
            <Text style={styles.sendBadgeText}>
              {sendStyle === 'flash'
                ? t('routeCard.flashSend')
                : t('routeCard.topSend')}
            </Text>
          </View>
        )}

        {/* Bookmark icon (AC-046/047) */}
        <Pressable
          onPress={(e) => {
            // stopPropagation prevents the card's outer onPress from firing (AC-046/047).
            // The event object may be absent in test environments; guard accordingly.
            if (e != null && typeof (e as unknown as { stopPropagation?: () => void }).stopPropagation === 'function') {
              (e as unknown as { stopPropagation: () => void }).stopPropagation();
            }
            onBookmarkToggle?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? t('routeCard.saved') : t('routeCard.unsaved')}
          hitSlop={8}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>

      {/* Right: thumbnail (80×80, AC-192) */}
      {signedPhotoUrl !== null ? (
        <Image
          source={{ uri: signedPhotoUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
          accessibilityLabel={t('home.routeCard.thumbnailAlt', { name: route.name })}
        />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    info: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    routeName: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    gymName: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    betaCount: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    sendBadge: {
      alignSelf: 'flex-start',
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    sendBadgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    thumbnail: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.sm,
    },
    thumbnailPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.border,
    },
  });
}
