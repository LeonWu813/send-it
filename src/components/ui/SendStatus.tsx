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
import { ParticleBurst } from './Particles';

export type SendStyle = 'top' | 'flash' | 'attempt';
export type SendStatusVariant = 'disc' | 'tag';

export const SEND_GLYPH: Record<SendStyle, { filled: IoniconName; outline: IoniconName }> = {
  top: { filled: ICON.sendTop.filled, outline: ICON.sendTop.outline },
  flash: { filled: ICON.sendFlash.filled, outline: ICON.sendFlash.outline },
  // I3 exception: attempt is ellipse-outline in every state
  attempt: { filled: ICON.sendAttempt.outline, outline: ICON.sendAttempt.outline },
};

export const SEND_LABEL: Record<SendStyle, 'ui.sendStyle.top' | 'ui.sendStyle.flash' | 'ui.sendStyle.attempt'> = {
  top: 'ui.sendStyle.top',
  flash: 'ui.sendStyle.flash',
  attempt: 'ui.sendStyle.attempt',
};

/** The icon on a status uses `checkmark` for top (spec 18.2). */
const STATUS_GLYPH: Record<SendStyle, IoniconName> = {
  top: ICON.selected.outline,
  flash: ICON.sendFlash.filled,
  attempt: ICON.sendAttempt.outline,
};

export interface SendStatusProps {
  sendStyle: SendStyle;
  /** disc: 28 circle, icon 16 (row trailing). tag: 24 capsule, icon 14 + footnote 600 text (RouteCard, Reel). Default tag. */
  variant?: SendStatusVariant;
  /** attempt only: "Attempt x3" (tag). */
  attempts?: number;
  /**
   * Change this value (a new row id) when the row has just landed: the ICON (never the disc) pops. top:
   * `grip` 0.6 -> 1. flash: `topOut` 0.6 -> 1.3 -> 1. attempt / Reduce Motion: cross-fade only.
   */
  landing?: number | string;
  /** flash + landing: play `particles.flash` from the disc centre (first flash of the day; caller decides). */
  burst?: boolean;
}

/**
 * Tonal, equal-weight status marker (not pressable): top = `sendTopContainer` / `sendTop`, flash =
 * `sendFlashContainer` / `sendFlash`, attempt = `sendAttemptContainer` / `sendAttempt`. Shapes differ
 * (check / bolt / circle), never colour alone. Hidden from VoiceOver when `decorative` (the row label
 * carries the style); otherwise exposes its text.
 */
export function SendStatus({ sendStyle, variant = 'tag', attempts, landing, burst }: SendStatusProps): React.JSX.Element {
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
    if (sendStyle === 'flash') {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.3, duration: duration.micro, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(pop, { toValue: 1, ...spring.topOut, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      Animated.spring(pop, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing]);

  const spec: Record<SendStyle, { bg: PaletteKey; fg: PaletteKey }> = {
    top: { bg: 'sendTopContainer', fg: 'sendTop' },
    flash: { bg: 'sendFlashContainer', fg: 'sendFlash' },
    attempt: { bg: 'sendAttemptContainer', fg: 'sendAttempt' },
  };
  const { bg, fg } = spec[sendStyle];
  const text = sendStyle === 'attempt' && attempts && attempts > 0 ? t('ui.sendStyle.attemptWithCount', { count: attempts }) : t(SEND_LABEL[sendStyle]);
  const fade = reduceMotion || sendStyle === 'attempt';
  const disc = variant === 'disc';
  const glyphSize = disc ? theme.iconSize.sm : theme.iconSize.xs;

  const icon = (
    <Animated.View style={{ opacity: fade ? pop : 1, transform: fade ? [] : [{ scale: pop }] }}>
      <Ionicons name={STATUS_GLYPH[sendStyle]} size={glyphSize} color={c[fg]} />
      {burst && sendStyle === 'flash' && landing !== undefined ? <ParticleBurst kind="flash" playKey={landing} /> : null}
    </Animated.View>
  );

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c[bg],
          borderRadius: theme.radius.full,
        },
        disc
          ? { width: theme.componentSize.sendStatusDisc, height: theme.componentSize.sendStatusDisc }
          : { minHeight: theme.componentSize.sendStatusTag, paddingLeft: 7, paddingRight: 9 },
      ]}
    >
      {icon}
      {disc ? null : (
        <AppText variant="footnote" weight="600" style={{ color: c[fg], marginLeft: theme.layout.iconTextGap }} numberOfLines={1}>
          {text}
        </AppText>
      )}
    </View>
  );
}
