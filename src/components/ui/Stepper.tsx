import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, InputAccessoryView, Platform, Pressable, TextInput, View } from 'react-native';
import type { AccessibilityActionEvent, StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { innerRadius, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { FocusRing, NO_WEB_OUTLINE } from './FocusRing';
import { IconButton } from './IconButton';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Default 1 (`stepperMin`). */
  min?: number;
  /** Default 9999 (`stepperMax`). */
  max?: number;
  /** Left title (`headline`) and VoiceOver label, e.g. "Attempts". */
  label: string;
  /** Left caption (`footnote`), e.g. "From your first try to the send". */
  description?: string;
  /** VoiceOver text for the current value, e.g. n => `${n} tries`. Default: the number. */
  valueText?: (n: number) => string;
  /** Locked (flash: fixed at 1): no disc on -/+, number textSecondary, lock + `lockedDescription`, 1pt `border`. */
  locked?: boolean;
  lockedDescription?: string;
  /** Announced when the stepper becomes locked ("Attempts fixed at 1"). Not announced when it unlocks. */
  lockedAnnouncement?: string;
  /** Keyboard "Done" label (number-pad has no Return). */
  doneLabel?: string;
  /** Haptic sourceId. */
  hapticSource?: string;
  style?: StyleProp<ViewStyle>;
}

const ACCESSORY_ID = 'projectday-stepper-done';

/**
 * Number stepper (design system 19.9): 56pt `surfaceAlt` row, 1pt `outline`, radius 12 (typing: 1pt `primary` + inner 2pt FocusRing). The VoiceOver
 * element is the CONTAINER (`adjustable`, increment / decrement, extra "enter a number" action); the
 * -/+ buttons are hidden from it. Press-and-hold (`longPress` 500) repeats every `micro` 100, then every 50
 * after 10 steps, with no digit animation. A digit change slides +-`distance.stepperDigit` (opacity
 * timing, M12) and a tap during the animation jumps to the latest value. Tapping the number opens a
 * number-pad with a Done accessory; blur clamps (empty/0 -> min, > max -> max) and announces the fix.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  description,
  valueText,
  locked = false,
  lockedDescription,
  lockedAnnouncement,
  doneLabel,
  hapticSource = 'stepper',
  style,
}: StepperProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, distance, reduceMotion, haptic } = useMotion();
  const c = theme.colors;
  const lo = min ?? theme.componentSize.stepperMin;
  const hi = max ?? theme.componentSize.stepperMax;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const dir = useRef(1);
  const slide = useRef(new Animated.Value(1)).current;
  const live = useRef({ value, onChange, lo, hi, reduceMotion });
  live.current = { value, onChange, lo, hi, reduceMotion };
  const repeating = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const steps = useRef(0);
  const prev = useRef(value);
  const quiet = useRef(false);
  const wasLocked = useRef(locked);

  // digit slide on external or button changes
  useEffect(() => {
    if (value === prev.current) return;
    dir.current = value > prev.current ? 1 : -1;
    const before = prev.current;
    prev.current = value;
    if (!editing) setDraft(String(value));
    if (reduceMotion || quiet.current || locked) {
      setOutgoing(null);
      setShown(value);
      slide.setValue(1);
      return;
    }
    // animating already: jump straight to the latest value
    setOutgoing(before);
    setShown(value);
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: duration.micro, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start(() =>
      setOutgoing(null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (locked && !wasLocked.current && lockedAnnouncement) AccessibilityInfo.announceForAccessibility(lockedAnnouncement);
    wasLocked.current = locked;
  }, [locked, lockedAnnouncement]);

  const step = useCallback(
    (delta: number) => {
      const l = live.current;
      const next = Math.min(l.hi, Math.max(l.lo, l.value + delta));
      if (next === l.value) return;
      haptic('select', hapticSource);
      live.current.value = next;
      l.onChange(next);
    },
    [haptic, hapticSource],
  );

  const stopHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    quiet.current = false;
  }, []);
  useEffect(() => stopHold, [stopHold]);

  const startHold = (delta: number): void => {
    repeating.current = false;
    steps.current = 0;
    clearTimeout(holdTimer.current);
    const tick = (): void => {
      repeating.current = true;
      quiet.current = true;
      step(delta);
      steps.current += 1;
      holdTimer.current = setTimeout(tick, steps.current >= 10 ? 50 : 100);
    };
    holdTimer.current = setTimeout(tick, duration.longPress);
  };

  const endHold = (): void => {
    stopHold();
    // the last repeated value is drawn without animation
    setOutgoing(null);
    setShown(live.current.value);
    slide.setValue(1);
  };

  const commitDraft = (): void => {
    const n = parseInt(draft, 10);
    let fixed = Number.isNaN(n) || n < lo ? lo : n > hi ? hi : n;
    if (locked) fixed = value;
    setEditing(false);
    setDraft(String(fixed));
    if (fixed !== value) onChange(fixed);
    if (String(fixed) !== draft) AccessibilityInfo.announceForAccessibility(valueText ? valueText(fixed) : String(fixed));
  };

  const focusOn = editing && !locked;
  const slop = Math.max(0, (theme.layout.minTouchTarget - theme.typeScale.title2.lineHeight) / 2);
  const text = valueText ? valueText(value) : String(value);
  const accessoryId = Platform.OS === 'ios' ? ACCESSORY_ID : undefined;

  const numberStyle = { minWidth: 36, textAlign: 'center' as const };
  const numberNode = (n: number): React.JSX.Element => (
    <AppText variant="title2" numeric color={locked ? 'textSecondary' : 'textPrimary'} style={numberStyle}>
      {n}
    </AppText>
  );

  const a11y = locked
    ? {
        accessible: true,
        accessibilityRole: 'text' as const,
        accessibilityLabel: t('ui.stepper.lockedValue', { label, value: text, reason: lockedDescription ?? '' }),
      }
    : {
        accessible: true,
        accessibilityRole: 'adjustable' as const,
        accessibilityLabel: label,
        accessibilityValue: { min: lo, max: hi, now: value, text },
        accessibilityActions: [
          { name: 'increment' },
          { name: 'decrement' },
          { name: 'activate', label: t('ui.stepper.enterNumber') },
        ],
        onAccessibilityAction: (e: AccessibilityActionEvent) => {
          const a = e.nativeEvent.actionName;
          if (a === 'increment') step(1);
          else if (a === 'decrement') step(-1);
          else if (a === 'activate') setEditing(true);
        },
      };

  return (
    <View
      {...a11y}
      style={[
        {
          minHeight: theme.componentSize.stepperHeight,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.surfaceAlt,
          borderRadius: theme.radius.control,
          borderCurve: 'continuous',
          borderWidth: theme.stroke.thin,
          borderColor: locked ? c.border : focusOn ? c.primary : c.outline,
          paddingHorizontal: theme.layout.cardPadding,
          paddingVertical: theme.layout.listRowPaddingV,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
        <AppText variant="headline" color={locked ? 'textDisabled' : 'textPrimary'}>
          {label}
        </AppText>
        {locked && lockedDescription ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={ICON.locked.outline} size={13} color={c.textSecondary} style={{ marginRight: 4 }} />
            <AppText variant="footnote" color="textSecondary" style={{ flexShrink: 1 }}>
              {lockedDescription}
            </AppText>
          </View>
        ) : description ? (
          <AppText variant="footnote" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <StepButton
          locked={locked}
          name={ICON.remove.outline}
          disabled={locked || value <= lo}
          onPress={() => {
            if (!repeating.current) step(-1);
          }}
          onPressIn={() => startHold(-1)}
          onPressOut={endHold}
        />
        {focusOn ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={(v) => setDraft(v.replace(/[^0-9]/g, '').slice(0, String(hi).length))}
            onBlur={commitDraft}
            keyboardType="number-pad"
            selectTextOnFocus
            inputAccessoryViewID={accessoryId}
            selectionColor={c.primary}
            cursorColor={c.primary}
            maxFontSizeMultiplier={theme.typeScale.title2.maxFontSizeMultiplier}
            style={{ ...numberStyle, minWidth: 48, color: c.textPrimary, fontSize: theme.typeScale.title2.fontSize, fontWeight: '700', paddingVertical: 0, ...NO_WEB_OUTLINE }}
          />
        ) : (
          <Pressable
            disabled={locked}
            onPress={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            hitSlop={{ top: slop, bottom: slop }}
            style={{ minWidth: 36, minHeight: theme.typeScale.title2.lineHeight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            <Animated.View
              style={{
                opacity: outgoing === null ? 1 : slide,
                transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [distance.stepperDigit * dir.current, 0] }) }],
              }}
            >
              {numberNode(shown)}
            </Animated.View>
            {outgoing !== null ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -distance.stepperDigit * dir.current] }) }],
                }}
              >
                {numberNode(outgoing)}
              </Animated.View>
            ) : null}
          </Pressable>
        )}
        <StepButton
          locked={locked}
          name={ICON.add.outline}
          disabled={locked || value >= hi}
          onPress={() => {
            if (!repeating.current) step(1);
          }}
          onPressIn={() => startHold(1)}
          onPressOut={endHold}
        />
      </View>
      {focusOn ? <FocusRing color={c.primary} radius={innerRadius(theme.radius.control, theme.stroke.thin)} /> : null}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={{ backgroundColor: c.surfaceElevated, alignItems: 'flex-end', padding: theme.spacing.sm }}>
            <Pressable accessibilityRole="button" onPress={commitDraft} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.md }}>
              <AppText variant="headline" color="primary">
                {doneLabel ?? t('ui.stepper.done')}
              </AppText>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

function StepButton({
  name,
  disabled,
  locked,
  onPress,
  onPressIn,
  onPressOut,
}: {
  name: typeof ICON.add.outline | typeof ICON.remove.outline;
  disabled: boolean;
  locked: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const c = theme.colors;
  const label = name === ICON.add.outline ? t('ui.stepper.increase') : t('ui.stepper.decrease');
  if (locked) {
    // no disc, glyph textDisabled
    return (
      <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={name} size={theme.iconSize.md} color={c.textDisabled} />
      </View>
    );
  }
  return (
    <IconButton
      variant="tonal"
      tonalBase="surface"
      diameter={32}
      name={name}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  );
}
