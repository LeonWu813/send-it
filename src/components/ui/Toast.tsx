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
  /** Up to two text actions. */
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
 * Toast: dark HUD in both themes (flash / error tones). In: translateY 16->0 + fade (`medium`,
 * enter), icon pops (grip, 30ms later; error icon shakes instead). Replacement: container stays, content
 * cross-fades (`short`, standard). Out: `short`, exit. Swipe down to dismiss (works under Reduce Motion).
 * Auto-dismiss after 5s, paused while touched, never under VoiceOver. Message never clamps; at font
 * scale >= 1.6 the actions move under the message. Announces "message. Actions available: ..." and
 * exposes accessibilityActions. Taps outside pass through.
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
  const { duration, spring, reduceMotion } = useMotion();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const { fontScale } = useWindowDimensions();
  const screenReader = useScreenReader();
  const { translateX: shakeX, shake } = useShake();
  const [mounted, setMounted] = useState(visible);
  const show = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(1)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const c = theme.colors;

  const list: ToastAction[] = actions ?? (actionLabel ? [{ label: actionLabel, onPress: () => onAction?.() }] : []);
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
  const iconTop = (theme.typeScale.subhead.lineHeight - theme.iconSize.md) / 2;

  const actionButtons = list.slice(0, 2).map((a, i) => (
    <ToastActionButton key={`${a.label}-${i}`} label={a.label} onPress={a.onPress} tone={tone} color={palette.action} hotColor={c.onToast} />
  ));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
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
            marginHorizontal: screenMargin,
            marginBottom: bottomOffset ?? insets.bottom + theme.componentSize.toastOffsetAboveTabBar,
            minHeight: theme.componentSize.toastMinHeight,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: palette.bg,
            borderWidth: theme.isDark && tone === 'default' ? theme.stroke.thin : 0,
            borderColor: palette.border,
            paddingVertical: theme.spacing.smd,
            paddingLeft: theme.spacing.md,
            paddingRight: list.length && !stacked ? theme.spacing.xs : theme.spacing.md,
            flexDirection: stacked ? 'column' : 'row',
            alignItems: stacked ? 'stretch' : 'center',
            opacity: show,
            transform: [
              ...(reduceMotion ? [] : [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]),
              { translateY: drag },
            ],
          },
          theme.elevation.raised,
        ]}
      >
        <Animated.View style={{ flex: stacked ? undefined : 1, flexDirection: 'row', alignItems: 'flex-start', opacity: content }}>
          {iconName ? (
            <Animated.View
              style={{
                marginTop: iconTop,
                marginRight: theme.layout.iconTextGapInButton,
                transform: [{ scale: iconPop }, { translateX: shakeX }],
              }}
            >
              <Ionicons name={iconName} size={theme.iconSize.md} color={palette.icon} />
            </Animated.View>
          ) : null}
          {/* never numberOfLines: error messages must not be clipped, even at AX sizes */}
          <AppText variant="subhead" style={{ color: palette.fg, flex: 1 }}>
            {message}
          </AppText>
        </Animated.View>
        {list.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', columnGap: theme.spacing.xs }}>{actionButtons}</View>
        ) : null}
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
      onPressIn={() => set(1, duration.micro, 'standard')}
      onPressOut={() => set(0, duration.short, 'standard')}
      accessibilityLabel={label}
      style={{
        minHeight: theme.layout.minTouchTarget,
        minWidth: theme.layout.minTouchTarget,
        paddingHorizontal: theme.spacing.smd,
        borderRadius: theme.borderRadius.md,
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
