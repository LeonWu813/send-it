import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, View } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { ParticleBurst } from './Particles';

export type SendStyle = 'top' | 'flash' | 'attempt';

const GLYPH: Record<SendStyle, { filled: IoniconName; outline: IoniconName }> = {
  top: { filled: ICON.sendTop.filled, outline: ICON.sendTop.outline },
  flash: { filled: ICON.sendFlash.filled, outline: ICON.sendFlash.outline },
  // I3 exception: attempt is ellipse-outline in every state (a filled circle would read as "achieved")
  attempt: { filled: ICON.sendAttempt.outline, outline: ICON.sendAttempt.outline },
};

const LABEL: Record<SendStyle, 'ui.sendStyle.top' | 'ui.sendStyle.flash' | 'ui.sendStyle.attempt'> = {
  top: 'ui.sendStyle.top',
  flash: 'ui.sendStyle.flash',
  attempt: 'ui.sendStyle.attempt',
};

export interface SendStyleChipProps {
  /** top = Send (solid sendTop), flash = Flash (sendFlashContainer + gold), attempt = Attempt (neutral). */
  sendStyle: SendStyle;
  /** attempt only: "Attempt x3". Send / Flash never show a count. */
  attempts?: number;
  /**
   * Change this value (e.g. a new row id) when the row has just landed: the icon plays its pop. top:
   * `grip` 0.6 -> 1. flash: `topOut` 0.6 -> overshoot -> 1. attempt: cross-fade only. Reduce Motion: fade.
   */
  landing?: number | string;
  /** flash + landing: also play `particles.flash` from the chip (first flash of the day only; the caller decides). */
  burst?: boolean;
}

/**
 * Status marker (not pressable): a pill (never a square, that is tape) with a glyph + text, so
 * Send / Flash / Attempt differ by colour, glyph AND word. caption1 600, glyph xs 14.
 */
export function SendStyleChip({ sendStyle, attempts, landing, burst }: SendStyleChipProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { spring, duration, reduceMotion } = useMotion();
  const c = theme.colors;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (landing === undefined) return;
    if (reduceMotion || sendStyle === 'attempt') {
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      return;
    }
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, ...(sendStyle === 'flash' ? spring.topOut : spring.grip), ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing]);

  const spec: Record<SendStyle, { bg: PaletteKey; fg: PaletteKey }> = {
    top: { bg: 'sendTop', fg: 'onSendTop' },
    flash: { bg: 'sendFlashContainer', fg: 'sendFlash' },
    attempt: { bg: 'sendAttemptContainer', fg: 'sendAttempt' },
  };
  const { bg, fg } = spec[sendStyle];
  const text = sendStyle === 'attempt' && attempts && attempts > 0 ? t('ui.sendStyle.attemptWithCount', { count: attempts }) : t(LABEL[sendStyle]);
  const fade = reduceMotion || sendStyle === 'attempt';

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: c[bg],
      }}
    >
      <Animated.View
        style={{ marginRight: theme.layout.iconTextGap, opacity: fade ? pop : 1, transform: fade ? [] : [{ scale: pop }] }}
      >
        <Ionicons name={GLYPH[sendStyle].filled} size={theme.iconSize.xs} color={c[fg]} />
        {burst && sendStyle === 'flash' && landing !== undefined ? <ParticleBurst kind="flash" playKey={landing} /> : null}
      </Animated.View>
      <AppText variant="caption1" weight="600" style={{ color: c[fg] }} numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

export interface SendStylePickerProps {
  value?: SendStyle;
  onChange: (value: SendStyle) => void;
  disabled?: boolean;
}

/**
 * Log-send selector: three equal `choice` chips (min 44, subhead, md glyph) in a radiogroup. Selected =
 * secondaryContainer + 1.5pt primary + 600 weight for ALL three (gold / emerald are not used here, C1);
 * the glyph goes filled (attempt stays ellipse-outline) and pops with `grip` (flash too: not earned yet).
 * Haptic `select` (sourceId send-style). The flash -> "attempts locked at 1" behaviour is the caller's.
 */
export function SendStylePicker({ value, onChange, disabled }: SendStylePickerProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { haptic } = useMotion();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('ui.sendStyle.group')}
      style={{ flexDirection: 'row', columnGap: theme.layout.inlineGap }}
    >
      {(['top', 'flash', 'attempt'] as SendStyle[]).map((s) => (
        <Chip
          key={s}
          size="large"
          variant="choice"
          label={t(LABEL[s])}
          icon={GLYPH[s].outline}
          iconSelected={GLYPH[s].filled}
          iconPop
          selected={value === s}
          disabled={disabled}
          onPress={() => {
            haptic('select', 'send-style');
            onChange(s);
          }}
          style={{ flex: 1 }}
        />
      ))}
    </View>
  );
}
