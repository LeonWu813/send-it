/**
 * Tests for EditProfileScreen (MOD-001): header Save icon button, dirty tracking, back = cancel with a
 * discard confirmation, i18n error copy (edit-profile-header-save r3).
 */

jest.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn() } }));

const mockHeader: { current: { onBack?: () => void; trailing?: React.ReactElement } } = { current: {} };
jest.mock('@/lib/AppHeaderContext', () => ({
  useAppHeader: (config: { onBack?: () => void; trailing?: React.ReactElement }) => {
    mockHeader.current = config;
  },
  useHideTabBar: () => undefined,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
}));

const mockUpsert = jest.fn();
const mockUpload = jest.fn();
jest.mock('../auth-service', () => ({
  upsertProfile: (...a: unknown[]) => mockUpsert(...a),
  uploadAvatar: (...a: unknown[]) => mockUpload(...a),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg' }] }),
}));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import EditProfileScreen from '../screens/EditProfileScreen';
import { ThemeProvider } from '../../../lib/theme';
import type { UserProfile } from '../types';

const PROFILE = {
  id: 'user-1',
  display_name: 'Test User',
  avatar_url: null,
  bio: 'Hello',
  privacy_setting: 'public',
  created_at: '2026-01-01T00:00:00Z',
} as unknown as UserProfile;

function setup(): { onSaved: jest.Mock; onCancel: jest.Mock; api: ReturnType<typeof render> } {
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  const api = render(
    <ThemeProvider>
      <EditProfileScreen userId="user-1" profile={PROFILE} onSaved={onSaved} onCancel={onCancel} />
    </ThemeProvider>,
  );
  return { onSaved, onCancel, api };
}

/** The header's trailing Save button (re-read after every render: the config is replaced each render). */
function saveProps(): { disabled?: boolean; loading?: boolean; accessibilityLabel: string; onPress: () => void } {
  return mockHeader.current.trailing?.props as ReturnType<typeof saveProps>;
}

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('puts Save in the header as a disabled-until-dirty icon button and has no bottom actions row', () => {
    const { api } = setup();
    expect(saveProps().accessibilityLabel).toBe('profile.save');
    expect(saveProps().disabled).toBe(true);
    expect(api.queryByLabelText('profile.cancel')).toBeNull();
  });

  it('a trailing space on the display name is not a change', () => {
    const { api } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), 'Test User  ');
    expect(saveProps().disabled).toBe(true);
    fireEvent.changeText(api.getByDisplayValue('Test User  '), 'Renamed');
    expect(saveProps().disabled).toBe(false);
  });

  it('saves trimmed values and reports the updated profile', async () => {
    mockUpsert.mockResolvedValue({ ...PROFILE, display_name: 'Renamed' });
    const { api, onSaved } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), ' Renamed ');
    await act(async () => {
      saveProps().onPress();
    });
    expect(mockUpsert).toHaveBeenCalledWith('user-1', { display_name: 'Renamed', bio: 'Hello', avatar_url: null });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows the fixed i18n copy, never err.message, when saving fails', async () => {
    mockUpsert.mockRejectedValue(new Error('PGRST301 raw'));
    const { api, onSaved } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), 'Renamed');
    await act(async () => {
      saveProps().onPress();
    });
    expect(api.getByText('profile.errors.saveFailed')).toBeTruthy();
    expect(api.queryByText(/PGRST301/)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(saveProps().loading).toBe(false);
  });

  it('keeps Save pressable on an empty name and shows the required error', async () => {
    const { api } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), '   ');
    expect(saveProps().disabled).toBe(false);
    await act(async () => {
      saveProps().onPress();
    });
    expect(api.getByText('auth.errors.displayNameRequired')).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('back with no changes leaves immediately', () => {
    const { onCancel } = setup();
    act(() => mockHeader.current.onBack?.());
    expect(onCancel).toHaveBeenCalled();
  });

  it('back with changes asks first and Discard leaves', () => {
    const { api, onCancel } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), 'Renamed');
    act(() => mockHeader.current.onBack?.());
    expect(onCancel).not.toHaveBeenCalled();
    expect(api.getByText('profile.discardConfirmTitle')).toBeTruthy();
    expect(api.getByText('profile.keepEditing')).toBeTruthy();
    fireEvent.press(api.getByText('profile.discard'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('Keep editing closes the sheet without leaving', () => {
    const { api, onCancel } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), 'Renamed');
    act(() => mockHeader.current.onBack?.());
    fireEvent.press(api.getByText('profile.keepEditing'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('back while the avatar is uploading asks first and Save is disabled', async () => {
    mockUpload.mockReturnValue(new Promise(() => undefined));
    const { api, onCancel } = setup();
    await act(async () => {
      fireEvent.press(api.getByLabelText('profile.changeAvatar'));
    });
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(saveProps().disabled).toBe(true);
    act(() => mockHeader.current.onBack?.());
    expect(onCancel).not.toHaveBeenCalled();
    expect(api.getByText('profile.discardConfirmTitle')).toBeTruthy();
  });

  it('back is a no-op while saving', async () => {
    mockUpsert.mockReturnValue(new Promise(() => undefined));
    const { api, onCancel } = setup();
    fireEvent.changeText(api.getByDisplayValue('Test User'), 'Renamed');
    await act(async () => {
      saveProps().onPress();
    });
    expect(saveProps().loading).toBe(true);
    act(() => mockHeader.current.onBack?.());
    expect(onCancel).not.toHaveBeenCalled();
    expect(api.queryByText('profile.discardConfirmTitle')).toBeNull();
  });
});
