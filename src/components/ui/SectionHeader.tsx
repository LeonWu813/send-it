import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';

/** At or above this font scale the action drops under the title (text-button spec TA-1). */
export const SECTION_HEADER_STACK_FONT_SCALE = 1.6;
/** Title row height (28 = title3 line). `minHeight`, never `height`, so large type is not clipped. */
export const SECTION_HEADER_MIN_HEIGHT = 28;

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  loading?: boolean;
}

export interface SectionHeaderProps {
  title: string;
  /** The T1 slot: at most one action. Its label may change with state; its place never does. */
  action?: SectionHeaderAction;
  style?: StyleProp<ViewStyle>;
}

/**
 * Section title row with the T1 trailing slot (text-button spec TA-1, R4, A3): `pageSection` title and a
 * `text md` action on one baseline, the action's right edge on the right keyline. At font scale >= 1.6 the
 * action moves under the title on the left keyline.
 */
export function SectionHeader({ title, action, style }: SectionHeaderProps): React.JSX.Element {
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= SECTION_HEADER_STACK_FONT_SCALE;
  return (
    <View
      testID="section-header"
      style={[
        stacked
          ? { alignItems: 'flex-start' }
          : { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
        { minHeight: SECTION_HEADER_MIN_HEIGHT },
        style,
      ]}
    >
      <AppText variant="pageSection" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </AppText>
      {action ? (
        <Button
          variant="text"
          size="md"
          placement={stacked ? 'inline' : 'trailing'}
          label={action.label}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
          accessibilityHint={action.accessibilityHint}
          loading={action.loading}
          style={stacked ? { marginTop: theme.spacing.xs } : { marginLeft: theme.spacing.md }}
        />
      ) : null}
    </View>
  );
}
