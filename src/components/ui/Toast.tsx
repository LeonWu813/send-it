import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { useScreenReader } from './useScreenReader';
import { useShake } from './useShake';

export type ToastTone = 'default' | 'flash' | 'error';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastContent {
  message: string;
  tone?: ToastTone;
  /** Glyph (use `ICON.*`). Defaults: flash -> flash, error -> alert-circle-outline, default -> none. Plain success has no icon. */
  icon?: IoniconName;
  /** At most ONE action (extras are ignored). */
  actions?: ToastAction[];
  /** Shorthand for a single action. */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds; defaults to MOTION.duration.toast (5000). Use toastShort for "undone". */
  durationMs?: number;
}

export interface ToastProps extends ToastContent {
  visible: boolean;
  /** Changes when a new toast replaces the current one: content cross-fades and the timer restarts. */
  id?: number;
  onDismiss: () => void;
  /** Distance from the bottom edge. Pass (tab bar height + 8). Default: bottom inset + toastOffsetAboveTabBar. */
  bottomOffset?: number;
}

/**
 * Toast (v2.2): opaque dark HUD in both themes (flash / error tones). One line = a content-width capsule
 * (height 48, centred, max width = screen - 2 x margin, radius full); two lines or font scale >= 1.6 = a
 * `card` 20 block (stacked actions). In: translateY `distance.toastEnter` 8 -> 0 + fade (`medium`, enter);
 * icon pops (grip, 30ms later; error icon shakes). Replacement single -> single: the capsule WIDTH tweens
 * (JS driver, `short` + `standard`) while the new content cross-fades in at its final width; single <-> two
 * lines swaps shape with a cross-fade. Out: `short`, exit. Swipe down to dismiss (works under Reduce Motion).
 * Auto-dismiss after 5s, paused while touched, never under VoiceOver. At most one action. Announces
 * "message. Actions available: ..." and exposes accessibilityActions. Taps outside pass through.
 */
export function Toast({
  visible,
  id = 0,
  message,
  tone = 'default',
  icon,
  actions,
  actionLabel,
  onAction,
  durationMs,
  onDismiss,
  bottomOffset,
}: ToastProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, distance, reduceMotion } = useMotion();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const screenReader = useScreenReader();
  const { translateX: shakeX, shake } = useShake();
  const [mounted, setMounted] = useState(visible);
  const show = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(1)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const [multi, setMulti] = useState(false);
  const [natural, setNatural] = useState(0);
  const [morphWidth, setMorphWidth] = useState<number | null>(null);
  const width = useRef(new Animated.Value(0)).current;
  const lastWidth = useRef(0);
  const lastMulti = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const c = theme.colors;

  const list: ToastAction[] = (actions ?? (actionLabel ? [{ label: actionLabel, onPress: () => onAction?.() }] : [])).slice(0, 1);
  const live = useRef({ onDismiss, durationMs, screenReader, duration: duration.toast, reduceMotion });
  live.current = { onDismiss, durationMs, screenReader, duration: duration.toast, reduceMotion };

  const clearTimer = useCallback(() => clearTimeout(timer.current), []);
  const startTimer = useCallback(() => {
    clearTimeout(timer.current);
    if (live.current.screenReader) return;
    timer.current = setTimeout(() => live.current.onDismiss(), live.current.durationMs ?? live.current.duration);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(show, {
        toValue: 1,
        duration: reduceMotion ? duration.short : duration.medium,
        easing: bezierFor('enter'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else if (mounted) {
      Animated.timing(show, {
        toValue: 0,
        duration: duration.short,
        easing: bezierFor('exit'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Newly shown (not a replacement): icon pop after `stagger`; the error icon shakes +-2 instead.
  useEffect(() => {
    if (!visible) {
      first.current = true;
      return undefined;
    }
    if (!first.current) return undefined;
    if (reduceMotion) return undefined;
    if (tone === 'error') {
      const id1 = setTimeout(() => shake(0.5), duration.stagger);
      return () => clearTimeout(id1);
    }
    iconPop.setValue(0.6);
    const id2 = setTimeout(
      () => Animated.spring(iconPop, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start(),
      duration.stagger,
    );
    return () => clearTimeout(id2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    if (!first.current) {
      // replacement: the container stays put, only the content cross-fades; the icon does not pop again
      content.setValue(0);
      Animated.timing(content, { toValue: 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    first.current = false;
    const names = list.map((a) => a.label).join(i18n.language === 'en' ? ', ' : '、');
    AccessibilityInfo.announceForAccessibility(list.length ? t('ui.toastWithActions', { message, actions: names }) : message);
    startTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, screenReader]);

  // Width morph for a single-line replacement (JS driver: width cannot use the native driver).
  useEffect(() => {
    if (!visible) {
      lastWidth.current = 0;
      return;
    }
    if (natural === 0) return;
    const from = lastWidth.current;
    const sameShape = !multi && !lastMulti.current;
    lastWidth.current = natural;
    lastMulti.current = multi;
    if (!sameShape || from === 0 || from === natural || first.current || reduceMotion) return;
    setMorphWidth(natural);
    width.setValue(from);
    Animated.timing(width, { toValue: natural, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: false }).start(() =>
      setMorphWidth(null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, multi, id]);

  const MS_SHORT = useRef(duration.short);
  MS_SHORT.current = duration.short;
  const MOTION_SETTLE = useRef(spring.settle);
  MOTION_SETTLE.current = spring.settle;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // only downward drags; works under Reduce Motion (direct manipulation)
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => clearTimer(),
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 24 || g.vy > 0.5) {
            Animated.parallel([
              Animated.timing(drag, { toValue: g.dy + 48, duration: live.current.reduceMotion ? 0 : MS_SHORT.current, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
              Animated.timing(show, { toValue: 0, duration: MS_SHORT.current, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
            ]).start(() => live.current.onDismiss());
          } else {
            if (live.current.reduceMotion) {
              Animated.timing(drag, { toValue: 0, duration: MS_SHORT.current, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
            } else {
              Animated.spring(drag, { toValue: 0, ...MOTION_SETTLE.current, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
            }
            startTimer();
          }
        },
        onPanResponderTerminate: () => {
          Animated.timing(drag, { toValue: 0, duration: MS_SHORT.current, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
          startTimer();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  if (!mounted) return null;

  const palette =
    tone === 'flash'
      ? { bg: c.sendFlashContainer, fg: c.sendFlash, action: c.sendFlash, icon: c.sendFlash, border: 'transparent' }
      : tone === 'error'
        ? { bg: c.errorContainer, fg: c.onErrorContainer, action: c.onErrorContainer, icon: c.error, border: 'transparent' }
        : { bg: c.toastBackground, fg: c.onToast, action: c.toastAction, icon: c.onToast, border: c.toastBorder };
  const iconName = icon ?? (tone === 'flash' ? ICON.sendFlash.filled : tone === 'error' ? ICON.error.outline : undefined);
  const stacked = fontScale >= 1.6;
  const card = multi || stacked;
  const iconTop = (theme.typeScale.subhead.lineHeight - theme.iconSize.md) / 2;
  const maxW = windowWidth - 2 * screenMargin;
  const hasAction = list.length > 0;

  const actionButtons = list.map((a, i) => (
    <ToastActionButton key={`${a.label}-${i}`} label={a.label} onPress={a.onPress} tone={tone} color={palette.action} hotColor={c.onToast} />
  ));

  const row = (measure: boolean, asCapsule = false): React.JSX.Element => (
    <View style={{ flexDirection: card && stacked && !asCapsule ? 'column' : 'row', alignItems: card && stacked && !asCapsule ? 'stretch' : 'center', flexShrink: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: card && !asCapsule ? 'flex-start' : 'center', flexShrink: 1 }}>
        {iconName ? (
          <Animated.View
            style={[{ marginTop: card && !asCapsule ? iconTop : 0, marginRight: 10 }, measure ? null : { transform: [{ scale: iconPop }, { translateX: shakeX }] }]}
          >
            <Ionicons name={iconName} size={theme.iconSize.md} color={palette.icon} />
          </Animated.View>
        ) : null}
        {/* never numberOfLines: error messages must not be clipped, even at AX sizes */}
        <AppText
          variant="subhead"
          weight="500"
          style={{ color: palette.fg, flexShrink: 1 }}
          // the measuring copy tells whether the message wraps (taller than ~1.5 lines): then use the card
          onLayout={measure ? (e) => setMulti(e.nativeEvent.layout.height > theme.typeScale.subhead.lineHeight * 1.5) : undefined}
        >
          {message}
        </AppText>
      </View>
      {hasAction ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginLeft: card && stacked ? 0 : theme.spacing.xs }}>
          {measure ? <View style={{ minHeight: 44, paddingHorizontal: theme.spacing.smd, justifyContent: 'center' }}><AppText variant="subhead" weight="600">{list[0].label}</AppText></View> : actionButtons}
        </View>
      ) : null}
    </View>
  );

  const capsule = { borderRadius: theme.radius.full, minHeight: theme.componentSize.toastMinHeight, paddingLeft: theme.spacing.md, paddingRight: hasAction ? theme.spacing.xs : 18 };
  const shape = card
    ? { borderRadius: theme.radius.card, paddingVertical: theme.spacing.smd, paddingLeft: theme.spacing.md, paddingRight: hasAction && !stacked ? theme.spacing.xs : theme.spacing.md }
    : capsule;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center' }]}>
      {/* invisible measuring layer: natural capsule width of the CURRENT content (drives the width tween) */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => {
          setNatural(Math.round(e.nativeEvent.layout.width));
        }}
        style={{ position: 'absolute', opacity: 0, maxWidth: maxW, flexDirection: 'row', alignItems: 'center', ...capsule }}
      >
        {row(true, true)}
      </View>
      <Animated.View
        {...pan.panHandlers}
        onTouchStart={clearTimer}
        onTouchEnd={startTimer}
        accessibilityLiveRegion="polite"
        accessibilityActions={[
          ...list.map((a, i) => ({ name: `action-${i}`, label: a.label })),
          { name: 'dismiss', label: t('ui.dismiss') },
        ]}
        onAccessibilityAction={(e: AccessibilityActionEvent) => {
          const name = e.nativeEvent.actionName;
          if (name === 'dismiss') onDismiss();
          else list[Number(name.replace('action-', ''))]?.onPress();
        }}
        style={[
          {
            maxWidth: maxW,
            marginBottom: bottomOffset ?? insets.bottom + theme.componentSize.toastOffsetAboveTabBar,
            backgroundColor: palette.bg,
            borderCurve: 'continuous',
            borderWidth: theme.isDark && tone === 'default' ? theme.stroke.thin : 0,
            borderColor: palette.border,
            justifyContent: 'center',
            overflow: morphWidth !== null ? 'hidden' : 'visible',
            ...(morphWidth !== null ? { width } : null),
            opacity: show,
            transform: [
              ...(reduceMotion ? [] : [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [distance.toastEnter, 0] }) }]),
              { translateY: drag },
            ],
          },
          shape,
          theme.elevation.raised,
        ]}
      >
        <Animated.View
          style={[
            { opacity: content },
            // the new content is laid out at its FINAL width from frame one (no re-wrap while the width tweens)
            morphWidth !== null ? { width: morphWidth - shape.paddingLeft - (shape.paddingRight as number) } : null,
          ]}
        >
          {row(false)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Text action: no pressed wash. On the dark HUD the label goes toastAction -> onToast (two layers,
 * opacity, `micro` in / `short` out) and the button scales 0.96; flash / error tones only scale.
 */
function ToastActionButton({
  label,
  onPress,
  tone,
  color,
  hotColor,
}: {
  label: string;
  onPress: () => void;
  tone: ToastTone;
  color: string;
  hotColor: string;
}): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const hot = useRef(new Animated.Value(0)).current;
  const set = (to: number, ms: number, name: 'standard') =>
    Animated.timing(hot, { toValue: to, duration: ms, easing: bezierFor(name), useNativeDriver: USE_NATIVE_DRIVER }).start();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => set(1, duration.press, 'standard')}
      onPressOut={() => set(0, duration.release, 'standard')}
      accessibilityLabel={label}
      style={{
        minHeight: theme.layout.minTouchTarget,
        minWidth: theme.layout.minTouchTarget,
        paddingHorizontal: theme.spacing.smd,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <AppText variant="subhead" weight="600" style={{ color }}>
        {label}
      </AppText>
      {tone === 'default' ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: hot }}>
          <AppText variant="subhead" weight="600" style={{ color: hotColor }}>
            {label}
          </AppText>
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}

// ─── Provider: one toast at a time, new replaces old ─────────────────────────

interface ToastApi {
  show: (content: ToastContent) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

/**
 * Mount ONCE in AppShell, above the tab bar and screens, and pass
 * `bottomOffset = tabBarHeight + theme.componentSize.toastOffsetAboveTabBar`.
 * A new toast replaces the current one (content cross-fade, timer restarts), except that an error
 * toast is never replaced by a non-error: that one waits until the error is dismissed.
 */
export function ToastProvider({ children, bottomOffset }: { children: React.ReactNode; bottomOffset?: number }): React.JSX.Element {
  const { duration } = useMotion();
  const [state, setState] = useState<{ id: number; visible: boolean; content: ToastContent }>({
    id: 0,
    visible: false,
    content: { message: '' },
  });
  const current = useRef(state);
  current.current = state;
  const pending = useRef<ToastContent | null>(null);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(waitTimer.current), []);

  const show = useCallback((content: ToastContent) => {
    const cur = current.current;
    if (cur.visible && cur.content.tone === 'error' && content.tone !== 'error') {
      pending.current = content;
      return;
    }
    setState((s) => ({ id: s.id + 1, visible: true, content }));
  }, []);
  const hide = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
    const next = pending.current;
    if (next) {
      pending.current = null;
      clearTimeout(waitTimer.current);
      waitTimer.current = setTimeout(() => setState((s) => ({ id: s.id + 1, visible: true, content: next })), duration.short);
    }
  }, [duration.short]);
  const api = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast {...state.content} id={state.id} visible={state.visible} onDismiss={hide} bottomOffset={bottomOffset} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.');
  return ctx;
}
