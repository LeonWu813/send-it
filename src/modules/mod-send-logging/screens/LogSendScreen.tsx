/**
 * LogSendScreen — the send-logging form.
 *
 * Entry point 2 (from Route Detail): routeId and grade are pre-populated.
 * Entry point 1 (from global "+"): caller passes routeId + grade after the
 * user selects a route via RouteSearchScreen.
 *
 * Form fields:
 *   - style selector (flash / top / attempt / project)
 *   - attempts number input (min 1; locked to 1 when style = flash)
 *   - date (defaults to today)
 *   - note (optional text, private — shown only to the owner)
 *   - is_private toggle
 *
 * Grade is displayed (read from route.grade) but NOT stored or editable (AC-011).
 * AC-010: completing the form from a known route page requires ≤4 taps.
 * AC-012: on network failure, shows a clear error — never silent, no offline queue.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { logAscent } from '../send-service';
import type { AscentStyle } from '../types';
import { ASCENT_STYLES } from '../types';

interface LogSendScreenProps {
  /** Pre-selected route ID — required. */
  routeId: string;
  /** Grade read from Route.grade — displayed but never stored on the ascent. */
  routeGrade: string;
  /** Authenticated session. */
  session: Session;
  /** Called after the ascent is successfully saved. */
  onSuccess: () => void;
  /** Called when the user dismisses the form without saving. */
  onCancel: () => void;
}

export default function LogSendScreen({
  routeId,
  routeGrade,
  session,
  onSuccess,
  onCancel,
}: LogSendScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  // ── Form state ────────────────────────────────────────────────────────────

  const [style, setStyle] = useState<AscentStyle>('top');
  // Flash forces attempts = 1 per spec validation rule.
  const [attempts, setAttemptsRaw] = useState<string>('1');
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10), // default today: YYYY-MM-DD
  );
  const [note, setNote] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Derived / validation ──────────────────────────────────────────────────

  /** Resolved attempt count — always 1 when style is flash. */
  const resolvedAttempts: number = style === 'flash' ? 1 : Math.max(1, parseInt(attempts, 10) || 1);

  function handleStyleSelect(selected: AscentStyle): void {
    setStyle(selected);
    if (selected === 'flash') {
      // Flash forces exactly 1 attempt.
      setAttemptsRaw('1');
    }
  }

  function handleAttemptsChange(value: string): void {
    // Allow only numeric input; permit empty string while typing.
    if (/^\d*$/.test(value)) {
      setAttemptsRaw(value);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    // Build logged_at from the chosen date (midnight UTC).
    const loggedAt = new Date(date + 'T00:00:00.000Z').toISOString();

    try {
      await logAscent(session.user.id, {
        route_id: routeId,
        style,
        attempts: resolvedAttempts,
        note: note.trim() === '' ? null : note.trim(),
        logged_at: loggedAt,
        is_private: isPrivate,
      });
      onSuccess();
    } catch (err) {
      // AC-012: never silent. Display the thrown error message.
      const message =
        err instanceof Error
          ? err.message
          : t('sends.errors.saveFailed');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>{t('sends.logSend')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Grade display — read-only, never editable */}
      <View style={styles.gradeDisplay}>
        <Text style={styles.fieldLabel}>{t('sends.grade')}</Text>
        <Text style={styles.gradeValue}>{routeGrade}</Text>
        <Text style={styles.gradeNote}>{t('sends.gradeNote')}</Text>
      </View>

      {/* Style selector — Tap 2 in the ≤4-tap flow */}
      <Text style={styles.fieldLabel}>{t('sends.style')}</Text>
      <View style={styles.styleRow}>
        {ASCENT_STYLES.map((s) => (
          <Pressable
            key={s}
            style={[
              styles.styleChip,
              style === s && styles.styleChipSelected,
            ]}
            onPress={() => handleStyleSelect(s)}
            accessibilityRole="radio"
            accessibilityLabel={t(`sends.styles.${s}`)}
            accessibilityState={{ selected: style === s }}
          >
            <Text
              style={[
                styles.styleChipText,
                style === s && styles.styleChipTextSelected,
              ]}
            >
              {t(`sends.styles.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Attempts input — locked to 1 for flash */}
      <Text style={styles.fieldLabel}>{t('sends.attempts')}</Text>
      <TextInput
        style={[
          styles.attemptsInput,
          style === 'flash' && styles.attemptsInputDisabled,
        ]}
        value={style === 'flash' ? '1' : attempts}
        onChangeText={handleAttemptsChange}
        keyboardType="number-pad"
        returnKeyType="done"
        editable={style !== 'flash'}
        accessibilityLabel={t('sends.attempts')}
        accessibilityHint={
          style === 'flash' ? t('sends.attemptsFlashHint') : undefined
        }
        maxLength={4}
        selectTextOnFocus
      />
      {style === 'flash' && (
        <Text style={styles.flashNote}>{t('sends.attemptsFlashHint')}</Text>
      )}

      {/* Date input (ISO date string YYYY-MM-DD) */}
      <Text style={styles.fieldLabel}>{t('sends.date')}</Text>
      <TextInput
        style={styles.dateInput}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        accessibilityLabel={t('sends.date')}
        maxLength={10}
        keyboardType="numbers-and-punctuation"
      />

      {/* Note input — marked as private in the UI */}
      <Text style={styles.fieldLabel}>{t('sends.note')}</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder={t('sends.notePlaceholder')}
        multiline
        numberOfLines={3}
        accessibilityLabel={t('sends.note')}
        maxLength={500}
        textAlignVertical="top"
      />

      {/* is_private toggle — Tap 3 in the ≤4-tap flow is style; confirm is tap 4 */}
      <View style={styles.privateRow}>
        <View style={styles.privateTextGroup}>
          <Text style={styles.privateLabel}>{t('sends.private')}</Text>
          <Text style={styles.privateDescription}>
            {t('sends.privateDescription')}
          </Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{
            false: theme.colors.border,
            true: theme.colors.primary,
          }}
          thumbColor={theme.colors.surfaceElevated}
          accessibilityLabel={t('sends.private')}
          accessibilityRole="switch"
          accessibilityState={{ checked: isPrivate }}
        />
      </View>

      {/* Error message — AC-012: always shown on failure */}
      {errorMessage !== null && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Submit — Tap 4 (confirm) in the ≤4-tap flow */}
      <Pressable
        style={[
          styles.submitButton,
          isSubmitting && styles.submitButtonDisabled,
        ]}
        onPress={() => void handleSubmit()}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t('sends.submit')}
        accessibilityState={{ disabled: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>{t('sends.submit')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    cancelButton: {
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
    },
    cancelButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    screenTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    headerSpacer: {
      width: 60, // mirrors the cancel button width to center the title
    },
    gradeDisplay: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    gradeValue: {
      fontSize: theme.fontSize.display,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginVertical: theme.spacing.xs,
    },
    gradeNote: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    fieldLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    styleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    styleChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    styleChipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    styleChipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      fontWeight: theme.fontWeight.medium,
    },
    styleChipTextSelected: {
      color: theme.colors.textInverse,
    },
    attemptsInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.lg,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      width: 80,
    },
    attemptsInputDisabled: {
      color: theme.colors.textDisabled,
      backgroundColor: theme.colors.divider,
    },
    flashNote: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    dateInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      width: 160,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      minHeight: 80,
    },
    privateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    privateTextGroup: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    privateLabel: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
    },
    privateDescription: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    errorContainer: {
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
    },
    submitButton: {
      marginTop: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
  });
}
