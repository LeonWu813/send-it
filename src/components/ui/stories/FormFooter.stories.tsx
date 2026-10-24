import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { FormFooter, useFooterScroll } from '../FormFooter';

function Screen({ rows }: { rows: number }): React.JSX.Element {
  const { theme } = useTheme();
  const { divider, scrollProps } = useFooterScroll();
  return (
    <View style={{ width: 393, height: 520, backgroundColor: theme.colors.background }}>
      <ScrollView {...scrollProps} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={{ height: 72, borderRadius: 12, backgroundColor: theme.colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}>
            <AppText variant="body">Field {i + 1}</AppText>
          </View>
        ))}
      </ScrollView>
      <FormFooter divider={divider}>
        <Button label="新增路線" onPress={() => {}} />
      </FormFooter>
    </View>
  );
}

const meta: Meta = { title: 'Components/FormFooter', component: FormFooter as never, tags: ['!autodocs'] };
export default meta;

/** Content scrolls under the footer: hairline visible (no shadow). Scroll to the bottom and it fades out. */
export const ScrollsUnder: StoryObj = { render: () => <Screen rows={10} /> };

/** Content fits: no hairline. */
export const ContentFits: StoryObj = { render: () => <Screen rows={3} /> };
