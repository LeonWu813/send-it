import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import HomeScreen from '../screens/HomeScreen';

// Off-spec design tooling. Fake data only; supabase stub never touches the network.
const fakeSession = { user: { id: 'story-user-me' } } as unknown as Session;

type StubState = 'populated' | 'empty' | 'loading';

const ME = 'story-user-me';

function setupStubs(state: StubState): void {
  resetStubData();
  // fetchUserAchievements (projecting routes) reads the signed-in user from auth.
  setStubData('auth:session', { user: { id: ME } });
  if (state === 'loading') {
    // Never-resolving queries keep every section in its loading state (headings only).
    ['admin_banners', 'saved_gyms', 'saved_routes', 'routes', 'follows', 'beta_videos', 'user_route_visits', 'ascents', 'rpc:routes_with_new_beta'].forEach(
      (key) => setStubData(key, STUB_PENDING),
    );
    return;
  }
  if (state === 'populated') {
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
    // Five followed climbers: Following shows the latest 3 + 「顯示全部 (5)」 (H-1).
    const FOLLOWED = [
      ['u1', 'Alex Chen'],
      ['u2', 'Jessica Wang'],
      ['u3', '林小岩'],
      ['u4', 'Sam Rivera'],
      ['u5', '王大攀'],
    ];
    setStubData(
      'follows',
      FOLLOWED.map(([id, name]) => ({ followee_id: id, users: { id, display_name: name, avatar_url: null } })),
    );
    setStubData(
      'beta_videos',
      FOLLOWED.map(([id], i) => ({ user_id: id, updated_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString() })),
    );
  }
  // empty: all tables return [] (stub default), banner shows placeholder card (AC-112 Rev 38).
  setStubData('user_route_visits', []);
  setStubData('rpc:routes_with_new_beta', []);
  setStubData('ascents', []);
}

/** Seed stubs synchronously so HomeScreen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Home/Home',
  component: HomeScreen as never, // real component; story args only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'home' } },
  decorators: [
    (Story, ctx) => (
      <WithStubs state={(ctx.args as Args).state}>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { state: { control: false } },
  render: () => (
    <HomeScreen
      session={fakeSession}
      isActive
      onViewAllGyms={() => {}}
      onSelectGym={() => {}}
      onSelectRoute={() => {}}
      onSelectClimber={() => {}}
      onFindClimbers={() => {}}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/**
 * Order (AC-111 change): banner, Following, Saved Gyms, Projecting. Following heading at y318, three 72pt
 * rows end at y570, then the inline 「顯示全部 (5)」 row (tap to expand in place). Compact 80pt route cards.
 */
export const Populated: Story = { args: { state: 'populated' } };

/** New-user state: no data. 52pt "No active events" placeholder; Following is one 52pt row with 「找攀岩者」; other sections show inline empty prompts. */
export const Empty: Story = { args: { state: 'empty' } };

/** Every section still fetching (queries never resolve). */
export const Loading: Story = { args: { state: 'loading' } };

// No Error story: HomeScreen has no error UI. A failed fetch logs to console and falls back to the Empty state.
