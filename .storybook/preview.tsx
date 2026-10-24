import type { Preview } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../src/lib/i18n';
import { MotionProvider } from '../src/lib/motion';
import { useTheme } from '../src/lib/theme';
import { HapticLog, installLoggingHaptics } from './HapticLog';
import { ForcedTheme } from './ForcedTheme';

function Canvas({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  useEffect(() => {
    document.body.style.backgroundColor = theme.colors.background;
  }, [theme.colors.background]);
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>;
}

installLoggingHaptics();

const preview: Preview = {
  initialGlobals: { theme: 'light', locale: 'zh-TW', reduceMotion: 'off', motionSpeed: '1' },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'zh-TW', title: '繁體中文 (zh-TW)' },
          { value: 'en', title: 'English (en)' },
        ],
        dynamicTitle: true,
      },
    },
    reduceMotion: {
      description: 'Force Reduce Motion',
      toolbar: {
        title: 'Reduce Motion',
        icon: 'accessibility',
        items: [
          { value: 'off', title: 'Motion: normal' },
          { value: 'on', title: 'Motion: reduced' },
        ],
        dynamicTitle: true,
      },
    },
    motionSpeed: {
      description: 'Animation speed (slow motion)',
      toolbar: {
        title: 'Speed',
        icon: 'time',
        items: [
          { value: '1', title: 'Speed 1x' },
          { value: '3', title: 'Slow 3x' },
          { value: '10', title: 'Slow 10x' },
        ],
        dynamicTitle: true,
      },
    },
  },
  // Docs page per Component/Pattern. Pages and Foundations metas opt out with `tags: ['!autodocs']`.
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // The canvas background is driven by the theme `background` token (see Canvas).
    backgrounds: { disabled: true },
    // Sidebar order: see send-it-design/ux-team/storybook-ia/storybook-ia.md section 2b.
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          'Welcome',
          'Foundations', ['Tokens', 'Icons'],
          'Components',
          'Patterns',
          'Pages', [
            'Home', ['Home', 'Route Detail', 'Log Send', 'Route Search', 'Send History Detail'],
            'Gyms', ['Gym List', 'Gym Detail', 'Route List', 'Route Submit', 'Request Gym'],
            'Profile', ['Profile', 'Edit Profile', 'Profile History', 'Followers', 'Following', 'User Profile', 'Other User Profile'],
            'Settings & Notifications', ['Settings', 'Blocked Accounts', 'Notification Inbox', 'Notification Preferences'],
            'Auth', ['Sign In', 'Sign Up'],
          ],
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const mode = context.globals.theme === 'dark' ? 'dark' : 'light';
      const locale = context.globals.locale === 'en' ? 'en' : 'zh-TW';
      if (i18n.language !== locale) void i18n.changeLanguage(locale);
      const reduceMotion = context.globals.reduceMotion === 'on' ? true : undefined;
      const timeScale = Number(context.globals.motionSpeed) || 1;
      return (
        <SafeAreaProvider style={{ flex: 1 }}>
          <MotionProvider reduceMotion={reduceMotion} timeScale={timeScale}>
            <ForcedTheme mode={mode} key={mode}>
              <Canvas>
                <Story />
                <HapticLog />
              </Canvas>
            </ForcedTheme>
          </MotionProvider>
        </SafeAreaProvider>
      );
    },
  ],
};

export default preview;
