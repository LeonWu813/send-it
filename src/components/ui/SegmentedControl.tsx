import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type SegmentedVariant = 'standard' | 'compact' | 'icon';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** icon variant: glyph while NOT selected (outline). */
  icon?: IoniconName;
  /** icon variant: glyph while selected (filled; `attempt` keeps its outline glyph). */
  iconSelected?: IoniconName;
  /** icon variant: colour of the selected icon + label (send-style colours). Default textPrimary. */
  selectedColor?: PaletteKey;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** standard 36 / compact 32 (both draggable) / icon 68 (tap only: it lives in a vertical scroll page). */
  variant?: SegmentedVariant;
  /** Group label read by VoiceOver ("Send style"). */
  accessibilityLabel: string;
  disabled?: boolean;
  /** Haptic sourceId suffix: `segmented-<purpose>`. */
  hapticPurpose?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 2-4 mutually exclusive options. Capsule track (`surfaceAlt`), capsule thumb (`segmentedThumb`,
 * light: control shadow, dark: 1pt `outline` ring) that glides between items with `spring.glide`.
 * Item text is two cross-faded layers (unselected 400 / selected 600, `micro` + `standard`), colour is
 * never animated. standard/compact can be dragged (horizontal only, value commits on release);
 * icon is tap only. Reduce Motion: the thumb fades out, jumps, fades in. Haptic `select`.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  variant = 'standard',
  accessibilityLabel,
  disabled = false,
  hapticPurpose = 'control',
  style,
}: SegmentedControlProps<T>): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion, haptic } = useMotion();
  const c = theme.colors;
  const n = options.length;
  const isIcon = variant === 'icon';
  const height = theme.componentSize.segmentedHeight[variant];
  const pad = isIcon ? 3 : 2;
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - 2 * pad) / n : 0;
  const [visual, setVisual] = useState(index);
  const x = useRef(new Animated.Value(0)).current;
  const thumbOpacity = useRef(new Animated.Value(1)).current;
  const sel = useRef(options.map((_, i) => new Animated.Value(i === index ? 1 : 0))).current;
  const pop = useRef(new Animated.Value(1)).current;
  const xNow = useRef(0);
  const dragging = useRef(false);
  const first = useRef(true);
  const live = useRef({ segW, n, onChange, options, disabled, reduceMotion, visual: index, index });
  live.current = { segW, n, onChange, options, disabled, reduceMotion, visual, index };

  useEffect(() => {
    const id = x.addListener(({ value: v }) => {
      xNow.current = v;
    });
    return () => x.removeListener(id);
  }, [x]);

  // text / icon layers follow `visual` (the candidate while dragging, the value otherwise)
  useEffect(() => {
    sel.forEach((v, i) => {
      Animated.timing(v, {
        toValue: i === visual ? 1 : 0,
        duration: duration.micro,
        easing: bezierFor('standard'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
    if (isIcon && !first.current && !reduceMotion) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual]);

  // value -> thumb position. Programmatic first layout / reset does not animate.
  useEffect(() => {
    if (dragging.current) return;
    setVisual(index);
    if (segW === 0) return;
    const to = index * segW;
    if (first.current) {
      first.current = false;
      x.setValue(to);
      return;
    }
    if (reduceMotion) {
      Animated.timing(thumbOpacity, { toValue: 0, duration: duration.micro, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
        x.setValue(to);
        Animated.timing(thumbOpacity, { toValue: 1, duration: duration.micro, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      });
    } else {
      Animated.spring(x, { toValue: to, ...spring.glide, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, segW]);

  const choose = (i: number): void => {
    const l = live.current;
    if (l.disabled || i === l.index) return;
    haptic('select', `segmented-${hapticPurpose}`);
    l.onChange(l.options[i].value);
  };

  const pan = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !isIcon && !live.current.disabled && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
      onPanResponderGrant: () => {
        dragging.current = true;
        x.stopAnimation((v) => {
          start = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const l = live.current;
        const max = (l.n - 1) * l.segW;
        const nx = Math.min(max, Math.max(0, start + g.dx));
        x.setValue(nx);
        const cand = l.segW ? Math.round(nx / l.segW) : l.visual;
        if (cand !== l.visual) {
          haptic('select', `segmented-${hapticPurpose}`);
          setVisual(cand);
        }
      },
      onPanResponderRelease: (_e, g) => {
        const l = live.current;
        dragging.current = false;
        const cand = l.segW ? Math.round(xNow.current / l.segW) : l.index;
        const to = cand * l.segW;
        if (l.reduceMotion) {
          Animated.timing(x, { toValue: to, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
        } else {
          Animated.spring(x, { toValue: to, velocity: g.vx, ...spring.glide, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
        if (cand !== l.index) l.onChange(l.options[cand].value);
        else setVisual(l.index);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        setVisual(live.current.index);
        Animated.spring(x, { toValue: live.current.index * live.current.segW, ...spring.glide, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIcon]);

  const textVariant = variant === 'compact' ? 'footnote' : 'subhead';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      {...(isIcon ? null : pan.panHandlers)}
      style={[
        {
          minHeight: height,
          flexDirection: 'row',
          padding: pad,
          borderRadius: theme.radius.full,
          backgroundColor: c.surfaceAlt,
        },
        style,
      ]}
    >
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: pad,
              top: pad,
              bottom: pad,
              width: segW,
              borderRadius: theme.radius.full,
              backgroundColor: c.segmentedThumb,
              borderWidth: theme.isDark ? theme.stroke.thin : 0,
              borderColor: c.outline,
              opacity: thumbOpacity,
              transform: [{ translateX: x }],
            },
            theme.elevation.control,
          ]}
        />
      ) : null}
      {options.map((o, i) => {
        const checked = i === index;
        const selColor: PaletteKey = disabled ? 'textDisabled' : isIcon ? (o.selectedColor ?? 'textPrimary') : 'textPrimary';
        const offColor: PaletteKey = disabled ? 'textDisabled' : 'textSecondary';
        const opSel = sel[i];
        const opOff = opSel.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => choose(i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: height - 2 * pad }}
          >
            {isIcon ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 22, height: 22, marginBottom: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Animated.View style={{ position: 'absolute', opacity: opOff }}>
                    <Ionicons name={(o.icon ?? 'ellipse-outline') as IoniconName} size={22} color={c[offColor]} />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', opacity: opSel, transform: [{ scale: i === visual ? pop : 1 }] }}>
                    <Ionicons name={(o.iconSelected ?? o.icon ?? 'ellipse-outline') as IoniconName} size={22} color={c[selColor]} />
                  </Animated.View>
                </View>
                <View>
                  <AppText variant="footnote" weight="600" color={offColor} numberOfLines={1}>
                    {o.label}
                  </AppText>
                  <Animated.View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', opacity: opSel }}
                  >
                    <AppText variant="footnote" weight="600" color={selColor} numberOfLines={1}>
                      {o.label}
                    </AppText>
                  </Animated.View>
                </View>
              </View>
            ) : (
              <View>
                <AppText variant={textVariant} weight="400" color={offColor} numberOfLines={1}>
                  {o.label}
                </AppText>
                <Animated.View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ position: 'absolute', left: -4, right: -4, alignItems: 'center', opacity: opSel }}
                >
                  <AppText variant={textVariant} weight="600" color={selColor} numberOfLines={1}>
                    {o.label}
                  </AppText>
                </Animated.View>
              </View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}
