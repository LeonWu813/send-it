/**
 * FilterBar — horizontal filter row for send history.
 *
 * Renders pill-shaped filter chips for gym, grade, and date range.
 * Tapping a chip opens a simple picker overlay (ActionSheet-style options list).
 * All three filters work independently and in combination (AC-060).
 *
 * Uses theme tokens only — no hardcoded colors or spacing.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../lib/theme';
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterBar({
  filters,
  gyms,
  onFiltersChange,
}: FilterBarProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // ── Date range presets ───────────────────────────────────────────────────

  const DATE_PRESETS = [
    { label: t('profileHistory.filter.last7Days'),  days: 7 },
    { label: t('profileHistory.filter.last30Days'), days: 30 },
    { label: t('profileHistory.filter.last90Days'), days: 90 },
    { label: t('profileHistory.filter.thisYear'),   days: 365 },
  ];

  function applyDatePreset(days: number): void {
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    onFiltersChange({
      ...filters,
      date_from: from.toISOString(),
      date_to: now.toISOString(),
    });
    setActivePicker(null);
  }

  function clearDate(): void {
    onFiltersChange({ ...filters, date_from: null, date_to: null });
    setActivePicker(null);
  }

  // ── Chip label helpers ──────────────────────────────────────────────────

  function gymLabel(): string {
    if (!filters.gym_id) return t('profileHistory.filter.gym');
    const found = gyms.find((g) => g.id === filters.gym_id);
    return found?.name ?? t('profileHistory.filter.gym');
  }

  function gradeLabel(): string {
    return filters.grade ?? t('profileHistory.filter.grade');
  }

  function dateLabel(): string {
    if (!filters.date_from) return t('profileHistory.filter.date');
    const from = new Date(filters.date_from);
    return from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}
      >
        {/* Gym filter chip */}
        <Pressable
          style={[styles.chip, filters.gym_id !== null && styles.chipActive]}
          onPress={() => setActivePicker(activePicker === 'gym' ? null : 'gym')}
          accessibilityRole="button"
          accessibilityLabel={t('profileHistory.filter.gymA11y')}
          accessibilityState={{ selected: filters.gym_id !== null }}
        >
          <Text style={[styles.chipText, filters.gym_id !== null && styles.chipTextActive]}>
            {gymLabel()}
          </Text>
          {filters.gym_id !== null && (
            <Pressable
              onPress={() => onFiltersChange({ ...filters, gym_id: null })}
              hitSlop={8}
              accessibilityLabel={t('profileHistory.filter.clearGym')}
            >
              <Text style={styles.chipClear}>  ×</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Grade filter chip */}
        <Pressable
          style={[styles.chip, filters.grade !== null && styles.chipActive]}
          onPress={() => setActivePicker(activePicker === 'grade' ? null : 'grade')}
          accessibilityRole="button"
          accessibilityLabel={t('profileHistory.filter.gradeA11y')}
          accessibilityState={{ selected: filters.grade !== null }}
        >
          <Text style={[styles.chipText, filters.grade !== null && styles.chipTextActive]}>
            {gradeLabel()}
          </Text>
          {filters.grade !== null && (
            <Pressable
              onPress={() => onFiltersChange({ ...filters, grade: null })}
              hitSlop={8}
              accessibilityLabel={t('profileHistory.filter.clearGrade')}
            >
              <Text style={styles.chipClear}>  ×</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Date filter chip */}
        <Pressable
          style={[styles.chip, filters.date_from !== null && styles.chipActive]}
          onPress={() => setActivePicker(activePicker === 'date' ? null : 'date')}
          accessibilityRole="button"
          accessibilityLabel={t('profileHistory.filter.dateA11y')}
          accessibilityState={{ selected: filters.date_from !== null }}
        >
          <Text style={[styles.chipText, filters.date_from !== null && styles.chipTextActive]}>
            {dateLabel()}
          </Text>
          {filters.date_from !== null && (
            <Pressable
              onPress={() => onFiltersChange({ ...filters, date_from: null, date_to: null })}
              hitSlop={8}
              accessibilityLabel={t('profileHistory.filter.clearDate')}
            >
              <Text style={styles.chipClear}>  ×</Text>
            </Pressable>
          )}
        </Pressable>
      </ScrollView>

      {/* ── Picker modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setActivePicker(null)}>
          <View style={styles.pickerSheet}>
            {/* Gym picker */}
            {activePicker === 'gym' && (
              <>
                <Text style={styles.pickerTitle}>{t('profileHistory.filter.gym')}</Text>
                <ScrollView>
                  <Pressable
                    style={styles.pickerItem}
                    onPress={() => {
                      onFiltersChange({ ...filters, gym_id: null });
                      setActivePicker(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{t('profileHistory.filter.allGyms')}</Text>
                  </Pressable>
                  {gyms.map((gym) => (
                    <Pressable
                      key={gym.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        onFiltersChange({ ...filters, gym_id: gym.id });
                        setActivePicker(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          filters.gym_id === gym.id && styles.pickerItemActive,
                        ]}
                      >
                        {gym.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Grade picker */}
            {activePicker === 'grade' && (
              <>
                <Text style={styles.pickerTitle}>{t('profileHistory.filter.grade')}</Text>
                <ScrollView>
                  <Pressable
                    style={styles.pickerItem}
                    onPress={() => {
                      onFiltersChange({ ...filters, grade: null });
                      setActivePicker(null);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{t('profileHistory.filter.allGrades')}</Text>
                  </Pressable>
                  {GRADE_ORDER.map((g) => (
                    <Pressable
                      key={g}
                      style={styles.pickerItem}
                      onPress={() => {
                        onFiltersChange({ ...filters, grade: g });
                        setActivePicker(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          filters.grade === g && styles.pickerItemActive,
                        ]}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Date picker */}
            {activePicker === 'date' && (
              <>
                <Text style={styles.pickerTitle}>{t('profileHistory.filter.date')}</Text>
                {DATE_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.days}
                    style={styles.pickerItem}
                    onPress={() => applyDatePreset(preset.days)}
                  >
                    <Text style={styles.pickerItemText}>{preset.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.pickerItem} onPress={clearDate}>
                  <Text style={styles.pickerItemText}>{t('profileHistory.filter.allTime')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    row: {
      flexGrow: 0,
      marginBottom: theme.spacing.md,
    },
    rowContent: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    chipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    chipTextActive: {
      color: theme.colors.textInverse,
    },
    chipClear: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textInverse,
    },
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      maxHeight: 400,
    },
    pickerTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    pickerItem: {
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    pickerItemText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
    },
    pickerItemActive: {
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.semibold,
    },
  });
}
