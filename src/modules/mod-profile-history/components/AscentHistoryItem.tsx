/**
 * AscentHistoryItem — single row in the send history list (design system v2.2, spec §32.7).
 *
 * Follows the ListRow `content` pattern (min 52, vertical 14, 56 media-radius thumbnail, `headline`
 * title, `footnote` subtitle, trailing SendStatus `disc`), built here because line 1 holds a TapeBadge
 * next to the area name, which ListRow's string `title` cannot carry.
 *
 *   [thumb 56]  [TapeBadge md grade] Area (headline)             (disc 28)
 *               Color · Gym · Date  (lock 12 + Private)
 *
 * - With a photo: thumbnail = photo; line 1 = TapeBadge md (grade) + 8 + area.
 * - Without a photo: the same 56 `surfaceAlt` square holds the TapeBadge md (grade), so the row's left
 *   edge always aligns; line 1 is the area only.
 * - At fontScale >= 1.6 the disc moves to the start of line 2 and the name gets 2 lines.
 * - One merged VoiceOver label for the whole row.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, SendStatus } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { TapeBadge } from '@/lib/tape';
import type { HistoryAscent } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AscentHistoryItemProps {
  item: HistoryAscent;
  /** Hairline under the row, starting at the title's left edge. Omit on the last row of a group. */
  divider?: boolean;
}

/** AX threshold from the spec. */
const AX_FONT_SCALE = 1.6;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Short locale date, e.g. "Oct 12" / "10月12日". */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AscentHistoryItem({
  item,
  divider = true,
}: AscentHistoryItemProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;
  const styles = makeStyles(theme, screenMargin);

  // Route name per production.md Route Display Name Format: "{LocalizedColor} (Section)".
  const colorLabel = item.color_tag ? t(`routeCatalog.colors.${item.color_tag}`) : '';
  const sectionLabel = item.section_label ?? '';
  const routeName = [colorLabel, item.section_label ? `(${item.section_label})` : '']
    .filter(Boolean)
    .join(' ');
  // Line 1 is the area; a route without one falls back to the colour name.
  const title = sectionLabel || colorLabel;

  const date = formatDate(item.logged_at);
  const styleLabel = t(`sends.styles.${item.style}`);

  // "V4 Red (Cave), Boulder Planet, Flash, Oct 12, Private"
  const a11yLabel = [
    `${item.grade}${routeName ? ` ${routeName}` : ''}`,
    item.gym_name,
    styleLabel,
    date,
    item.is_private ? t('sends.privateLabel') : null,
  ]
    .filter(Boolean)
    .join(', ');

  const disc = (
    <SendStatus
      sendStyle={item.style}
      variant="disc"
      attempts={item.style === 'attempt' ? item.attempts : undefined}
    />
  );

  const tape = item.color_tag ? <TapeBadge color={item.color_tag} size="md" grade={item.grade} /> : null;
  const hasPhoto = !!item.photo_url;
  const subtitle = [colorLabel, item.gym_name, date].filter(Boolean).join('・');

  return (
    <View accessible accessibilityLabel={a11yLabel}>
      <View style={styles.row}>
        <View style={styles.thumb}>
          {hasPhoto ? (
            <Image source={{ uri: item.photo_url as string }} style={styles.photo} />
          ) : (
            tape ?? (
              <AppText variant="headline" numeric>
                {item.grade}
              </AppText>
            )
          )}
        </View>

        <View style={styles.middle}>
          <View style={styles.line1}>
            {hasPhoto ? tape : null}
            {title ? (
              <AppText variant="headline" numberOfLines={ax ? 2 : 1} style={styles.title}>
                {title}
              </AppText>
            ) : null}
          </View>

          <View style={styles.line2}>
            {ax ? disc : null}
            <AppText variant="footnote" color="textSecondary" numberOfLines={ax ? 2 : 1} style={styles.meta}>
              {subtitle}
            </AppText>
            {item.is_private ? (
              <View style={styles.privateRow}>
                <Ionicons
                  name={ICON.locked.outline}
                  size={theme.iconSize.xs}
                  color={theme.colors.textSecondary}
                />
                <AppText variant="footnote" color="textSecondary">
                  {t('sends.privateLabel')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {!ax ? <View style={styles.trailing}>{disc}</View> : null}
      </View>
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  const thumb = theme.componentSize.listThumb;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: theme.layout.listRowPaddingV,
      paddingHorizontal: screenMargin,
    },
    thumb: {
      width: thumb,
      height: thumb,
      borderRadius: theme.radius.media,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.smd,
      flexShrink: 0,
    },
    photo: {
      width: thumb,
      height: thumb,
    },
    middle: {
      flex: 1,
      minWidth: 0,
    },
    line1: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.spacing.sm,
    },
    title: {
      flexShrink: 1,
    },
    line2: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: theme.spacing.sm,
      marginTop: theme.layout.stackTight,
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
      marginLeft: theme.spacing.smd,
    },
    divider: {
      height: theme.stroke.hairline,
      backgroundColor: theme.colors.divider,
      marginLeft: screenMargin + thumb + theme.spacing.smd,
    },
  });
}
