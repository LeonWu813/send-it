import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { ParticleBurst } from './Particles';
import { useScreenReader } from './useScreenReader';

export interface CelebrationContent {
  title: string;
  subtitle?: string;
  /** Ghost button (e.g. "View"). Tapping it does not dismiss the card. */
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
 * Mount once at the top of the app shell (above the tab bar and screens). The layer is
 * pointerEvents="box-none": only the card is touchable, everything else passes through.
 * Card: in `medium` (translateY -12 -> 0, enter), flag with `topOut`, particles, holds
 * `celebrationCard` (until dismissed under VoiceOver). Tap the card (except the action) or swipe up
 * to dismiss. Reduce Motion: fade only, no particles.
 */
export function CelebrationHost({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion, haptic } = useMotion();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const screenReader = useScreenReader();
  const [current, setCurrent] = useState<(CelebrationContent & { id: number }) | null>(null);
  const idRef = useRef(0);
  const enter = useRef(new Animated.Value(0)).current;
  const flag = useRef(new Animated.Value(1)).current;
  const swipe = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef<() => void>(() => {});

  const dismiss = useCallback(() => {
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

  useEffect(() => {
    if (!current) return undefined;
    enter.setValue(0);
    swipe.setValue(0);
    flag.setValue(reduceMotion ? 1 : 0.6);
    haptic('celebrate', 'celebration');
    AccessibilityInfo.announceForAccessibility(current.title);
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? duration.short : duration.medium,
      easing: bezierFor('enter'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    if (!reduceMotion) {
      Animated.spring(flag, { toValue: 1, ...spring.topOut, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    if (screenReader) return undefined;
    const timer = setTimeout(() => dismissRef.current(), duration.celebrationCard);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, screenReader]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => swipe.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -24 || g.vy < -0.5) dismissRef.current();
          else Animated.spring(swipe, { toValue: 0, ...spring.settle, useNativeDriver: USE_NATIVE_DRIVER }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const api = useMemo(() => ({ celebrate, dismiss }), [celebrate, dismiss]);
  const c = theme.colors;

  return (
    <CelebrationContext.Provider value={api}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            {...pan.panHandlers}
            style={[
              {
                marginTop: insets.top + theme.layout.headerContentHeight + theme.spacing.sm,
                marginHorizontal: screenMargin,
                borderRadius: theme.borderRadius.lg,
                backgroundColor: c.surfaceElevated,
                borderWidth: 1,
                borderColor: c.border,
                padding: theme.layout.cardPadding,
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
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel={`${current.title}${current.subtitle ? `, ${current.subtitle}` : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: theme.componentSize.celebrationIconContainer,
                  height: theme.componentSize.celebrationIconContainer,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: c.sendTopContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: theme.spacing.smd,
                }}
              >
                <Animated.View style={{ transform: [{ scale: flag }] }}>
                  <Ionicons name="flag" size={theme.iconSize.xl} color={c.sendTop} />
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
              </View>
              {current.actionLabel ? (
                <Button
                  variant="ghost"
                  label={current.actionLabel}
                  minHeight={theme.layout.minTouchTarget}
                  onPress={() => current.onAction?.()}
                />
              ) : null}
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </CelebrationContext.Provider>
  );
}
