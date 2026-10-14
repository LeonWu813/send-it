/**
 * RouteCard — App-level shared presentational component (AC-183).
 *
 * Owned by MOD-012. Consumed by:
 *   - HomeScreen Projecting Routes section (MOD-012)
 *   - RouteListScreen (MOD-003)
 *   - Send-history section (MOD-008)
 *
 * Import path (all consumers): `src/components/RouteCard`
 * Per the App-Level Shared Presentational Components convention in production.md.
 *
 * Layout:
 *   Left side  — route name + grade label
 *   Right side — 48×48 photo_url thumbnail (Image or placeholder)
 *   Badge      — "New Beta" chip rendered when hasNewBetaVideo is true (AC-181)
 *
 * Pure presentational — all data + callbacks are props.
 * No hardcoded colors — all styling via theme tokens.
 * All user-facing strings via i18n hook.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteCardRoute {
  id: string;
  name: string;
  grade: string;
  photo_url: string | null;
  gymName?: string;
}

export interface RouteCardProps {
  route: RouteCardRoute;
  onPress: () => void;
  hasNewBetaVideo?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteCard({
  route,
  onPress,
  hasNewBetaVideo = false,
}: RouteCardProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${route.name} ${route.grade}`}
    >
      {/* Left: route info */}
      <View style={styles.info}>
        <Text style={styles.routeName} numberOfLines={2}>
          {route.name}
        </Text>
        <Text style={styles.grade}>{route.grade}</Text>
        {route.gymName !== undefined && (
          <Text style={styles.gymName} numberOfLines={1}>
            {route.gymName}
          </Text>
        )}
        {/* New Beta badge (AC-181) */}
        {hasNewBetaVideo && (
          <View style={styles.newBetaBadge}>
            <Text style={styles.newBetaText}>{t('home.routeCard.newBeta')}</Text>
          </View>
        )}
      </View>

      {/* Right: thumbnail */}
      {route.photo_url !== null ? (
        <Image
          source={{ uri: route.photo_url }}
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
    grade: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    gymName: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    newBetaBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      marginTop: theme.spacing.xs,
    },
    newBetaText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.sm,
    },
    thumbnailPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.border,
    },
  });
}
