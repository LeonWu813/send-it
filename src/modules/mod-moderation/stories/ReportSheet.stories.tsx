import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { Button, ToastProvider } from '../../../components/ui';
import ReportSheet from '../components/ReportSheet';
import type { ReportCategory } from '../types';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 * `submitResult` picks the outcome of Submit: success (sheet closes + toast), error (inline error,
 * input kept). `none` also succeeds. The submitting state is not reachable (the stub resolves instantly).
 */

interface Args {
  visible: boolean;
  reason: ReportCategory | 'none';
  /** Length of the prefilled note (0 to 280). */
  noteLength: number;
  submitResult: 'none' | 'success' | 'error';
  onDismiss: () => void;
}

const SAMPLE = 'This user keeps posting abusive comments on several sends. ';
const makeNote = (n: number): string => SAMPLE.repeat(Math.ceil(n / SAMPLE.length) + 1).slice(0, n);

function Demo({ visible, reason, noteLength, submitResult, onDismiss }: Args): React.JSX.Element {
  const [open, setOpen] = useState(visible);
  useEffect(() => setOpen(visible), [visible]);
  resetStubData();
  if (submitResult !== 'error') setStubData('auth:session', { user: { id: 'user-me' } });
  return (
    <ToastProvider>
      <div style={{ padding: 16 }}>
        <Button label="Open report sheet" variant="secondary" onPress={() => setOpen(true)} />
      </div>
      <ReportSheet
        targetUserId="user-target"
        visible={open}
        defaultCategory={reason === 'none' ? null : reason}
        defaultNote={makeNote(noteLength)}
        onDismiss={() => {
          setOpen(false);
          onDismiss();
        }}
      />
    </ToastProvider>
  );
}

const meta: Meta<Args> = {
  title: 'Moderation/ReportSheet',
  render: (args) => <Demo {...args} />,
  args: { visible: true, reason: 'none', noteLength: 0, submitResult: 'success', onDismiss: fn() },
  argTypes: {
    visible: { control: 'boolean' },
    reason: { control: 'select', options: ['none', 'inappropriate', 'spam', 'harassment', 'other'] },
    noteLength: { control: { type: 'range', min: 0, max: 280, step: 10 } },
    submitResult: { control: 'select', options: ['none', 'success', 'error'] },
    onDismiss: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<Args>;

/** Pick a reason, type a note, press Submit; change reason / noteLength / submitResult in Controls. */
export const Playground: Story = {};
