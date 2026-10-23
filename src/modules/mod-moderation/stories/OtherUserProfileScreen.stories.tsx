import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { Spinner, ToastProvider } from '../../../components/ui';
import OtherUserProfileScreen from '../screens/OtherUserProfileScreen';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 * useNavigation / useRoute: not used — this app has no NavigationContainer ancestor.
 */

// ── Shared fixtures ────────────────────────────────────────────────────────────

const SESSION = { user: { id: 'user-me' } } as unknown as Session;

const PROFILE = {
  id: 'user-target',
  display_name: '林偉明',
  avatar_url: null,
  bio: '台北抱石愛好者 · V5 路線中',
  privacy_setting: 'public',
};

const HISTORY = [
  {
    ascent_id: 'a1',
    route_id: 'r1',
    gym_id: 'g1',
    gym_name: '紅石攀岩館',
    grade: 'V5',
    color_tag: 'red',
    section_label: '蜘蛛網區',
    photo_url: null,
    style: 'flash',
    attempts: 1,
    note: null,
    logged_at: '2026-10-20T10:30:00Z',
    is_private: false,
  },
  {
    ascent_id: 'a2',
    route_id: 'r2',
    gym_id: 'g1',
    gym_name: '紅石攀岩館',
    grade: 'V4',
    color_tag: 'blue',
    section_label: null,
    photo_url: null,
    style: 'top',
    attempts: 3,
    note: null,
    logged_at: '2026-10-18T14:00:00Z',
    is_private: false,
  },
  {
    ascent_id: 'a3',
    route_id: 'r3',
    gym_id: 'g2',
    gym_name: '岩究所攀岩館',
    grade: 'V3',
    color_tag: 'green',
    section_label: null,
    photo_url: null,
    style: 'top',
    attempts: 2,
    note: null,
    logged_at: '2026-10-15T09:00:00Z',
    is_private: false,
  },
];

// ── State control ──────────────────────────────────────────────────────────────

type ProfileState =
  | 'loading'
  | 'public-profile'
  | 'viewer-has-blocked'
  | 'blocked-by-target';

interface Args {
  state: ProfileState;
  onBack: () => void;
}

// ── Demo ───────────────────────────────────────────────────────────────────────

function Demo({ state, onBack }: Args): React.JSX.Element {
  resetStubData();

  if (state === 'loading') {
    // Static: the stub resolves sub-frame so we render the spinner directly.
    return (
      <ToastProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Spinner size="large" />
        </View>
      </ToastProvider>
    );
  }

  setStubData('auth:session', { user: { id: 'user-me' } });
  setStubData('users', [PROFILE]);

  if (state === 'public-profile') {
    setStubData('rpc:get_profile_history', HISTORY);
  } else if (state === 'viewer-has-blocked') {
    setStubData('blocks', [{ blocker_user_id: 'user-me', blocked_user_id: 'user-target' }]);
    setStubData('rpc:get_profile_history', HISTORY);
  } else if (state === 'blocked-by-target') {
    // isBlocked() is true either direction; history left empty (server privacy gate).
    setStubData('blocks', [{ blocker_user_id: 'user-target', blocked_user_id: 'user-me' }]);
  }

  return (
    <ToastProvider>
      <OtherUserProfileScreen
        key={state}
        userId="user-target"
        session={SESSION}
        onBack={onBack}
      />
    </ToastProvider>
  );
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta<Args> = {
  title: 'Moderation/OtherUserProfileScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  render: (args) => <Demo {...args} />,
  args: {
    state: 'public-profile',
    onBack: fn(),
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['loading', 'public-profile', 'viewer-has-blocked', 'blocked-by-target'],
      description:
        'loading — centred spinner (in-flight fetch); ' +
        'public-profile — full name/avatar/bio + send history + block/report buttons; ' +
        'viewer-has-blocked — ModerationActions shows the unblock notice row; ' +
        'blocked-by-target — isBlocked() is true in either direction so same unblock row, ' +
        'but history is empty because the server privacy gate returns no rows.',
    },
    onBack: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<Args>;

/**
 * Switch `state` in Controls to walk through all four profile states.
 * Try: public-profile (full history + block/report buttons), viewer-has-blocked
 * (unblock notice row), blocked-by-target (same unblock row, empty history),
 * loading (centred spinner).
 */
export const Playground: Story = {};

/** In-flight fetch — centred loading spinner. */
export const Loading: Story = { args: { state: 'loading' } };

/** Public profile — avatar, display name, bio, send history, Block + Report buttons. */
export const PublicProfile: Story = { args: { state: 'public-profile' } };

/** Viewer has blocked the target — unblock notice row, history still visible. */
export const ViewerHasBlocked: Story = { args: { state: 'viewer-has-blocked' } };

/** Blocked by target — same unblock row (isBlocked checks both directions), history empty. */
export const BlockedByTarget: Story = { args: { state: 'blocked-by-target' } };
