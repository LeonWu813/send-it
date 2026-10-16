import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import RouteCard from '../../../components/RouteCard';

// Off-spec design tooling. Fake data only.
// Note: thumbnails go through getPhotoSignedUrl -> stubbed supabase storage, which returns
// 'about:blank', so a route with photo_url renders an empty Image (not a real picture).
const PHOTO = 'https://example.invalid/storage/v1/object/public/route-photos/fake.jpg';

const baseRoute = {
  id: 'r1',
  name: 'Blue Crimp Project',
  grade: 'V4',
  photo_url: null,
  gymName: 'Boulder Lab Taipei',
};

const meta: Meta<typeof RouteCard> = {
  title: 'Home/RouteCard',
  component: RouteCard,
  decorators: [
    (Story) => (
      <View style={{ width: 375, padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    route: baseRoute,
    onPress: () => {},
    onBookmarkToggle: () => {},
    betaVideoCount: 0,
    hasSend: false,
    sendStyle: null,
    isSaved: false,
  },
  argTypes: {
    sendStyle: { control: 'select', options: [null, 'flash', 'top'] },
    betaVideoCount: { control: 'number' },
  },
};
export default meta;
type Story = StoryObj<typeof RouteCard>;

export const Default: Story = {};
export const Saved: Story = { args: { isSaved: true } };
export const Unsaved: Story = { args: { isSaved: false } };
export const NoBetaVideos: Story = { args: { betaVideoCount: 0 } };
export const WithBetaVideos: Story = { args: { betaVideoCount: 12 } };
export const SendFlash: Story = { args: { hasSend: true, sendStyle: 'flash' } };
export const SendTop: Story = { args: { hasSend: true, sendStyle: 'top' } };
export const SendNone: Story = { args: { hasSend: false, sendStyle: null } };
export const WithThumbnail: Story = {
  args: { route: { ...baseRoute, photo_url: PHOTO } },
};
export const WithoutThumbnail: Story = {
  args: { route: { ...baseRoute, photo_url: null } },
};
export const NoGymName: Story = {
  args: { route: { ...baseRoute, gymName: undefined } },
};
export const LongRouteName: Story = {
  args: {
    route: {
      ...baseRoute,
      name: 'An Extremely Long Route Name That Keeps Going And Going To Test Wrapping And Truncation Behaviour',
      gymName: 'A Very Long Gym Name That Should Be Truncated To A Single Line In The Card',
    },
    hasSend: true,
    sendStyle: 'flash',
    isSaved: true,
    betaVideoCount: 3,
  },
};
export const AllStates: Story = {
  args: {
    hasSend: true,
    sendStyle: 'top',
    isSaved: true,
    betaVideoCount: 5,
    route: { ...baseRoute, photo_url: PHOTO },
  },
};
