import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AscentRowSkeleton, RouteCardSkeleton, Skeleton, SkeletonGroup, StatsPanelSkeleton, VideoCellSkeleton } from '../Skeleton';
import { Row } from './_helpers';

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
        <Skeleton shape="thumb" width={88} height={88} surface={surface} />
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
      {onPage ? rows : <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, padding: 12 }}>{rows}</View>}
    </View>
  );
}

const meta: Meta<{ onPage: boolean }> = {
  title: 'UI/Skeleton',
  component: Demo,
  args: { onPage: false },
};
export default meta;

/** Radii follow the replaced element: text minor 4, circle full, thumbnail 12, card 20, tape 6. */
export const Playground: StoryObj<{ onPage: boolean }> = {};

/** The four v2.2 compositions: identical geometry to the real content. */
export const FourLayouts: StoryObj<{ onPage: boolean }> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="RouteCardSkeleton (card 20, tape lg, 2 lines, thumb 88)">
        <SkeletonGroup label="路線載入中"><RouteCardSkeleton /></SkeletonGroup>
      </Row>
      <Row label="AscentRowSkeleton (thumb 56, 2 lines, disc 28)">
        <SkeletonGroup label="紀錄載入中"><AscentRowSkeleton /></SkeletonGroup>
      </Row>
      <Row label="VideoCellSkeleton (3:4, border colour on the page)">
        <View style={{ width: 120 }}><SkeletonGroup label="影片載入中"><VideoCellSkeleton /></SkeletonGroup></View>
      </Row>
      <Row label="StatsPanelSkeleton">
        <SkeletonGroup label="統計載入中"><StatsPanelSkeleton /></SkeletonGroup>
      </Row>
    </View>
  ),
};
