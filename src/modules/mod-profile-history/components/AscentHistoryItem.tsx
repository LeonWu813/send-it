/**
 * AscentHistoryItem — single row in the send history list (spec §32.7).
 *
 * Layout (row sits on a `surface` container):
 *   [photo 44] grade + route name        [SendStyleChip]
 *              date · gym  (lock + Private)
 *
 * - Grade is its own non-shrinking node; the route name shrinks (1 line, 2 lines
 *   at fontScale >= 1.6) but never disappears.
 * - At fontScale >= 1.6 the SendStyleChip moves to the start of the second line.
 * - One merged VoiceOver label for the whole row.
 *
 * Not built: TapeBadge (route-catalog has not shipped TAPE_DISPLAY yet), so the
 * route colour is carried by the localized colour name in the route label.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, SendStyleChip } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import type { HistoryAscent } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AscentHistoryItemProps {
  item: HistoryAscent;
}

/** Thumbnail edge (spec 44x44). */
const THUMB_SIZE = 44;
/** AX threshold from the spec. */
const AX_FONT_SCALE = 1.6;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Short locale date, e.g. "Sep 20, 2026". */
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
  const { screenMargin } = useLayout();
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;
  const styles = makeStyles(theme, screenMargin);

  // Route name per production.md Route Display Name Format: "{LocalizedColor} (Section)".
  // The grade is rendered as its own node.
  const colorLabel = item.color_tag ? t(`routeCatalog.colors.${item.color_tag}`) : '';
  const sectionLabel = item.section_label ? `(${item.section_label})` : '';
  const routeName = [colorLabel, sectionLabel].filter(Boolean).join(' ');

  const date = formatDate(item.logged_at);
  const styleLabel = t(`sends.styles.${item.style}`);

  // "V4 Red (Cave), Boulder Planet, Flash, Sep 20, 2026, Private"
  const a11yLabel = [
    `${item.grade}${routeName ? ` ${routeName}` : ''}`,
    item.gym_name,
    styleLabel,
    date,
    item.is_private ? t('sends.privateLabel') : null,
  ]
    .filter(Boolean)
    .join(', ');

  const chip = (
    <SendStyleChip
      sendStyle={item.style}
      attempts={item.style === 'attempt' ? item.attempts : undefined}
    />
  );

  return (
    <View style={styles.row} accessible accessibilityLabel={a11yLabel}>
      {item.photo_url ? (
        <Image
          source={{ uri: item.photo_url }}
          style={styles.thumb}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}

      <View style={styles.middle}>
        {/* Line 1: grade + route name */}
        <View style={styles.line}>
          <AppText variant="subhead" weight="600" numeric style={styles.grade}>
            {item.grade}
          </AppText>
          {routeName ? (
            <AppText
              variant="subhead"
              weight="600"
              numberOfLines={ax ? 2 : 1}
              style={styles.routeName}
            >
              {routeName}
            </AppText>
          ) : null}
        </View>

        {/* Line 2: [chip at AX] date · gym, private */}
        <View style={styles.line2}>
          {ax ? chip : null}
          <AppText variant="caption1" color="textSecondary" numberOfLines={1} style={styles.meta}>
            {`${date} · ${item.gym_name}`}
          </AppText>
          {item.is_private ? (
            <View style={styles.privateRow}>
              <Ionicons
                name={ICON.locked.outline}
                size={theme.iconSize.xs}
                color={theme.colors.textSecondary}
              />
              <AppText variant="caption1" color="textSecondary">
                {t('sends.privateLabel')}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {!ax ? <View style={styles.trailing}>{chip}</View> : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.minTouchTarget,
      paddingVertical: theme.spacing.smd,
      paddingHorizontal: screenMargin,
      borderBottomWidth: theme.stroke.thin,
      borderBottomColor: theme.colors.divider,
      columnGap: theme.spacing.smd,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surfaceAlt,
      flexShrink: 0,
    },
    middle: {
      flex: 1,
      minWidth: 0,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: theme.spacing.sm,
    },
    grade: {
      flexShrink: 0,
    },
    routeName: {
      flexShrink: 1,
    },
    line2: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: theme.spacing.sm,
      marginTop: theme.spacing.xxs,
    },
    meta: {
      flexShrink: 1,
    },
    privateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.layout.iconTextGap,
    },
    trailing: {
      flexShrink: 0,
    },
  });
}
