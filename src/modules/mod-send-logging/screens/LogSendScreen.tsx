/**
 * LogSendScreen — the send-logging form.
 *
 * Entry point 2 (from Route Detail): routeId and grade are pre-populated.
 * Entry point 1 (from global "+"): caller passes routeId + grade after the
 * user selects a route via RouteSearchScreen.
 *
 * Form fields:
 *   - style selector (flash / top / attempt)
 *   - attempts number input (min 1; locked to 1 when style = flash)
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
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, InlineError, SendStylePicker, TextField } from '../../../components/ui';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useLayout, useTheme } from '../../../lib/theme';
import { logAscent } from '../send-service';
import type { AscentStyle } from '../types';

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
  routeGrade: _routeGrade,
  session,
  onSuccess,
  onCancel,
}: LogSendScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { duration } = useMotion();
  const insets = useSafeAreaInsets();

  // ── Form state ────────────────────────────────────────────────────────────

  const [style, setStyle] = useState<AscentStyle>('top');
  // Flash forces attempts = 1 per spec validation rule.
  const [attempts, setAttemptsRaw] = useState<string>('1');
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10), // default today: YYYY-MM-DD
  );
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Motion D2: the attempts field cross-fades (short) into / out of the locked "1" when flash toggles.
  const attemptsFade = useRef(new Animated.Value(1)).current;
  const wasFlash = useRef<boolean>(false);
  useEffect(() => {
    const isFlash = style === 'flash';
    if (isFlash === wasFlash.current) return;
    wasFlash.current = isFlash;
    attemptsFade.setValue(0);
    Animated.timing(attemptsFade, {
      toValue: 1,
      duration: duration.short,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

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
    // Clamp immediately so '0' or empty never displays — min 1 at all times.
    const parsed = parseInt(value, 10);
    if (value === '' || isNaN(parsed)) {
      setAttemptsRaw('1');
    } else {
      setAttemptsRaw(String(Math.max(1, parsed)));
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

      {/* Style selector — Tap 2 in the ≤4-tap flow */}
      <AppText variant="sectionHeader" style={{ marginBottom: theme.spacing.sm }}>
        {t('sends.style')}
      </AppText>
      <SendStylePicker value={style} onChange={handleStyleSelect} />

      {/* Attempts input — locked to 1 for flash */}
      <Animated.View style={{ marginTop: theme.layout.sectionGap, opacity: attemptsFade }}>
        <TextField
          label={t('sends.attempts')}
          value={style === 'flash' ? '1' : attempts}
          onChangeText={handleAttemptsChange}
          keyboardType="number-pad"
          returnKeyType="done"
          readOnly={style === 'flash'}
          helper={style === 'flash' ? t('sends.attemptsFlashHint') : undefined}
          maxLength={4}
        />
      </Animated.View>

      {/* Date input (ISO date string YYYY-MM-DD). No date picker exists today. */}
      <View style={{ marginTop: theme.layout.sectionGap }}>
        <TextField
          label={t('sends.date')}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      {/* Note input — marked as private in the UI */}
      <View style={{ marginTop: theme.layout.sectionGap }}>
        <TextField
          variant="multiline"
          label={t('sends.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('sends.notePlaceholder')}
          maxLength={500}
          showCount
        />
      </View>

      {/* Error message — AC-012: always shown on failure */}
      {errorMessage !== null && (
        <View style={{ marginTop: theme.layout.sectionGap }}>
          <InlineError variant="block" message={errorMessage} />
        </View>
      )}

      {/* Submit — Tap 4 (confirm) in the ≤4-tap flow */}
      <View style={{ marginTop: theme.spacing.xl }}>
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
