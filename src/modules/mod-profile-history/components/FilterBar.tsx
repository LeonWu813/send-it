/**
 * FilterBar — filter row for send history (spec §32.6).
 *
 * Three `filter` Chips (gym, grade, date). A chip with a value shows that value
 * and a separate 44pt clear button (never nested). Tapping a chip opens a
 * BottomSheet `list-single` whose first row is "All ...". All three filters
 * work independently and in combination (AC-060).
 *
 * Motion D3 (chip width, clear-button pop) lives in the `ui/` Chip.
 * Tokens only.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, Chip, ListRow, useSheetSelect } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import type { GymSummary } from '../history-service';
import type { HistoryFilters } from '../types';
import { GRADE_ORDER } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: HistoryFilters;
  gyms: GymSummary[];
  onFiltersChange: (updated: HistoryFilters) => void;
}

type ActivePicker = 'gym' | 'grade' | 'date' | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Preset windows. 365 days is "last year" (a rolling window, not the calendar year). */
const DATE_PRESET_DAYS = [7, 30, 90, 365] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterBar({
  filters,
  gyms,
  onFiltersChange,
}: FilterBarProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);

  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = (): void => setSheetOpen(false);
  const select = useSheetSelect(closeSheet);

  function open(picker: Exclude<ActivePicker, null>): void {
    setActivePicker(picker);
    setSheetOpen(true);
  }

  // ── Date range presets ───────────────────────────────────────────────────

  const presetLabel = (days: number): string =>
    t(
      days === 7
        ? 'profileHistory.filter.last7Days'
        : days === 30
          ? 'profileHistory.filter.last30Days'
          : days === 90
            ? 'profileHistory.filter.last90Days'
            : 'profileHistory.filter.lastYear',
    );

  function applyDatePreset(days: number): void {
    const now = new Date();
    const from = new Date(now.getTime() - days * DAY_MS);
    onFiltersChange({ ...filters, date_from: from.toISOString(), date_to: now.toISOString() });
  }

  /** Which preset the current range corresponds to (null = custom range). */
  function activePresetDays(): number | null {
    if (!filters.date_from) return null;
    const to = filters.date_to ? new Date(filters.date_to).getTime() : Date.now();
    const days = Math.round((to - new Date(filters.date_from).getTime()) / DAY_MS);
    return (DATE_PRESET_DAYS as readonly number[]).includes(days) ? days : null;
  }

  // ── Chip value labels ───────────────────────────────────────────────────

  const gymValue = filters.gym_id ? gyms.find((g) => g.id === filters.gym_id)?.name : undefined;
  const gymHasValue = filters.gym_id !== null;
  const gymLabel = gymValue ?? t('profileHistory.filter.gym');
  const gradeLabel = filters.grade ?? t('profileHistory.filter.grade');

  const presetDays = activePresetDays();
  const dateLabel = !filters.date_from
    ? t('profileHistory.filter.date')
    : presetDays !== null
      ? presetLabel(presetDays)
      : new Date(filters.date_from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <View style={styles.row}>
        <Chip
          variant="filter"
          label={gymLabel}
          selected={gymHasValue}
          onPress={() => open('gym')}
          onClear={() => onFiltersChange({ ...filters, gym_id: null })}
          clearAccessibilityLabel={t('profileHistory.filter.clearGym')}
          accessibilityLabel={`${t('profileHistory.filter.gymA11y')}, ${gymLabel}`}
        />
        <Chip
          variant="filter"
          label={gradeLabel}
          selected={filters.grade !== null}
          onPress={() => open('grade')}
          onClear={() => onFiltersChange({ ...filters, grade: null })}
          clearAccessibilityLabel={t('profileHistory.filter.clearGrade')}
          accessibilityLabel={`${t('profileHistory.filter.gradeA11y')}, ${gradeLabel}`}
        />
        <Chip
          variant="filter"
          label={dateLabel}
          selected={filters.date_from !== null}
          onPress={() => open('date')}
          onClear={() => onFiltersChange({ ...filters, date_from: null, date_to: null })}
          clearAccessibilityLabel={t('profileHistory.filter.clearDate')}
          accessibilityLabel={`${t('profileHistory.filter.dateA11y')}, ${dateLabel}`}
        />
      </View>

      {/* ── Picker: BottomSheet list-single ───────────────────────────────── */}
      <BottomSheet
        visible={sheetOpen}
        variant="list-single"
        onClose={closeSheet}
        onClosed={() => setActivePicker(null)}
        title={
          activePicker === 'gym'
            ? t('profileHistory.filter.gym')
            : activePicker === 'grade'
              ? t('profileHistory.filter.grade')
              : t('profileHistory.filter.date')
        }
      >
        {activePicker === 'gym' && (
          <>
            <ListRow
              on="elevated"
              inset="grouped"
              variant="selectable"
              title={t('profileHistory.filter.allGyms')}
              selected={filters.gym_id === null}
              onPress={() => select(() => onFiltersChange({ ...filters, gym_id: null }))}
            />
            {gyms.map((gym, i) => (
              <ListRow
                key={gym.id}
                on="elevated"
                inset="grouped"
                variant="selectable"
                title={gym.name}
                selected={filters.gym_id === gym.id}
                divider={i < gyms.length - 1}
                onPress={() => select(() => onFiltersChange({ ...filters, gym_id: gym.id }))}
              />
            ))}
          </>
        )}

        {activePicker === 'grade' && (
          <>
            <ListRow
              on="elevated"
              inset="grouped"
              variant="selectable"
              title={t('profileHistory.filter.allGrades')}
              selected={filters.grade === null}
              onPress={() => select(() => onFiltersChange({ ...filters, grade: null }))}
            />
            {GRADE_ORDER.map((g, i) => (
              <ListRow
                key={g}
                on="elevated"
                inset="grouped"
                variant="selectable"
                title={g}
                selected={filters.grade === g}
                divider={i < GRADE_ORDER.length - 1}
                onPress={() => select(() => onFiltersChange({ ...filters, grade: g }))}
              />
            ))}
          </>
        )}

        {activePicker === 'date' && (
          <>
            <ListRow
              on="elevated"
              inset="grouped"
              variant="selectable"
              title={t('profileHistory.filter.allTime')}
              selected={filters.date_from === null}
              onPress={() => select(() => onFiltersChange({ ...filters, date_from: null, date_to: null }))}
            />
            {DATE_PRESET_DAYS.map((days, i) => (
              <ListRow
                key={days}
                on="elevated"
                inset="grouped"
                variant="selectable"
                title={presetLabel(days)}
                selected={presetDays === days}
                divider={i < DATE_PRESET_DAYS.length - 1}
                onPress={() => select(() => applyDatePreset(days))}
              />
            ))}
          </>
        )}
      </BottomSheet>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: theme.spacing.sm,
      // 12 so the +6pt hit slops of adjacent rows never overlap.
      rowGap: theme.spacing.smd,
      paddingHorizontal: screenMargin,
      marginBottom: theme.spacing.md,
    },
  });
}
