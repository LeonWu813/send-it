import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { Skeleton, SkeletonGroup } from '../Skeleton';

function Demo({ onPage }: { onPage: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const surface = onPage ? 'page' : 'card';
  const rows = (
    <SkeletonGroup label="路線載入中">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 12, justifyContent: 'center' }}>
          <Skeleton shape="text" textVariant="subhead" width="70%" surface={surface} />
          <Skeleton shape="text" textVariant="caption1" width="60%" surface={surface} />
        </View>
        <Skeleton shape="thumb" width={80} height={80} surface={surface} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Skeleton shape="circle" width={32} height={32} surface={surface} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton shape="text" textVariant="footnote" surface={surface} />
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

/** Radii follow the replaced element: text sm, circle full, thumbnail md, card lg. */
export const Playground: StoryObj<{ onPage: boolean }> = {};
