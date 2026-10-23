import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { InlineError } from './InlineError';

export type BottomSheetVariant = 'content' | 'list-single' | 'form' | 'confirm';
export type BottomSheetPresentation = 'floating' | 'attached';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Secondary text under the title (textSecondary). */
  description?: string;
  /**
   * content: explanation + optional footer. list-single: single-choice option rows (ListRow
   * `selectable`), no footer; close it with `useSheetSelect`. form: inputs + primary submit footer,
   * keyboard-avoiding. confirm: title + description + stacked destructive / cancel buttons, fires
   * haptic `warning` on show. (Multi-select menus are Phase 2: not built.)
   */
  variant?: BottomSheetVariant;
  /**
   * floating: inset 8 from the left / right / bottom, four corners `sheet` 32. attached: full width,
   * top corners 32, bottom edge 0. Default: `form` = attached, everything else floating. A floating
   * sheet switches to attached by itself when its content is taller than 60% of the window or the
   * font scale is >= 1.6 (Accessibility sizes).
   */
  presentation?: BottomSheetPresentation;
  /** list-single: number of options. More than 6 switches a floating sheet to attached. */
  optionCount?: number;
  /** While loading the sheet cannot be dismissed (drag has 10% damping; backdrop, escape and close are inert). */
  loading?: boolean;
  /** Fixed action area under the content (content / form): usually a full-width `lg` Button. */
  footer?: React.ReactNode;
  /** confirm: destructive button (top, lg, full width). */
  confirmLabel?: string;
  confirmIcon?: IoniconName;
  onConfirm?: () => void;
  /** confirm: secondary button under it. Defaults to common.cancel. */
  cancelLabel?: string;
  /** Failure inside the sheet: an InlineError block above the actions. The sheet stays open, input is kept. */
  error?: string;
  errorActionLabel?: string;
  onErrorAction?: () => void;
  /** Called after the exit animation finished and the Modal unmounted. */
  onClosed?: () => void;
  /**
   * When false, dragging the sheet down does not trigger dismiss (the sheet springs back).
   * The close button and Cancel / backdrop still work unless also suppressed.
   * Default: true.
   */
  swipeable?: boolean;
  /**
   * When false, tapping the backdrop does not call onClose.
   * The close button and Cancel actions still work.
   * Default: true.
   */
  dismissOnBackdrop?: boolean;
  children?: React.ReactNode;
}

/**
 * list-single helper: call `select(apply)` from an option's onPress. It fires haptic `select`, runs
 * `apply`, then waits `duration.short` (so the checkmark finishes its grip) before closing.
 */
export function useSheetSelect(onClose: () => void): (apply?: () => void) => void {
  const { duration, haptic } = useMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (apply) => {
      haptic('select', 'sheet-option');
      apply?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(onClose, duration.short);
    },
    [onClose, duration.short, haptic],
  );
}

/**
 * Modal sheet (v2.2): `surfaceElevated` panel, radius `sheet` 32 (continuous), 36x5 grabber, `overlay`
 * backdrop, title row with a `small` 30 close IconButton (none on `confirm`: Cancel is the close).
 * Floating: in = translateY +24 -> 0 with `settle`, opacity timing `short` + `enter` (M12); out =
 * translateY +24 + opacity `short` + `exit`; a drag-dismiss continues off screen. Attached: `settle`
 * from off screen with overshootClamping, out `short` exit. The backdrop follows the drag (clamped).
 * Dragging works under Reduce Motion (direct manipulation); past 30% (or velocity > 0.5) closes.
 * Reduce Motion: enter / exit are opacity only.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  variant = 'content',
  presentation,
  optionCount,
  loading = false,
  footer,
  confirmLabel,
  confirmIcon,
  onConfirm,
  cancelLabel,
  error,
  errorActionLabel,
  onErrorAction,
  onClosed,
  swipeable = true,
  dismissOnBackdrop = true,
  children,
}: BottomSheetProps): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, distance, reduceMotion, haptic } = useMotion();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [panelH, setPanelH] = useState(windowHeight);
  const [tooTall, setTooTall] = useState(false);
  const floatingDefault = variant !== 'form' && presentation !== 'attached';
  const attached = !floatingDefault || tooTall || fontScale >= 1.6 || (variant === 'list-single' && (optionCount ?? 0) > 6);
  const inset = theme.layout.sheetInset;
  const panelFade = useRef(new Animated.Value(0)).current;
  const draggedClose = useRef(false);
  const panelHeight = useRef(windowHeight);
  const ty = useRef(new Animated.Value(windowHeight)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const grab = useRef(new Animated.Value(0)).current;
  const titleRef = useRef<View>(null);
  const crossed = useRef(false);
  const live = useRef({ loading, reduceMotion, onClose, attached, exitFar: 0, swipeable, dismissOnBackdrop });
  live.current = { loading, reduceMotion, onClose, attached, exitFar: panelH + inset + insets.bottom, swipeable, dismissOnBackdrop };

  const springTo = useCallback(
    (toValue: number) => {
      if (live.current.reduceMotion) {
        Animated.timing(ty, { toValue, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      } else {
        Animated.spring(ty, { toValue, ...spring.settle, ...SPRING_REST, overshootClamping: true, useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
    },
    [ty, spring, duration.short],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setTooTall(false);
      const floating = !live.current.attached;
      ty.setValue(reduceMotion ? 0 : floating ? distance.sheetFloatEnter : panelHeight.current);
      fade.setValue(0);
      panelFade.setValue(0);
      draggedClose.current = false;
      crossed.current = false;
      // opacity is ALWAYS timing (M12): the spring only drives translateY
      Animated.timing(panelFade, {
        toValue: 1,
        duration: duration.short,
        easing: bezierFor(reduceMotion ? 'standard' : 'enter'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      if (variant === 'confirm') haptic('warning', 'bottom-sheet');
      Animated.timing(fade, {
        toValue: 1,
        duration: duration.short,
        easing: bezierFor('linear'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      if (!reduceMotion) {
        Animated.spring(ty, { toValue: 0, ...spring.settle, ...SPRING_REST, overshootClamping: true, useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
      const id = setTimeout(() => {
        // findNodeHandle does not exist on web (Storybook); VoiceOver focus is native-only anyway
        if (Platform.OS === 'web') return;
        const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }, duration.medium);
      return () => clearTimeout(id);
    }
    if (!mounted) return undefined;
    const floating = !live.current.attached;
    const dragged = draggedClose.current;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: duration.short, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }),
      ...(floating && !dragged
        ? [Animated.timing(panelFade, { toValue: 0, duration: duration.short, easing: bezierFor(reduceMotion ? 'standard' : 'exit'), useNativeDriver: USE_NATIVE_DRIVER })]
        : reduceMotion
          ? [Animated.timing(panelFade, { toValue: 0, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER })]
          : []),
      ...(reduceMotion
        ? []
        : [
            Animated.timing(ty, {
              toValue: dragged ? live.current.exitFar : floating ? distance.sheetFloatEnter : panelHeight.current,
              duration: duration.short,
              easing: bezierFor('exit'),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
    ]).start(() => {
      setMounted(false);
      onClosed?.();
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = useCallback(() => {
    if (!live.current.loading) live.current.onClose();
  }, []);

  // Grabber "grip" feedback (Motion D6): colour layer + scaleX, released over `short`.
  const setGrabbed = useCallback(
    (on: boolean) => {
      if (on) {
        if (live.current.reduceMotion) {
          Animated.timing(grab, { toValue: 1, duration: duration.micro, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
        } else {
          Animated.spring(grab, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
      } else {
        Animated.timing(grab, { toValue: 0, duration: duration.release, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
    },
    [grab, spring, duration.micro, duration.release],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Direct manipulation: allowed under Reduce Motion too (only the settle-back changes).
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          crossed.current = false;
        },
        onPanResponderMove: (_e, g) => {
          const damp = live.current.loading ? 0.1 : 1;
          const dy = Math.max(0, g.dy) * damp;
          ty.setValue(dy);
          if (!live.current.loading && !crossed.current && dy > panelHeight.current * 0.3) {
            crossed.current = true;
            haptic('select', 'sheet-threshold');
          }
        },
        onPanResponderRelease: (_e, g) => {
          const shouldClose = !live.current.loading && live.current.swipeable && (g.dy > panelHeight.current * 0.3 || g.vy > 0.5);
          setGrabbed(false);
          if (shouldClose) {
            draggedClose.current = true;
            live.current.onClose();
          }
          else springTo(0);
        },
        onPanResponderTerminate: () => {
          setGrabbed(false);
          springTo(0);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!mounted) return null;

  const c = theme.colors;
  const floating = !attached;
  const maxHeight = attached ? windowHeight - insets.top - inset : windowHeight * 0.9;
  const padX = theme.spacing.mdl;
  const backdropOpacity = Animated.multiply(
    fade,
    ty.interpolate({ inputRange: [0, Math.max(panelH, 1)], outputRange: [1, 0], extrapolate: 'clamp' }),
  );
  // floating: the panel already sits `sheetInset` above the screen edge, so the home indicator needs
  // (insets.bottom - inset + sm); attached: max(insets.bottom, md).
  const bottomPad = floating ? Math.max(insets.bottom - inset + theme.spacing.sm, theme.spacing.mdl) : Math.max(insets.bottom, theme.spacing.md);
  const closeBox = theme.layout.minTouchTarget;
  const small = theme.componentSize.smallButton;
  const closeTop = theme.componentSize.sheetDragZoneHeight + (closeBox - small) / 2;
  const showClose = variant !== 'confirm';

  const actions =
    variant === 'confirm' ? (
      <View style={{ marginTop: children ? theme.layout.sectionGap : theme.spacing.md }}>
        <Button
          variant="destructive"
          size="lg"
          fullWidth
          label={confirmLabel ?? ''}
          icon={confirmIcon ?? ICON.delete.outline}
          loading={loading}
          onPress={() => onConfirm?.()}
        />
        <View style={{ height: theme.spacing.sm }} />
        <Button variant="secondary" size="lg" fullWidth label={cancelLabel ?? t('common.cancel')} disabled={loading} onPress={requestClose} />
      </View>
    ) : footer ? (
      <View style={{ marginTop: theme.layout.sectionGap }}>{footer}</View>
    ) : null;

  const body = (
    <Animated.View
      onLayout={(e) => {
        panelHeight.current = e.nativeEvent.layout.height;
        setPanelH(e.nativeEvent.layout.height);
        // content taller than 60% of the window: switch to the attached presentation (once per open)
        if (floatingDefault && e.nativeEvent.layout.height > windowHeight * theme.componentSize.sheetFloatMaxHeightRatio) setTooTall(true);
      }}
      onAccessibilityEscape={requestClose}
      style={[
        floating ? null : styles.panel,
        {
          maxHeight,
          backgroundColor: c.surfaceElevated,
          borderTopLeftRadius: theme.radius.sheet,
          borderTopRightRadius: theme.radius.sheet,
          ...(floating ? { borderBottomLeftRadius: theme.radius.sheet, borderBottomRightRadius: theme.radius.sheet } : null),
          borderCurve: 'continuous',
          paddingHorizontal: padX,
          paddingBottom: bottomPad,
          ...(floating
            ? {
                alignSelf: 'stretch',
                marginHorizontal: inset,
                marginBottom: inset,
                borderWidth: theme.isDark ? theme.stroke.thin : 0,
                borderColor: c.border,
                ...theme.elevation.raised,
              }
            : null),
          opacity: panelFade,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      <View {...pan.panHandlers}>
        <View
          onTouchStart={() => setGrabbed(true)}
          onTouchEnd={() => setGrabbed(false)}
          onTouchCancel={() => setGrabbed(false)}
          style={{ height: theme.componentSize.sheetDragZoneHeight, alignItems: 'center', justifyContent: 'flex-start' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            style={{
              marginTop: theme.componentSize.grabberTopOffset,
              width: theme.componentSize.grabberWidth,
              height: theme.componentSize.grabberHeight,
              borderRadius: theme.radius.full,
              backgroundColor: c.outline,
              transform: reduceMotion ? [] : [{ scaleX: grab.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
            }}
          >
            {/* second colour layer cross-fades in (no backgroundColor animation) */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: theme.radius.full, backgroundColor: c.textSecondary, opacity: grab },
              ]}
            />
          </Animated.View>
        </View>
        {title ? (
          <View
            ref={titleRef}
            accessible
            accessibilityRole="header"
            style={{ paddingTop: (closeBox - theme.typeScale.title2.lineHeight) / 2, paddingRight: showClose ? closeBox : 0 }}
          >
            <AppText variant="title2" numberOfLines={fontScale >= 1.6 ? undefined : 2}>
              {title}
            </AppText>
          </View>
        ) : (
          <View style={{ height: closeBox }} />
        )}
      </View>
      {description ? (
        <AppText variant="subhead" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
          {description}
        </AppText>
      ) : null}
      {children ? (
        <ScrollView
        style={{ flexShrink: 1, marginTop: description ? theme.spacing.sm : theme.spacing.md }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {children}
        </ScrollView>
      ) : null}
      {error ? (
        <InlineError
          variant="block"
          on="elevated"
          message={error}
          actionLabel={errorActionLabel}
          onAction={onErrorAction}
          style={{ marginTop: theme.spacing.sm }}
        />
      ) : null}
      {actions}
      {/* Close sits last in JSX (VoiceOver order: title, description, content, actions, close) and is
          positioned top-right. Its outer edge is screenMargin - 10 so the 24pt glyph lines up with content. */}
      {showClose ? (
        <View style={{ position: 'absolute', top: closeTop, right: padX }}>
          <IconButton
            variant="small"
            name={ICON.close.outline}
            accessibilityLabel={t('ui.close')}
            disabled={loading}
            onPress={requestClose}
          />
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.fill} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissOnBackdrop ? requestClose : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('ui.close')}
          />
        </Animated.View>
        {variant === 'form' ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
            {body}
          </KeyboardAvoidingView>
        ) : (
          body
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  kav: { justifyContent: 'flex-end' },
  panel: { width: '100%' },
});
