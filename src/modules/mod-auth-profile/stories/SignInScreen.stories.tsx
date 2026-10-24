/**
 * Pages/Auth/Sign In: the real SignInScreen outside AppShell (no header, no TabBar).
 * Error is produced by pressing the primary button with the form empty (the screen's own validation).
 * No Loading story: the loading state only exists transiently after a real submit.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import SignInScreen from '../screens/SignInScreen';

// Off-spec design tooling. No network; the supabase stub is inert.
function WithStubs({ children }: { children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  return <>{children}</>;
}

const meta: Meta = {
  title: 'Pages/Auth/Sign In',
  component: SignInScreen as never, // real component
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { chrome: false } },
  decorators: [
    (Story) => (
      <WithStubs>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  render: () => <SignInScreen onNavigateSignUp={() => {}} />,
};
export default meta;

type Story = StoryObj;

/** Empty form, ready for input. */
export const Default: Story = {};

/** Validation error: the primary button was pressed with the required fields empty. */
export const Error: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 300));
    const buttons = Array.from(canvasElement.querySelectorAll<HTMLElement>('[role="button"]'));
    const target = buttons.find((b) => /^(登入|Sign In)$/.test(b.textContent ?? ''));
    target?.click();
  },
};
