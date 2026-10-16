import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICON } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { ParticleBurst } from './Particles';
import { useScreenReader } from './useScreenReader';

export interface CelebrationContent {
  title: string;
  subtitle?: string;
  /** Text of the card action (e.g. "View"). Tapping the card runs `onAction`, then dismisses. */
  actionLabel?: string;
  onAction?: () => void;
  /** The new highest grade was also a flash: gold is mixed into the particles. */
  flash?: boolean;
}

interface CelebrationApi {
  celebrate: (content: CelebrationContent) => void;
  dismiss: () => void;
}

const CelebrationContext = createContext<CelebrationApi | undefined>(undefined);

export function useCelebration(): CelebrationApi {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within a CelebrationHost.');
  return ctx;
}

/**
 * Mount ONCE at the top of AppShell (above the tab bar and screens, 8pt under the AppHeader). The
 * layer is pointerEvents="box-none": only the card is touchable. Card (`surfaceElevated`, `lg`):
 * light theme has only the raised shadow, dark theme only a 1pt border. In: `medium` (translateY
 * -12 -> 0, enter); trophy in a sendTopContainer disc pops with `topOut` (scales about its centre);
 * particles. Holds `celebrationCard` (5000ms), paused while a finger is on the card, never
 * auto-dismissed under VoiceOver. Tap the card = view (runs `onAction`, then closes); the close
 * IconButton or a swipe up dismisses. Reduce Motion: fade only, no particles.
 */
export function CelebrationHost({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, reduceMotion, haptic } = useMotion();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const screenReader = useScreenReader();
  const [current, setCurrent] = useState<(CelebrationContent & { id: number }) | null>(null);
  const idRef = useRef(0);
  const enter = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const swipe = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef({ screenReader, hold: duration.celebrationCard, settle: spring.settle, short: duration.short });
  live.current = { screenReader, hold: duration.celebrationCard, settle: spring.settle, short: duration.short };

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(enter, {
      toValue: 0,
      duration: duration.short,
      easing: bezierFor('exit'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => setCurrent(null));
  }, [enter, duration.short]);
  dismissRef.current = dismiss;

  const celebrate = useCallback((content: CelebrationContent) => {
    idRef.current += 1;
    setCurrent({ ...content, id: idRef.current });
  }, []);

  const clearHold = useCallback(() => clearTimeout(timer.current), []);
  const startHold = useCallback(() => {
    clearTimeout(timer.current);
    if (live.current.screenReader) return;
    timer.current = setTimeout(() => dismissRef.current(), live.current.hold);
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    enter.setValue(0);
    swipe.setValue(0);
    iconScale.setValue(reduceMotion ? 1 : 0.6);
    haptic('celebrate', 'celebration');
    AccessibilityInfo.announceForAccessibility(current.title);
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? duration.short : duration.medium,
      easing: bezierFor('enter'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    if (!reduceMotion) {
      Animated.spring(iconScale, { toValue: 1, ...spring.topOut, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    startHold();
    return clearHold;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, screenReader]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => clearTimeout(timer.current),
        onPanResponderMove: (_e, g) => swipe.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -24 || g.vy < -0.5) dismissRef.current();
          else {
            Animated.spring(swipe, { toValue: 0, ...live.current.settle, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
            startHold();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const api = useMemo(() => ({ celebrate, dismiss }), [celebrate, dismiss]);
  const c = theme.colors;
  const closeBox = theme.layout.minTouchTarget;

  return (
    <CelebrationContext.Provider value={api}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            {...pan.panHandlers}
            onTouchStart={clearHold}
            onTouchEnd={startHold}
            style={[
              {
                marginTop: insets.top + theme.layout.headerContentHeight + theme.spacing.sm,
                marginHorizontal: screenMargin,
                borderRadius: theme.radius.card,
                borderCurve: 'continuous',
                backgroundColor: c.surfaceElevated,
                // light: raised shadow only; dark: 1pt border only (never both)
                borderWidth: theme.isDark ? theme.stroke.thin : 0,
                borderColor: c.border,
                opacity: enter,
                transform: [
                  { translateY: swipe },
                  ...(reduceMotion ? [] : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }]),
                ],
              },
              theme.elevation.raised,
            ]}
          >
            <Pressable
              onPress={() => {
                current.onAction?.();
                dismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${current.title}${current.subtitle ? `, ${current.subtitle}` : ''}`}
              accessibilityHint={current.actionLabel}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: theme.layout.cardPadding,
                paddingRight: theme.layout.cardPadding + closeBox - theme.spacing.md,
              }}
            >
              <View
                style={{
                  width: theme.componentSize.celebrationIconContainer,
                  height: theme.componentSize.celebrationIconContainer,
                  borderRadius: theme.radius.full,
                  backgroundColor: c.sendTopContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: theme.spacing.smd,
                }}
              >
                <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                  <Ionicons name={ICON.newTopGrade.filled} size={theme.iconSize.xl} color={c.sendTop} />
                </Animated.View>
                <ParticleBurst kind="newHighest" flash={current.flash} playKey={current.id} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="headline">{current.title}</AppText>
                {current.subtitle ? (
                  <AppText variant="footnote" color="textSecondary">
                    {current.subtitle}
                  </AppText>
                ) : null}
                {current.actionLabel ? (
                  <AppText variant="footnote" weight="600" color="primary" style={{ marginTop: theme.spacing.xs }}>
                    {current.actionLabel}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
            {/* last in JSX: title -> subtitle -> view -> close */}
            <View style={{ position: 'absolute', top: theme.spacing.xs, right: theme.spacing.xs }}>
              <IconButton
                name={ICON.close.outline}
                size={theme.iconSize.md}
                color="textSecondary"
                accessibilityLabel={t('ui.celebrationDismiss')}
                onPress={dismiss}
              />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </CelebrationContext.Provider>
  );
}
