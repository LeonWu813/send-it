/**
 * TabBar — floating opaque capsule for AppShell (design system v2.2 §29). No glass, no blur.
 *
 * 272x64 (3 x `tabItemWidth` 88 + 8), padding 4, centred, absolutely positioned at
 * `bottom = Math.max(insets.bottom - smd, sm)`. Container: `surface` + `ELEVATION.raised` (dark:
 * `surfaceElevated` + 1pt `border`). A 88x56 `secondaryContainer` pill glides under the selected
 * item (`spring.glide`, translateX = index x 88). Each item = icon 24 (outline `textSecondary` /
 * filled `primary`) + caption1 label ('500', selected '600' `onSecondaryContainer`), never scaled by
 * Dynamic Type; iOS Large Content Viewer enabled.
 *
 * Motion: user tap -> screen switches immediately, pill glides, icon / label layers cross-fade in
 * `micro`. Deep link / programmatic switch -> pill snaps. Press: icon 0.96 (`press`), release back
 * to 1 (`grip`). Reduce Motion: the pill fades out, moves, fades in; no icon scale. No haptics.
 * Hidden (fades in `short`) while the keyboard is up or when `hidden` (form screens).
 *
 * `TabBarFade` (exported) is the content-bottom gradient: 8 stepped `background` bands, shown only while
 * the tab's list can still scroll down; fades out `short` + `linear` at the end.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { ICON } from '../../../lib/icons';
import type { IoniconName } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import { tabBarBottomGap } from './AppHeaderContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabKey = 'home' | 'gyms' | 'profile';

interface TabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  /** insets.bottom from useSafeAreaInsets(). */
  bottomInset: number;
  /** Lets AppShell measure the capsule. */
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Hide (fade out) the bar: forms like log-send. Default false. */
  hidden?: boolean;
}

interface TabDef {
  key: TabKey;
  outline: IoniconName;
  filled: IoniconName;
  labelKey: string;
}

const TABS: TabDef[] = [
  { key: 'home', outline: ICON.home.outline, filled: ICON.home.filled, labelKey: 'tabs.home' },
  { key: 'gyms', outline: ICON.gyms.outline, filled: ICON.gyms.filled, labelKey: 'tabs.gyms' },
  { key: 'profile', outline: ICON.profile.outline, filled: ICON.profile.filled, labelKey: 'tabs.profile' },
];

const PADDING = 4;
const FADE_BANDS = 8;
const FADE_EXTRA = 16;

// ── Single item ───────────────────────────────────────────────────────────────

interface TabItemProps {
  def: TabDef;
  active: boolean;
  userTap: React.MutableRefObject<boolean>;
  onPress: () => void;
}

function TabItem({ def, active, userTap, onPress }: TabItemProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, scale, reduceMotion } = useMotion();
  const c = theme.colors;
  const label = t(def.labelKey);

  const sel = useRef(new Animated.Value(active ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  // Layer cross-fade: animated for user taps, snapped otherwise.
  useEffect(() => {
    if (userTap.current) {
      Animated.timing(sel, {
        toValue: active ? 1 : 0,
        duration: duration.micro,
        easing: bezierFor('standard'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      sel.setValue(active ? 1 : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const off = sel.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={label}
      onPress={onPress}
      onPressIn={() => {
        if (reduceMotion) return;
        Animated.timing(iconScale, {
          toValue: scale.pressControl,
          duration: duration.press,
          easing: bezierFor('standard'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        Animated.spring(iconScale, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
      }}
      style={[styles.item, { width: theme.componentSize.tabItemWidth, height: theme.componentSize.tabBarHeight - 2 * PADDING }]}
    >
      <Animated.View style={{ width: theme.iconSize.tab, height: theme.iconSize.tab, transform: [{ scale: iconScale }] }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: off }]}>
          <Ionicons name={def.outline} size={theme.iconSize.tab} color={c.textSecondary} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: sel }]}>
          <Ionicons name={def.filled} size={theme.iconSize.tab} color={c.primary} />
        </Animated.View>
      </Animated.View>

      {/* Label: the '600' layer reserves the bold width; the '500' layer overlays and fades out. */}
      <View style={{ marginTop: theme.layout.stackTight }}>
        <Animated.View style={{ opacity: sel }}>
          <AppText variant="caption1" weight="600" color="onSecondaryContainer" numberOfLines={1} maxFontSizeMultiplier={1}>
            {label}
          </AppText>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: off }]}>
          <AppText variant="caption1" weight="500" color="textSecondary" align="center" numberOfLines={1} maxFontSizeMultiplier={1}>
            {label}
          </AppText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TabBar({
  activeTab,
  onTabPress,
  bottomInset,
  onLayout,
  hidden = false,
}: TabBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const c = theme.colors;
  const itemW = theme.componentSize.tabItemWidth;
  const indexOf = (k: TabKey): number => TABS.findIndex((d) => d.key === k);

  const userTap = useRef(false);
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const pos = useRef(new Animated.Value(indexOf(activeTab) * itemW)).current;
  const pillOpacity = useRef(new Animated.Value(1)).current;
  const lastIndex = useRef(indexOf(activeTab));

  // Pill position: glide for user taps, snap for deep links / programmatic switches.
  useEffect(() => {
    const idx = indexOf(activeTab);
    if (idx === lastIndex.current) return;
    lastIndex.current = idx;
    const target = idx * itemW;
    if (!userTap.current) {
      pos.setValue(target);
      return;
    }
    if (reduceMotion) {
      Animated.timing(pillOpacity, { toValue: 0, duration: duration.micro, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
        pos.setValue(target);
        Animated.timing(pillOpacity, { toValue: 1, duration: duration.micro, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      });
      return;
    }
    // Rapid taps just retarget the running spring.
    Animated.spring(pos, { toValue: target, ...spring.glide, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Child effects and the pill effect above have already read `userTap` for this render; clear it for the next one.
  useEffect(() => {
    userTap.current = false;
  });

  // Keyboard / form screens: fade out.
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  const gone = hidden || kb;
  const visible = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(visible, { toValue: gone ? 0 : 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  function handlePress(key: TabKey): void {
    userTap.current = true;
    force();
    onTabPress(key);
  }

  const width = TABS.length * itemW + 2 * PADDING;

  return (
    <Animated.View
      accessibilityRole="tablist"
      pointerEvents={gone ? 'none' : 'auto'}
      onLayout={onLayout}
      style={[
        styles.container,
        {
          width,
          height: theme.componentSize.tabBarHeight,
          padding: PADDING,
          bottom: tabBarBottomGap(bottomInset),
          borderRadius: theme.radius.full,
          borderCurve: 'continuous',
          backgroundColor: theme.isDark ? c.surfaceElevated : c.surface,
          borderWidth: theme.isDark ? theme.stroke.thin : 0,
          borderColor: c.border,
          ...theme.elevation.raised,
          opacity: visible,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PADDING,
          left: PADDING,
          width: itemW,
          height: theme.componentSize.tabBarHeight - 2 * PADDING,
          borderRadius: theme.radius.full,
          backgroundColor: c.secondaryContainer,
          opacity: pillOpacity,
          transform: [{ translateX: pos }],
        }}
      />
      {TABS.map((def) => (
        <TabItem key={def.key} def={def} active={activeTab === def.key} userTap={userTap} onPress={() => handlePress(def.key)} />
      ))}
    </Animated.View>
  );
}

// ── Content-bottom fade (§29.2 ⑤) ────────────────────────────────────────────

/** `background` -> transparent behind the TabBar; only while the list can still scroll down. */
export function TabBarFade({ show, bottomInset }: { show: boolean; bottomInset: number }): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const opacity = useRef(new Animated.Value(show ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: show ? 1 : 0, duration: duration.short, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  const height = theme.componentSize.tabBarHeight + tabBarBottomGap(bottomInset) + FADE_EXTRA;
  return (
    <Animated.View testID="tabbar-fade" pointerEvents="none" style={[styles.fade, { height, opacity }]}>
      {Array.from({ length: FADE_BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: theme.colors.background, opacity: (i + 1) / FADE_BANDS }} />
      ))}
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    zIndex: 6,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
});
