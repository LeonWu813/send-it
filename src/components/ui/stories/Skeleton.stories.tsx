import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { Skeleton, SkeletonGroup } from '../Skeleton';

function Demo({ onPage }: { onPage: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const surface = onPage ? 'page' : 'card';
  const rows = (
    <SkeletonGroup>
      <View style={{ flexDirection: 'row' }}>
        <Skeleton width={80} height={80} surface={surface} />
        <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-between' }}>
          <Skeleton height={14} width="40%" surface={surface} />
          <Skeleton height={16} surface={surface} />
          <Skeleton height={12} width="60%" surface={surface} />
        </View>
      </View>
    </SkeletonGroup>
  );
  return (
    <View style={{ padding: 16, width: 375 }}>
      {onPage ? rows : <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: 12 }}>{rows}</View>}
    </View>
  );
}

const meta: Meta<{ onPage: boolean }> = {
  title: 'UI/Skeleton',
  component: Demo,
  args: { onPage: false },
};
export default meta;

export const Playground: StoryObj<{ onPage: boolean }> = {};
