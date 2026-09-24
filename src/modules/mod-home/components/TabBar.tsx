/**
 * TabBar — persistent bottom navigation bar for AppShell.
 *
 * Three tabs: Home (house), Gyms (map), Profile (person).
 * Active tab shows filled icon in theme.colors.primary.
 * Inactive tabs show outline icon in theme.colors.textSecondary.
 *
 * Safe area:
 *   - paddingBottom: bottomInset + spacing.sm so touch targets clear the home
 *     indicator (production.md "Bottom Safe Area for Pinned Bottom Bars").
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabKey = 'home' | 'gyms' | 'profile';

interface TabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  /** insets.bottom from useSafeAreaInsets() — applied as paddingBottom. */
  bottomInset: number;
}

// ── Tab definitions ───────────────────────────────────────────────────────────

interface TabDef {
  key: TabKey;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}

const TABS: TabDef[] = [
  {
    key: 'home',
    iconActive: 'home',
    iconInactive: 'home-outline',
    accessibilityLabel: 'Home',
  },
  {
    key: 'gyms',
    iconActive: 'map',
    iconInactive: 'map-outline',
    accessibilityLabel: 'Gyms',
  },
  {
    key: 'profile',
    iconActive: 'person',
    iconInactive: 'person-outline',
    accessibilityLabel: 'Profile',
  },
];

const TAB_ICON_SIZE = 26;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TabBar({
  activeTab,
  onTabPress,
  bottomInset,
}: TabBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = makeStyles(theme, bottomInset);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const iconName = isActive ? tab.iconActive : tab.iconInactive;
        const iconColor = isActive
          ? theme.colors.primary
          : theme.colors.textSecondary;

        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons name={iconName} size={TAB_ICON_SIZE} color={iconColor} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  bottomInset: number,
) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingBottom: bottomInset + theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xs,
    },
  });
}
