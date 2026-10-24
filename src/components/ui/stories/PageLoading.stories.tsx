import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { PageLoading } from '../PageLoading';

/** A stand-in nested header (58 high) so the centring below the header is visible. */
function ScreenFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ width: 393, height: 640, backgroundColor: theme.colors.background }}>
      <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton variant="float" name={ICON.back.outline} accessibilityLabel="back" onPress={() => {}} />
        <AppText variant="headline" style={{ marginLeft: 12 }}>
          岩館
        </AppText>
      </View>
      {children}
    </View>
  );
}

const meta: Meta = {
  title: 'Components/PageLoading',
  component: PageLoading,
};
export default meta;

/**
 * The one full-page loading state: large `textSecondary` spinner, centred horizontally and vertically in the
 * visible area (below the header, above the tab bar). No card, no text, no skeleton. Use `phase === 'loading'` from useLoadingPhase (nothing for 300ms).
 */
export const Default: StoryObj = {
  render: () => (
    <ScreenFrame>
      <PageLoading />
    </ScreenFrame>
  ),
};
