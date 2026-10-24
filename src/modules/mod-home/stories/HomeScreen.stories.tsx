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
    // Five followed climbers: the Following strip shows all five (4 tiles + a peek of the 5th).
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
      onViewAllFollowing={() => {}}
      onFindClimbers={() => {}}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/**
 * Order (AC-111 restored, home-v2): banner, Saved Gyms, Projecting (chips: 2 grades), Following.
 * Following header at y770, 108pt avatar strip (64 avatar + 2-line caption), 「查看全部」 on the keyline.
 */
export const Populated: Story = { args: { state: 'populated' } };

/** New-user state: flat centred banner placeholder; all three sections use the inline sentence + ghost sm action; no chips, no 「查看全部」. */
export const Empty: Story = { args: { state: 'empty' } };

/** First load (queries never resolve): the one full-page PageLoading spinner, no section headings. Appears after the 300ms delay. */
export const Loading: Story = { args: { state: 'loading' } };

/** E4 page error. Appears 10s after the Loading story starts (queries never resolve); Retry reloads (the requests keep running; a late success swaps in the content). */
export const Error: Story = { args: { state: 'loading' } };

// A failed fetch of a single section logs to console and falls back to that section's empty state.
