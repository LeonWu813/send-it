/**
 * AscentHistoryItem — single row in the send history list.
 *
 * Displays:
 *   - Grade badge + route color indicator
 *   - Gym name and optional section label
 *   - Send style chip (flash / top / attempt)
 *   - Logged date
 *   - Private indicator when is_private = true
 *
 * Uses theme tokens only — no hardcoded colors or spacing.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import type { HistoryAscent } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AscentHistoryItemProps {
  item: HistoryAscent;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format a UTC ISO timestamp as a short locale date string.
 * e.g. "Sep 20, 2026"
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

export default function AscentHistoryItem({
  item,
}: AscentHistoryItemProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const routeLabel = item.section_label
    ? `${item.grade} (${item.section_label})`
    : item.grade;

  return (
    <View style={styles.row} accessibilityRole="none">
      {/* Grade badge */}
      <View style={styles.gradeBadge}>
        <Text style={styles.gradeText}>{item.grade}</Text>
      </View>

      {/* Middle: gym + route info */}
      <View style={styles.middle}>
        <Text style={styles.gymName} numberOfLines={1}>
          {item.gym_name}
        </Text>
        <Text style={styles.routeLabel} numberOfLines={1}>
          {routeLabel}
        </Text>
      </View>

      {/* Right: style chip + date + private */}
      <View style={styles.right}>
        <View style={[styles.styleChip, item.style === 'flash' && styles.styleChipFlash]}>
          <Text style={styles.styleChipText}>
            {t(`sends.styles.${item.style}`)}
          </Text>
        </View>
        <Text style={styles.date}>{formatDate(item.logged_at)}</Text>
        {item.is_private && (
          <Text style={styles.privateLabel}>{t('sends.privateLabel')}</Text>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
      gap: theme.spacing.sm,
    },
    gradeBadge: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    gradeText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textInverse,
    },
    middle: {
      flex: 1,
    },
    gymName: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
    },
    routeLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    right: {
      alignItems: 'flex-end',
      flexShrink: 0,
      gap: 4,
    },
    styleChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
    },
    styleChipFlash: {
      backgroundColor: theme.colors.warning,
    },
    styleChipText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textPrimary,
      fontWeight: theme.fontWeight.medium,
    },
    date: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    privateLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textDisabled,
    },
  });
}
