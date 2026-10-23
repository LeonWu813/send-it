import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';

import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';

export interface BadgeProps {
  /** 0 hides the badge. 1-99 shown as-is, 100+ as "99+". */
  count: number;
  /**
   * The number arrived as a live notification while the app is in the foreground: 0 -> n pops in
   * with `topOut`. Otherwise (launch, resume, pull to refresh) it fades in over `short`.
   */
  live?: boolean;
}

const label = (n: number): string => (n > 99 ? '99+' : String(n));

/**
 * Unread count marker (§15.9): error fill, onError caption2 numeric, minHeight/minWidth 16, pill.
 * n -> n+1: old number slides up and out, new one slides in from below (+-6pt, `short`+`standard`).
 * n -> 0: shrinks away (`short`+`exit`). Hidden from accessibility: the owning button's label
 * carries the count ("Notifications, 3 unread"). Position it with IconButton `badge`.
 */
export function Badge({ count, live = false }: BadgeProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const [shown, setShown] = useState(count);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const prev = useRef(0);
  const scale = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    const before = first.current ? 0 : prev.current;
    first.current = false;
    prev.current = count;
    if (count === before) return;
    if (before === 0 && count > 0) {
      setShown(count);
      scale.setValue(live && !reduceMotion ? 0 : 1);
      opacity.setValue(live && !reduceMotion ? 1 : 0);
      if (live && !reduceMotion) {
        Animated.spring(scale, { toValue: 1, ...spring.topOut, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
      } else {
        Animated.timing(opacity, { toValue: 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
    } else if (count === 0) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
        ...(reduceMotion
          ? []
          : [Animated.timing(scale, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER })]),
      ]).start(() => setShown(0));
    } else if (label(count) !== label(before)) {
      setShown(count);
      if (reduceMotion) return;
      setOutgoing(before);
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start(() =>
        setOutgoing(null),
      );
    } else {
      setShown(count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (shown === 0 && count === 0) return null;

  const size = theme.componentSize.badgeMinSize;
  const text = (n: number) => (
    <AppText variant="caption2" numeric color="onError" style={{ textAlign: 'center' }}>
      {label(n)}
    </AppText>
  );

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minHeight: size,
        minWidth: size,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity,
        transform: [{ scale }],
      }}
    >
      <Animated.View style={{ transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }], opacity: outgoing === null ? 1 : slide }}>
        {text(shown)}
      </Animated.View>
      {outgoing !== null ? (
        <Animated.View
          style={{
            position: 'absolute',
            opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }}
        >
          {text(outgoing)}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Where IconButton places a badge: left edge = glyph centre + xs, top edge = glyph top - 6. */
export function BadgeAnchor({ box, glyph, xs, children }: { box: number; glyph: number; xs: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: box / 2 + xs, top: (box - glyph) / 2 - 6 }}>
      {children}
    </View>
  );
}
