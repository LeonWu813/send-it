/**
 * ModerationActions: hook order stays stable when the target changes to the own profile
 * (regression for the early `return null` before hooks), and the unblock control is shown.
 */

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../moderation-service', () => ({
  isBlocked: jest.fn(async (id: string) => id === 'blocked-user'),
  blockUser: jest.fn(async () => undefined),
  unblockUser: jest.fn(async () => undefined),
  reportUser: jest.fn(async () => undefined),
}));

import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import '../../../lib/i18n';
import { ToastProvider } from '../../../components/ui';
import { ThemeProvider } from '../../../lib/theme';
import ModerationActions from '../components/ModerationActions';

function Wrap({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

describe('ModerationActions', () => {
  it('does not throw when switching between another user and the own profile', () => {
    const { rerender, toJSON } = render(
      <ModerationActions targetUserId="other" currentUserId="me" />,
      { wrapper: Wrap },
    );
    expect(toJSON()).not.toBeNull();
    rerender(<ModerationActions targetUserId="me" currentUserId="me" />);
    rerender(<ModerationActions targetUserId="other" currentUserId="me" />);
  });

  it('shows Unblock for a blocked user', async () => {
    render(<ModerationActions targetUserId="blocked-user" currentUserId="me" />, { wrapper: Wrap });
    await waitFor(() => expect(screen.getByLabelText(/unblock|解除封鎖/i)).toBeTruthy());
  });
});
