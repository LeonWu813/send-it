/**
 * RouteCard — a pressable card representing a route the user has sent.
 *
 * Displays:
 *   - Route name + style tag (Flash / Send)
 *   - Gym name subtitle
 *   - Most recent send date
 *
 * Only routes with at least one flash or top are shown (attempts are excluded
 * at the grouping layer in groupToRouteCards).
 *
 * Uses theme tokens only — no hardcoded colors or spacing.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import type { RouteCard as RouteCardData } from '../history-service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteCardProps {
  card: RouteCardData;
  onPress?: (routeId: string, gymId: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format a UTC ISO timestamp as a short locale date string.
 * e.g. "Sep 15, 2026"
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteCard({ card, onPress }: RouteCardProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  // Build localized display name: "{grade} {LocalizedColor} ({section_label}?)"
  const colorLabel = card.color_tag ? t(`routeCatalog.colors.${card.color_tag}`) : '';
  const sectionSuffix = card.section_label ? ` (${card.section_label})` : '';
  const displayName = `${card.grade}${colorLabel ? ` ${colorLabel}` : ''}${sectionSuffix}`;

  const styleTagText = card.best_style === 'flash' ? 'Flash' : 'Send';
  const styleTagStyle = [
    styles.styleTag,
    card.best_style === 'flash' ? styles.styleTagFlash : styles.styleTagSend,
  ];
  const styleTagTextStyle = [
    styles.styleTagText,
    card.best_style === 'flash' ? styles.styleTagTextFlash : styles.styleTagTextSend,
  ];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(card.route_id, card.gym_id)}
      accessibilityRole="button"
    >
      {/* Top row: route name + style tag */}
      <View style={styles.topRow}>
        <Text style={styles.routeName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styleTagStyle}>
          <Text style={styleTagTextStyle}>{styleTagText}</Text>
        </View>
      </View>

      {/* Gym name */}
      <Text style={styles.gymName} numberOfLines={1}>
        {card.gym_name}
      </Text>

      {/* Most recent date */}
      <Text style={styles.date}>{formatDate(card.most_recent_date)}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    cardPressed: {
      opacity: 0.75,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    routeName: {
      flex: 1,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.sm,
    },
    styleTag: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      flexShrink: 0,
    },
    styleTagFlash: {
      backgroundColor: theme.colors.primary,
    },
    styleTagSend: {
      backgroundColor: theme.colors.success,
    },
    styleTagText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.medium,
    },
    styleTagTextFlash: {
      color: theme.colors.textInverse,
    },
    styleTagTextSend: {
      color: theme.colors.textInverse,
    },
    gymName: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    date: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
  });
}
