/**
 * LogSendScreen — the send-logging form.
 *
 * Design system v2.2 (§18A, §19.9): optional compact route summary card, icon SegmentedControl for the
 * style, grouped form card, Stepper for attempts. The submitted payload is unchanged.
 *
 * Entry point 2 (from Route Detail): routeId and grade are pre-populated.
 * Entry point 1 (from global "+"): caller passes routeId + grade after the
 * user selects a route via RouteSearchScreen.
 *
 * Form fields:
 *   - style selector (flash / top / attempt)
 *   - attempts Stepper (1-9999; locked to 1 when style = flash, the previous count returns on unlock)
 *   - date (defaults to today)
 *   - note (optional text, private — shown only to the owner)
 *
 * Grade is NOT stored or editable (AC-011). Grade display is not shown in the
 * log form — it is visible on the route detail screen before the form opens (AC-131).
 * All sends are private (is_private = true hardcoded, AC-132).
 * AC-010: completing the form from a known route page requires ≤4 taps.
 * AC-012: on network failure, shows a clear error — never silent, no offline queue.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, InlineError, SendStylePicker, Stepper, TextField } from '../../../components/ui';
import { CONTINUOUS, RADIUS, innerRadius, useLayout, useTheme } from '../../../lib/theme';
import { TapeBadge } from '@/lib/tape';
import { logAscent } from '../send-service';
import type { AscentStyle } from '../types';

/** Display-only data for the compact route summary card (v2.2 §18A). Nothing here is submitted. */
export interface LogSendRouteSummary {
  /** Stored tape colour name (drives the TapeBadge fill). */
  color: string;
  /** Grade text printed on the tape, e.g. "V4". */
  grade: string;
  /** Route title, e.g. "Red · Zone A". */
  title: string;
  /** Gym name. */
  subtitle?: string;
  /** Route photo (optional; a neutral block is shown without it). */
  photoUri?: string;
}

interface LogSendScreenProps {
  /** Pre-selected route ID — required. */
  routeId: string;
  /** Grade read from Route.grade — displayed but never stored on the ascent. */
  routeGrade: string;
  /**
   * Optional compact route summary card. Callers that do not pass it keep the form without any grade
   * display (AC-131); the card is only rendered when this is provided.
   */
  routeSummary?: LogSendRouteSummary;
  /** Authenticated session. */
  session: Session;
  /** Called after the ascent is successfully saved. */
  onSuccess: () => void;
  /** Called when the user dismisses the form without saving. */
  onCancel: () => void;
}

export default function LogSendScreen({
  routeId,
  routeGrade: _routeGrade,
  routeSummary,
  session,
  onSuccess,
  onCancel,
}: LogSendScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const insets = useSafeAreaInsets();

  // ── Form state ────────────────────────────────────────────────────────────

  const [style, setStyle] = useState<AscentStyle>('top');
  const [attempts, setAttempts] = useState<number>(1);
  /** UI-only: the count before flash locked it to 1, restored when the style changes away from flash. */
  const attemptsBeforeFlash = useRef<number>(1);
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10), // default today: YYYY-MM-DD
  );
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Derived / validation ──────────────────────────────────────────────────

  const isFlash = style === 'flash';
  /** Resolved attempt count — always 1 when style is flash. */
  const resolvedAttempts: number = isFlash ? 1 : Math.min(9999, Math.max(1, attempts));

  function handleStyleSelect(selected: AscentStyle): void {
    if (selected === style) return;
    if (selected === 'flash') {
      attemptsBeforeFlash.current = attempts;
      setAttempts(1);
    } else if (isFlash) {
      setAttempts(attemptsBeforeFlash.current);
    }
    setStyle(selected);
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
        is_private: true,
      });
      onSuccess();
    } catch {
      // AC-012: never silent. A translated sentence, never the raw error message.
      setErrorMessage(t('sends.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const attemptsLabel = t('sends.attempts');
  const thumbSize = theme.componentSize.routeThumbCompact;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.sm,
        paddingHorizontal: screenMargin,
        paddingBottom: theme.spacing.xxl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.layout.minTouchTarget,
          marginBottom: theme.layout.sectionGap,
        }}
      >
        <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" size="md" on="background" />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}
        >
          <AppText variant="title3" accessibilityRole="header">
            {t('sends.logSend')}
          </AppText>
        </View>
      </View>

      {/* Compact route summary: card 20, padding 8, thumbnail innerRadius(20, 8) = 12, tape 6. */}
      {routeSummary && (
        <Card
          variant="static"
          padding={theme.layout.routeCardPadding}
          style={{ marginBottom: theme.layout.cardGap }}
        >
          <View
            accessible
            accessibilityLabel={[routeSummary.grade, routeSummary.title, routeSummary.subtitle]
              .filter((p): p is string => !!p)
              .join(', ')}
            style={{ flexDirection: 'row', alignItems: 'center', columnGap: theme.spacing.smd }}
          >
            <View
              style={{
                width: thumbSize,
                height: thumbSize,
                borderRadius: innerRadius(RADIUS.card, theme.layout.routeCardPadding),
                ...CONTINUOUS,
                overflow: 'hidden',
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              {routeSummary.photoUri ? (
                <Image source={{ uri: routeSummary.photoUri }} style={{ width: thumbSize, height: thumbSize }} accessibilityIgnoresInvertColors />
              ) : null}
            </View>
            <View>
              <TapeBadge color={routeSummary.color} grade={routeSummary.grade} size="lg" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="headline" numberOfLines={1}>
                {routeSummary.title}
              </AppText>
              {routeSummary.subtitle ? (
                <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
                  {routeSummary.subtitle}
                </AppText>
              ) : null}
            </View>
          </View>
        </Card>
      )}

      {/* Grouped form card: ONE card, fields gap 16, each field keeps its own border. */}
      <Card variant="static" style={{ rowGap: theme.layout.fieldGap }}>
        {/* Style selector — Tap 2 in the ≤4-tap flow */}
        <View style={{ rowGap: theme.spacing.sm }}>
          <AppText variant="fieldLabel">{t('sends.style')}</AppText>
          <SendStylePicker value={style} onChange={handleStyleSelect} />
        </View>

        {/* Attempts — locked to 1 for flash; the previous count returns on unlock. */}
        <Stepper
          label={attemptsLabel}
          description={t('sends.attemptsDescription')}
          value={isFlash ? 1 : attempts}
          onChange={setAttempts}
          valueText={(n) => t('sends.attemptsCount', { count: n })}
          locked={isFlash}
          lockedDescription={t('sends.attemptsFlashLocked')}
          lockedAnnouncement={t('ui.stepper.announceLocked', {
            label: attemptsLabel,
            value: t('sends.attemptsCount', { count: 1 }),
          })}
          doneLabel={t('ui.stepper.done')}
          hapticSource="stepper-attempts"
        />

        {/* Date input (ISO date string YYYY-MM-DD). No date picker exists today. */}
        <TextField
          label={t('sends.date')}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
        />

        {/* Note input — marked as private in the UI */}
        <TextField
          variant="multiline"
          label={t('sends.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('sends.notePlaceholder')}
          maxLength={500}
          showCount
        />
      </Card>

      {/* Error message — AC-012: always shown on failure */}
      {errorMessage !== null && (
        <View style={{ marginTop: theme.layout.sectionGap }}>
          <InlineError variant="block" message={errorMessage} />
        </View>
      )}

      {/* Submit — Tap 4 (confirm) in the ≤4-tap flow */}
      <View style={{ marginTop: theme.layout.sectionGap }}>
        <Button
          label={t('sends.submit')}
          onPress={() => void handleSubmit()}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
        />
      </View>
    </ScrollView>
  );
}
