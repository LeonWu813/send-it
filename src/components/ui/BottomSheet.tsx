import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** 'confirm' fires haptic `warning` on show. */
  variant?: 'default' | 'confirm';
  /** While loading the sheet cannot be dismissed by drag (10% damping) or backdrop. */
  loading?: boolean;
  /** Called after the exit animation finished and the Modal unmounted. */
  onClosed?: () => void;
  children?: React.ReactNode;
}

/**
 * Modal sheet: surfaceElevated panel with xl top radius, 36x5 grabber, overlay backdrop.
 * In: backdrop `short` linear, panel `settle` spring. Out: `short` exit. Drag past 30% height or
 * velocity > 0.5 closes, otherwise settles back. Reduce Motion: fades only.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  variant = 'default',
  loading = false,
  onClosed,
  children,
}: BottomSheetProps): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, reduceMotion, haptic } = useMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const panelHeight = useRef(windowHeight);
  const ty = useRef(new Animated.Value(windowHeight)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const titleRef = useRef<View>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      ty.setValue(reduceMotion ? 0 : panelHeight.current);
      fade.setValue(0);
      if (variant === 'confirm') haptic('warning', 'bottom-sheet');
      Animated.timing(fade, {
        toValue: 1,
        duration: duration.short,
        easing: bezierFor('linear'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      if (!reduceMotion) {
        Animated.spring(ty, { toValue: 0, ...spring.settle, useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
      const id = setTimeout(() => {
        const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }, duration.medium);
      return () => clearTimeout(id);
    }
    if (!mounted) return undefined;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
      ...(reduceMotion
        ? []
        : [Animated.timing(ty, { toValue: panelHeight.current, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER })]),
    ]).start(() => {
      setMounted(false);
      onClosed?.();
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = useCallback(() => {
    if (!loadingRef.current) onClose();
  }, [onClose]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !reduceMotion && Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          const damp = loadingRef.current ? 0.1 : 1;
          ty.setValue(Math.max(0, g.dy) * damp);
        },
        onPanResponderRelease: (_e, g) => {
          const shouldClose = !loadingRef.current && (g.dy > panelHeight.current * 0.3 || g.vy > 0.5);
          if (shouldClose) onClose();
          else Animated.spring(ty, { toValue: 0, ...spring.settle, useNativeDriver: USE_NATIVE_DRIVER }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduceMotion, onClose],
  );

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.fill} accessibilityViewIsModal>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay, opacity: fade }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel={t('ui.close')}
          />
        </Animated.View>
        <Animated.View
          onLayout={(e) => {
            panelHeight.current = e.nativeEvent.layout.height;
          }}
          onAccessibilityEscape={requestClose}
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderTopLeftRadius: theme.borderRadius.xl,
              borderTopRightRadius: theme.borderRadius.xl,
              paddingHorizontal: theme.layout.screenMarginCompact,
              paddingBottom: theme.spacing.lg,
              opacity: reduceMotion ? fade : 1,
              transform: [{ translateY: ty }],
            },
            theme.elevation.raised,
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={{ height: theme.componentSize.sheetDragZoneHeight, alignItems: 'center', justifyContent: 'flex-start' }}>
              <View
                style={{
                  marginTop: theme.componentSize.grabberTopOffset,
                  width: theme.componentSize.grabberWidth,
                  height: theme.componentSize.grabberHeight,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: theme.colors.outline,
                }}
              />
            </View>
            {title ? (
              <View ref={titleRef} accessible accessibilityRole="header" style={{ paddingVertical: theme.spacing.sm }}>
                <AppText variant="title3">{title}</AppText>
              </View>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  panel: { width: '100%' },
});
