/**
 * OtherUserProfileScreen — wires its back handler + user name into the AppShell header.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';

import {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
} from '../../mod-home/components/AppHeaderContext';
import { ThemeProvider } from '../../../lib/theme';
import OtherUserProfileScreen from '../screens/OtherUserProfileScreen';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'u2', display_name: 'Alex', avatar_url: null, bio: null, privacy_setting: 'public' },
              error: null,
            }),
        }),
      }),
    }),
  },
}));
jest.mock('../../mod-profile-history/history-service', () => ({
  fetchProfileHistory: () => Promise.resolve([]),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../components/ModerationActions', () => 'ModerationActions');

describe('OtherUserProfileScreen header', () => {
  it('registers onBack and the user name with the AppShell header', async () => {
    const store = new AppHeaderStore(0, 0);
    const onBack = jest.fn();
    render(
      <ThemeProvider>
      <AppHeaderProvider value={store}>
        <AppHeaderTabScope tab="profile">
          <OtherUserProfileScreen userId="u2" session={{ user: { id: 'u1' } } as Session} onBack={onBack} />
        </AppHeaderTabScope>
      </AppHeaderProvider>
      </ThemeProvider>,
    );
    expect(store.top('profile')?.config.onBack).toBe(onBack);
    await waitFor(() => expect(store.top('profile')?.config.title).toBe('Alex'));
    store.top('profile')?.config.onBack?.();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
