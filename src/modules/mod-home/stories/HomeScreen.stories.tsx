import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { ToastProvider } from '../../../components/ui/Toast';
import HomeScreen from '../screens/HomeScreen';

// Off-spec design tooling. Fake data only; supabase stub never touches the network.
const fakeSession = { user: { id: 'story-user-me' } } as unknown as Session;

type StubState = 'signed-in' | 'empty';

function setupStubs(state: StubState): void {
  resetStubData();
  if (state === 'signed-in') {
    setStubData('admin_banners', [
      { id: 'b1', title: '壁面更新通知', body: '本週六全館 V0-V4 重設，歡迎挑戰。', image_url: null, is_active: true },
    ]);
    setStubData('saved_gyms', [
      { gym_id: 'g1', gyms: { id: 'g1', name: '紅石攀岩館', photo_url: null, cover_photo_url: null } },
      { gym_id: 'g2', gyms: { id: 'g2', name: 'B-Pump 台北店', photo_url: null, cover_photo_url: null } },
    ]);
    setStubData('saved_routes', [{ route_id: 'r1' }, { route_id: 'r2' }]);
    setStubData('routes', [
      { id: 'r1', gym_id: 'g1', grade: 'V4', color_tag: 'red', photo_url: null, section_label: 'Cave', gyms: { name: '紅石攀岩館' }, status: 'active' },
      { id: 'r2', gym_id: 'g2', grade: 'V6', color_tag: 'blue', photo_url: null, section_label: null, gyms: { name: 'B-Pump 台北店' }, status: 'active' },
    ]);
    setStubData('follows', [
      { followee_id: 'u1', users: { id: 'u1', display_name: 'Alex Chen', avatar_url: null } },
      { followee_id: 'u2', users: { id: 'u2', display_name: 'Jessica Wang', avatar_url: null } },
    ]);
    setStubData('beta_videos', [
      { user_id: 'u1', updated_at: new Date(Date.now() - 86_400_000).toISOString() },
      { user_id: 'u2', updated_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    ]);
  }
  // empty: all tables return [] (stub default), banner shows placeholder card (AC-112 Rev 38).
  setStubData('user_route_visits', []);
  setStubData('rpc:routes_with_new_beta', []);
  setStubData('ascents', []);
}

/** Seed stubs before first render and on arg change (Storybook Controls re-mount). */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state); // sync seed so HomeScreen's first fetch sees data
  useEffect(() => { setupStubs(state); }, [state]);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Home/HomeScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, ctx) => (
      <View style={{ width: 390, height: 780 }}>
        <ToastProvider>
          <WithStubs state={(ctx.args as Args).state}>
            <Story />
          </WithStubs>
        </ToastProvider>
      </View>
    ),
  ],
  args: { state: 'signed-in' },
  argTypes: {
    state: {
      control: 'inline-radio',
      options: ['signed-in', 'empty'],
      description: 'signed-in: all four sections populated; empty: every section shows its empty-state or placeholder',
    },
  },
  render: () => (
    <HomeScreen
      session={fakeSession}
      isActive
      onViewAllGyms={() => {}}
      onSelectGym={() => {}}
      onSelectRoute={() => {}}
      onSelectClimber={() => {}}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/** Toggle signed-in / empty in Controls; Events Banner always renders (AC-112 Rev 38). */
export const Playground: Story = {};

/** All four sections populated: banner, two gyms, two projecting routes, two following-activity rows. */
export const SignedIn: Story = { args: { state: 'signed-in' } };

/** New-user state: no data. Events Banner shows "No active events" placeholder; other sections show inline empty prompts. */
export const Empty: Story = { args: { state: 'empty' } };
