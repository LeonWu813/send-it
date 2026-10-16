import type { Preview } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '../src/lib/i18n';
import { useTheme } from '../src/lib/theme';
import { ForcedTheme } from './ForcedTheme';

function Canvas({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  useEffect(() => {
    document.body.style.backgroundColor = theme.colors.background;
  }, [theme.colors.background]);
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>;
}

const preview: Preview = {
  initialGlobals: { theme: 'light', locale: 'zh-TW' },
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
  },
  parameters: {
    layout: 'fullscreen',
    // The canvas background is driven by the theme `background` token (see Canvas).
    backgrounds: { disabled: true },
  },
  decorators: [
    (Story, context) => {
      const mode = context.globals.theme === 'dark' ? 'dark' : 'light';
      const locale = context.globals.locale === 'en' ? 'en' : 'zh-TW';
      if (i18n.language !== locale) void i18n.changeLanguage(locale);
      return (
        <SafeAreaProvider style={{ flex: 1 }}>
          <ForcedTheme mode={mode} key={mode}>
            <Canvas>
              <Story />
            </Canvas>
          </ForcedTheme>
        </SafeAreaProvider>
      );
    },
  ],
};

export default preview;
