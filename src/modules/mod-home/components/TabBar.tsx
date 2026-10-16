/**
 * TabBar — persistent bottom navigation bar for AppShell (design system §29 / §32.4).
 *
 * Three equal-width tabs: Home, Gyms, Profile. Each = Ionicons (tab 26) + caption1 text label.
 *   - Inactive: outline icon + textSecondary, label '400'.
 *   - Active:   filled icon + primary, label '600' primary. No indicator bar.
 *   - Pressed:  no visual feedback (iOS convention). No haptic. No content transition.
 *
 * Motion (§29.5) — played only for a user TAP (never on first load, deep link or a programmatic
 * tab switch): the newly selected icon scales 0.9 -> 1 (`grip`) while colour cross-fades in
 * `micro`. Re-tapping the active tab replays the icon scale. Reduce Motion: colour change only.
 *
 * Safe area: paddingBottom = Math.max(bottomInset, spacing.sm) (production.md "Bottom Safe Area
 * for Pinned Bottom Bars"). Labels never scale with Dynamic Type (maxFontSizeMultiplier 1);
 * iOS Large Content Viewer is enabled for long-press magnification.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { ICON } from '../../../lib/icons';
import type { IoniconName } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabKey = 'home' | 'gyms' | 'profile';

interface TabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  /** insets.bottom from useSafeAreaInsets() — paddingBottom is max(bottomInset, spacing.sm). */
  bottomInset: number;
  /** Lets AppShell measure the bar height (toast offset = height + 8). */
  onLayout?: (e: LayoutChangeEvent) => void;
}

// ── Tab definitions ───────────────────────────────────────────────────────────

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

const ICON_SCALE_FROM = 0.9;

// ── Single item ───────────────────────────────────────────────────────────────

interface TabItemProps {
  def: TabDef;
  active: boolean;
  /** Increments each time the user taps this tab (also when already active). */
  tapSeq: number;
  /** True while the current render was caused by a user tap (shared by all items). */
  userTap: React.MutableRefObject<boolean>;
  onPress: () => void;
}

function TabItem({ def, active, tapSeq, userTap, onPress }: TabItemProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const c = theme.colors;
  const label = t(def.labelKey);

  const sel = useRef(new Animated.Value(active ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const seenTap = useRef(tapSeq);

  // Selection colour cross-fade — only when the change came from a user tap (both the newly
  // selected and the deselected tab fade). First load / deep link / programmatic changes snap.
  useEffect(() => {
    if (userTap.current && !reduceMotion) {
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

  // A user tap on THIS tab: replay the icon scale (new selection or re-tap).
  useEffect(() => {
    if (tapSeq === seenTap.current) return;
    seenTap.current = tapSeq;
    if (reduceMotion) return;
    iconScale.setValue(ICON_SCALE_FROM);
    Animated.spring(iconScale, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [tapSeq, reduceMotion, iconScale, spring.grip]);

  const off = sel.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={label}
      onPress={onPress}
      style={[styles.item, { paddingTop: theme.spacing.sm, minHeight: 54 }]}
    >
      {/* Icon: outline (off) and filled (on) layers cross-fade; the pair scales together. */}
      <Animated.View style={{ width: theme.iconSize.tab, height: theme.iconSize.tab, transform: [{ scale: iconScale }] }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: off }]}>
          <Ionicons name={def.outline} size={theme.iconSize.tab} color={c.textSecondary} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: sel }]}>
          <Ionicons name={def.filled} size={theme.iconSize.tab} color={c.primary} />
        </Animated.View>
      </Animated.View>

      {/* Label: the '600' layer reserves the bold width; the '400' layer overlays and fades out. */}
      <View style={{ marginTop: theme.layout.stackTight }}>
        <Animated.View style={{ opacity: sel }}>
          <AppText variant="caption1" weight="600" color="primary" numberOfLines={1} maxFontSizeMultiplier={1}>
            {label}
          </AppText>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: off }]}>
          <AppText
            variant="caption1"
            weight="400"
            color="textSecondary"
            align="center"
            numberOfLines={1}
            maxFontSizeMultiplier={1}
          >
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
}: TabBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const tapSeqs = useRef<Record<TabKey, number>>({ home: 0, gyms: 0, profile: 0 });
  const userTap = useRef(false);
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  // Child effects have already read `userTap` for this render; clear it for the next one.
  useEffect(() => {
    userTap.current = false;
  });

  function handlePress(key: TabKey): void {
    userTap.current = true;
    tapSeqs.current = { ...tapSeqs.current, [key]: tapSeqs.current[key] + 1 };
    force();
    onTabPress(key);
  }

  return (
    <View
      accessibilityRole="tablist"
      onLayout={onLayout}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopWidth: theme.stroke.thin,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(bottomInset, theme.spacing.sm),
        },
      ]}
    >
      {TABS.map((def) => (
        <TabItem
          key={def.key}
          def={def}
          active={activeTab === def.key}
          tapSeq={tapSeqs.current[def.key]}
          userTap={userTap}
          onPress={() => handlePress(def.key)}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
});
