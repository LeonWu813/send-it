import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { useMotion } from '../../../lib/motion';
import { AppText } from '../AppText';
import { BottomSheet, useSheetSelect } from '../BottomSheet';
import type { BottomSheetProps } from '../BottomSheet';
import { Button } from '../Button';
import { ListRow } from '../ListRow';
import { TextField } from '../TextField';

type Args = Omit<BottomSheetProps, 'visible' | 'onClose' | 'children'>;

function Demo(props: Args): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('V4');
  const [note, setNote] = useState('');
  const close = () => setOpen(false);
  const select = useSheetSelect(close);
  const { haptic } = useMotion();
  const v = props.variant ?? 'content';

  return (
    <View style={{ padding: 16 }}>
      <Button label="Open sheet" onPress={() => setOpen(true)} />
      <BottomSheet
        {...props}
        visible={open}
        onClose={close}
        confirmLabel={props.confirmLabel ?? '封鎖'}
        confirmIcon={ICON.block.outline}
        onConfirm={() => {
          haptic('success');
          close();
        }}
        footer={
          v === 'form' ? <Button label="送出" fullWidth onPress={close} /> : v === 'content' ? <Button label="完成" fullWidth onPress={close} /> : undefined
        }
      >
        {v === 'list-single' ? (
          Array.from({ length: props.optionCount ?? 4 }, (_, i) => `V${i + 2}`).map((g, i, all) => (
            <ListRow
              key={g}
              on="elevated"
              inset="grouped"
              variant="selectable"
              title={g}
              selected={choice === g}
              divider={i < all.length - 1}
              onPress={() => select(() => setChoice(g))}
            />
          ))
        ) : v === 'form' ? (
          <TextField variant="multiline" label="補充說明" value={note} onChangeText={setNote} placeholder="例如：在留言裡重複貼廣告" maxLength={280} showCount />
        ) : v === 'content' ? (
          <AppText variant="body" color="textSecondary">
            Sheet content. Drag the grabber or the title row; the backdrop fades with the panel.
          </AppText>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'UI/BottomSheet',
  component: Demo,
  args: {
    title: '封鎖小明？',
    description: '你們將看不到彼此的影片和紀錄。',
    variant: 'confirm',
    presentation: undefined,
    optionCount: 4,
    loading: false,
    error: undefined,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['content', 'list-single', 'form', 'confirm'] },
    presentation: { control: 'inline-radio', options: [undefined, 'floating', 'attached'], description: 'Default: form = attached, others floating (auto-attached at font scale >= 1.6, content > 60% height, list > 6)' },
    optionCount: { control: { type: 'number', min: 2, max: 12 }, description: 'list-single: more than 6 options switches to attached' },
    error: { control: 'text', description: 'Shows an InlineError block above the actions; the sheet stays open' },
  },
};
export default meta;

/** Switch `variant` / `presentation` to see each layout (confirm has no close X). Drag works under Reduce Motion; `loading` disables dismiss and damps the drag to 10%. */
export const Playground: StoryObj<Args> = {};
