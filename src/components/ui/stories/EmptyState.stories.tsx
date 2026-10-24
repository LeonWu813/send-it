import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { EmptyState } from '../EmptyState';
import type { EmptyStateProps } from '../EmptyState';

const glyphs = {
  default: undefined,
  route: ICON.route.outline,
  betaVideo: ICON.betaVideo.outline,
  sends: ICON.sends.outline,
  notifications: ICON.notifications.outline,
  followers: ICON.followers.outline,
  locked: ICON.locked.outline,
};

/** Page-width frame with a 58 high stand-in header, so the 48pt anchor under the header shows. */
function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ width: 393, minHeight: 480, backgroundColor: theme.colors.background, paddingHorizontal: 16 }}>
      <View style={{ height: 58, justifyContent: 'center' }}>
        <AppText variant="headline">標題</AppText>
      </View>
      {children}
    </View>
  );
}

function Demo(props: EmptyStateProps): React.JSX.Element {
  return (
    <Frame>
      <EmptyState {...props} />
    </Frame>
  );
}

const meta: Meta<EmptyStateProps> = {
  title: 'Components/EmptyState',
  component: Demo,
  args: {
    variant: 'page',
    icon: undefined,
    title: '還沒有追蹤者',
    description: '分享 Beta 影片，讓其他攀岩者認識你。',
    primaryLabel: '',
    secondaryLabel: '',
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['page', 'section', 'filtered', 'error'],
      description: 'E1 page / E2 section / E3 filtered / E4 error. Old names (prompt, firstUse, private, inline, slot) are deprecated aliases kept one version.',
    },
    icon: { control: 'select', options: Object.keys(glyphs), mapping: glyphs },
    primaryTone: { control: 'inline-radio', options: ['primary', 'secondary'] },
    onPrimary: { action: 'primary' },
    onSecondary: { action: 'secondary' },
  },
};
export default meta;

export const Playground: StoryObj<EmptyStateProps> = {};

/** E1 page: nothing on the screen. Icon disc, title, description, optional primary (hug) and centred link. */
export const Page: StoryObj<EmptyStateProps> = {
  render: () => (
    <Frame>
      <EmptyState
        variant="page"
        icon={ICON.route.outline}
        title="這間岩館還沒有路線"
        description="看到牆上的路線，就新增第一條。"
        primaryLabel="新增路線"
        secondaryLabel="找不到你的岩館？申請加入"
      />
    </Frame>
  ),
};

/** E2 section: left aligned on the keyline, one sentence and one ghost action. */
export const Section: StoryObj<EmptyStateProps> = {
  render: () => (
    <Frame>
      <AppText variant="title3" style={{ marginTop: 8 }}>
        完攀紀錄
      </AppText>
      <EmptyState variant="section" description="還沒有完攀紀錄。" secondaryLabel="找路線" />
    </Frame>
  ),
};

/** E3 filtered: data exists but the filter excluded it. Primary "clear filters" hugs, link is centred. */
export const Filtered: StoryObj<EmptyStateProps> = {
  render: () => (
    <Frame>
      <EmptyState
        variant="filtered"
        icon={ICON.filter.outline}
        title="找不到符合的路線"
        description="換個難度或顏色試試。"
        primaryLabel="清除篩選"
        secondaryLabel="找不到路線？新增一條"
      />
    </Frame>
  ),
};

/** E4 error: the page failed to load. Error-coloured icon, secondary Retry with the reload glyph. */
export const ErrorState: StoryObj<EmptyStateProps> = {
  name: 'Error',
  render: () => (
    <Frame>
      <EmptyState variant="error" title="岩館載不出來" description="檢查網路後再試一次。" primaryLabel="重試" />
    </Frame>
  ),
};

/** Title only, and title + description without an action. */
export const Compositions: StoryObj<EmptyStateProps> = {
  render: () => (
    <View style={{ rowGap: 8 }}>
      <Frame>
        <EmptyState variant="page" icon={ICON.block.outline} title="沒有封鎖任何人" />
      </Frame>
      <Frame>
        <EmptyState variant="page" icon={ICON.followers.outline} title="還沒有追蹤者" description="分享 Beta 影片，讓其他攀岩者認識你。" />
      </Frame>
    </View>
  ),
};

/** The five variants side by side (E1 page, E2 section, E3 filtered, E4 error). */
export const AllVariants: StoryObj<EmptyStateProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375, rowGap: 24 }}>
      <EmptyState variant="page" icon={ICON.followers.outline} title="還沒有追蹤者" description="分享 Beta 影片，讓其他攀岩者認識你。" style={{ paddingTop: 0 }} />
      <EmptyState variant="section" description="還沒有完攀紀錄。" secondaryLabel="找路線" />
      <EmptyState variant="filtered" title="找不到符合的岩館" description="換個關鍵字或城市試試。" primaryLabel="清除篩選" style={{ paddingTop: 0 }} />
      <EmptyState variant="error" title="路線載不出來" description="檢查網路後再試一次。" primaryLabel="重試" style={{ paddingTop: 0 }} />
    </View>
  ),
};
