/**
 * ReportSheet — bottom-sheet modal for submitting a user-profile report (AC-080, AC-081).
 *
 * Renders a React Native Modal (transparent, animationType: 'slide') with:
 *   - Category picker: 4 options (inappropriate | spam | harassment | other)
 *   - Optional note text input (max 280 chars, enforced by maxLength)
 *   - Submit button → calls reportUser → shows confirmation state (AC-081)
 *   - Cancel / dismiss
 *
 * Uses useTheme() for all colors and useTranslation('common') for all strings.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { reportUser } from '../moderation-service';
import type { ReportCategory } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: ReportCategory[] = ['inappropriate', 'spam', 'harassment', 'other'];
const NOTE_MAX_LENGTH = 280;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReportSheetProps {
  /** UUID of the user being reported. */
  targetUserId: string;
  /** Whether the modal is visible. */
  visible: boolean;
  /** Called when the sheet should be dismissed (cancel or after confirmation). */
  onDismiss: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportSheet({
  targetUserId,
  visible,
  onDismiss,
}: ReportSheetProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.bottom);

  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state when modal is opened.
  const handleShow = useCallback(() => {
    setSelectedCategory(null);
    setNote('');
    setSubmitting(false);
    setConfirmed(false);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCategory) return;

    setSubmitting(true);
    setError(null);

    try {
      await reportUser(targetUserId, selectedCategory, note.trim() || undefined);
      setConfirmed(true);
    } catch {
      setError(t('moderation.report.error'));
    } finally {
      setSubmitting(false);
    }
  }, [targetUserId, selectedCategory, note, t]);

  const handleDismiss = useCallback(() => {
    // Reset state before dismissing so next open is clean.
    setSelectedCategory(null);
    setNote('');
    setSubmitting(false);
    setConfirmed(false);
    setError(null);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleShow}
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <View style={styles.sheet}>
        {confirmed ? (
          // ── Confirmation state (AC-081) ──────────────────────────────────
          <View style={styles.confirmationContainer}>
            <Text style={styles.confirmationText}>
              {t('moderation.report.confirmation')}
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
            >
              <Text style={styles.primaryButtonText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        ) : (
          // ── Report form ──────────────────────────────────────────────────
          <>
            <Text style={styles.title}>{t('moderation.report.title')}</Text>

            {/* Category picker */}
            <Text style={styles.sectionLabel}>{t('moderation.report.category')}</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedCategory === cat }}
                  accessibilityLabel={t(`moderation.report.categories.${cat}`)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat && styles.categoryChipTextSelected,
                    ]}
                  >
                    {t(`moderation.report.categories.${cat}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Optional note */}
            <Text style={styles.sectionLabel}>{t('moderation.report.note')}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              placeholderTextColor={theme.colors.textDisabled}
              placeholder={t('moderation.report.note')}
              accessibilityLabel={t('moderation.report.note')}
            />
            <Text style={styles.charCount}>
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>

            {/* Error */}
            {error !== null && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Actions */}
            <Pressable
              style={[
                styles.primaryButton,
                (!selectedCategory || submitting) && styles.primaryButtonDisabled,
              ]}
              onPress={() => void handleSubmit()}
              disabled={!selectedCategory || submitting}
              accessibilityRole="button"
              accessibilityLabel={t('moderation.report.submit')}
              accessibilityState={{ disabled: !selectedCategory || submitting }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.colors.textInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t('moderation.report.submit')}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={handleDismiss}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={t('moderation.report.cancel')}
            >
              <Text style={styles.cancelButtonText}>
                {t('moderation.report.cancel')}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], bottomInset: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      paddingBottom: Math.max(bottomInset, theme.spacing.lg),
    },
    title: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    sectionLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    categoryChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    categoryChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryChipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
    },
    categoryChipTextSelected: {
      color: theme.colors.textInverse,
      fontWeight: theme.fontWeight.semibold,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceElevated,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    cancelButton: {
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
    },
    confirmationContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
    },
    confirmationText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
  });
}
