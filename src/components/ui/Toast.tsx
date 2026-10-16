import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { useScreenReader } from './useScreenReader';

export type ToastTone = 'default' | 'flash' | 'error';

export interface ToastContent {
  message: string;
  tone?: ToastTone;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
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
  /** Distance from the bottom edge. Default: bottom inset + toastOffsetAboveTabBar. */
  bottomOffset?: number;
}

/**
 * Toast: dark HUD in both themes (flash / error tones available). In: translateY 16->0 + fade
 * (`medium`, enter). Out: `short`, exit. Auto-dismisses after 5s unless VoiceOver is on. Taps outside
 * pass through. Reduce Motion: fade only.
 */
export function Toast({
  visible,
  id = 0,
  message,
  tone = 'default',
  icon,
  actionLabel,
  onAction,
  durationMs,
  onDismiss,
  bottomOffset,
}: ToastProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const { duration, reduceMotion } = useMotion();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const screenReader = useScreenReader();
  const [mounted, setMounted] = useState(visible);
  const show = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const c = theme.colors;

  useEffect(() => {
    if (visible) {
      setMounted(true);
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

  useEffect(() => {
    if (!visible) return undefined;
    if (!first.current) {
      content.setValue(0);
      Animated.timing(content, { toValue: 1, duration: duration.short, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    first.current = false;
    AccessibilityInfo.announceForAccessibility(message);
    if (screenReader) return undefined;
    const timer = setTimeout(onDismiss, durationMs ?? duration.toast);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, screenReader]);

  if (!mounted) return null;

  const palette =
    tone === 'flash'
      ? { bg: c.sendFlashContainer, fg: c.sendFlash, action: c.sendFlash, icon: c.sendFlash, border: 'transparent' }
      : tone === 'error'
        ? { bg: c.errorContainer, fg: c.onErrorContainer, action: c.onErrorContainer, icon: c.error, border: 'transparent' }
        : { bg: c.toastBackground, fg: c.onToast, action: c.toastAction, icon: c.onToast, border: c.toastBorder };
  const iconName = icon ?? (tone === 'flash' ? 'flash' : tone === 'error' ? 'alert-circle' : undefined);

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          {
            marginHorizontal: screenMargin,
            marginBottom: bottomOffset ?? insets.bottom + theme.componentSize.toastOffsetAboveTabBar,
            minHeight: theme.componentSize.toastMinHeight,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: palette.bg,
            borderWidth: theme.isDark && tone === 'default' ? 1 : 0,
            borderColor: palette.border,
            paddingVertical: theme.spacing.smd,
            paddingLeft: theme.spacing.md,
            paddingRight: actionLabel ? theme.spacing.xs : theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: show,
            transform: reduceMotion
              ? []
              : [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
          theme.elevation.raised,
        ]}
      >
        <Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', opacity: content }}>
          {iconName ? (
            <Ionicons name={iconName} size={theme.iconSize.md} color={palette.icon} style={{ marginRight: theme.layout.iconTextGapInButton }} />
          ) : null}
          <AppText variant="subhead" style={{ color: palette.fg, flex: 1 }}>
            {message}
          </AppText>
        </Animated.View>
        {actionLabel ? (
          <PressableScale
            onPress={onAction}
            pressedColor="rgba(255,255,255,0.12)"
            accessibilityLabel={actionLabel}
            style={{
              minHeight: theme.layout.minTouchTarget,
              minWidth: theme.layout.minTouchTarget,
              paddingHorizontal: theme.spacing.smd,
              borderRadius: theme.borderRadius.md,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <AppText variant="subhead" weight="600" style={{ color: palette.action }}>
              {actionLabel}
            </AppText>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ─── Provider: one toast at a time, new replaces old ─────────────────────────

interface ToastApi {
  show: (content: ToastContent) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children, bottomOffset }: { children: React.ReactNode; bottomOffset?: number }): React.JSX.Element {
  const [state, setState] = useState<{ id: number; visible: boolean; content: ToastContent }>({
    id: 0,
    visible: false,
    content: { message: '' },
  });
  const show = useCallback((content: ToastContent) => {
    setState((s) => ({ id: s.id + 1, visible: true, content }));
  }, []);
  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
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
