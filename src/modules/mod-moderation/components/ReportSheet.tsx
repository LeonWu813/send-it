/**
 * ReportSheet — BottomSheet `form` for submitting a user-profile report (AC-080, AC-081).
 *
 * Design system §32.10 (A):
 *   - Reason: ListRow `radio` rows (44pt min) for the 4 categories.
 *   - Note: TextField `multiline` with a 0/280 counter.
 *   - NoticeBox explains the outcome (report only, does not block) above the submit button.
 *   - Submit: lg primary, disabled until a reason is chosen (with a hint), loading while sending.
 *   - Failure: InlineError block above the button, input kept. Success: sheet closes + toast.
 *   - Keyboard avoidance and the sticky footer come from BottomSheet `form`.
 *
 * Requires a ToastProvider above it (mounted once by AppShell).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Button,
  ListRow,
  NoticeBox,
  TextField,
  useToast,
} from '../../../components/ui';
import { useMotion } from '../../../lib/motion';
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
  /** Whether the sheet is visible. */
  visible: boolean;
  /** Called when the sheet should be dismissed (close, cancel or after success). */
  onDismiss: () => void;
  /** Reason selected each time the sheet opens (default: none). */
  defaultCategory?: ReportCategory | null;
  /** Note filled in each time the sheet opens (default: empty). */
  defaultNote?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportSheet({
  targetUserId,
  visible,
  onDismiss,
  defaultCategory = null,
  defaultNote = '',
}: ReportSheetProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { haptic } = useMotion();
  const toast = useToast();

  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(defaultCategory);
  const [note, setNote] = useState(defaultNote);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Fresh form each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setSelectedCategory(defaultCategory);
    setNote(defaultNote);
    setSubmitting(false);
    setError(undefined);
  }, [visible, defaultCategory, defaultNote]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCategory) return;

    setSubmitting(true);
    setError(undefined);

    try {
      await reportUser(targetUserId, selectedCategory, note.trim() || undefined);
      haptic('success', 'report-submit');
      onDismiss();
      toast.show({ message: t('moderation.report.confirmation') });
    } catch {
      haptic('error', 'report-submit');
      setError(t('moderation.report.error'));
    } finally {
      setSubmitting(false);
    }
  }, [targetUserId, selectedCategory, note, t, haptic, onDismiss, toast]);

  const footer = (
    <View>
      <View style={{ marginBottom: theme.spacing.md }}>
        <NoticeBox message={t('moderation.report.notice')} />
      </View>
      {selectedCategory === null ? (
        <AppText
          variant="footnote"
          color="textSecondary"
          align="center"
          style={{ marginBottom: theme.spacing.sm }}
        >
          {t('moderation.report.pickReason')}
        </AppText>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        label={t('moderation.report.submit')}
        loading={submitting}
        disabled={selectedCategory === null}
        onPress={() => void handleSubmit()}
      />
    </View>
  );

  return (
    <BottomSheet
      variant="form"
      visible={visible}
      onClose={onDismiss}
      title={t('moderation.report.title')}
      loading={submitting}
      error={error}
      footer={footer}
    >
      <AppText variant="sectionHeader" color="textSecondary">
        {t('moderation.report.category')}
      </AppText>
      <View accessibilityRole="radiogroup" style={{ marginBottom: theme.layout.cardGap }}>
        {CATEGORIES.map((cat, i) => (
          <ListRow
            key={cat}
            variant="radio"
            on="elevated"
            inset="grouped"
            title={t(`moderation.report.categories.${cat}`)}
            selected={selectedCategory === cat}
            disabled={submitting}
            divider={i < CATEGORIES.length - 1}
            onPress={() => {
              haptic('select', 'report-reason');
              setSelectedCategory(cat);
            }}
          />
        ))}
      </View>

      <TextField
        variant="multiline"
        label={t('moderation.report.note')}
        placeholder={t('moderation.report.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        maxLength={NOTE_MAX_LENGTH}
        showCount
        disabled={submitting}
      />
    </BottomSheet>
  );
}
