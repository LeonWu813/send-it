import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import i18n from '../../../lib/i18n';
import ReportSheet from '../components/ReportSheet';
import type { ReportCategory } from '../types';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 *
 * Success / error use the real flow through the stub: with a seeded auth session the insert
 * succeeds (confirmation state); with no session reportUser throws and the error text shows.
 * The submitting spinner is not reachable (the stub resolves instantly).
 * Play functions drive the web DOM directly (the Modal renders into a portal).
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(get: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = get();
    if (v) return v;
    await sleep(50);
  }
  throw new Error('element not found');
}

const tr = (key: string): string => i18n.t(key, { ns: 'common' });
const byLabel = (label: string): HTMLElement | null =>
  document.querySelector(`[aria-label="${label}"]`);

async function pickReason(cat: ReportCategory): Promise<void> {
  const chip = await waitFor(() => byLabel(tr(`moderation.report.categories.${cat}`)));
  await sleep(150); // let Modal onShow reset run first
  chip.click();
}

async function submit(): Promise<void> {
  const btn = await waitFor(() => byLabel(tr('moderation.report.submit')));
  await sleep(100);
  btn.click();
}

async function typeNote(value: string): Promise<void> {
  const el = await waitFor(() => document.querySelector<HTMLTextAreaElement>('textarea'));
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const withSession = (signedIn: boolean) => (Story: () => React.JSX.Element): React.JSX.Element => {
  resetStubData();
  if (signedIn) setStubData('auth:session', { user: { id: 'user-me' } });
  return <Story />;
};

const meta: Meta<typeof ReportSheet> = {
  title: 'Moderation/ReportSheet',
  component: ReportSheet,
  args: {
    targetUserId: 'user-target',
    visible: true,
    onDismiss: fn(),
  },
  decorators: [withSession(true)],
};
export default meta;

type Story = StoryObj<typeof ReportSheet>;

/** Open form, nothing selected (submit disabled). Pick any reason interactively. */
export const Open: Story = {};

export const ReasonInappropriate: Story = { play: () => pickReason('inappropriate') };
export const ReasonSpam: Story = { play: () => pickReason('spam') };
export const ReasonHarassment: Story = { play: () => pickReason('harassment') };
export const ReasonOther: Story = { play: () => pickReason('other') };

/** Maximum-length (280 char) free-text note. */
export const LongNote: Story = {
  play: async () => {
    await pickReason('harassment');
    await typeNote(
      '這位使用者在多則留言中重複騷擾我與其他攀岩夥伴，並且持續傳送不當訊息。This user keeps posting abusive comments on several sends and messaging people repeatedly after being asked to stop. '.repeat(
        3,
      ),
    );
  },
};

/** Report submitted -> confirmation state (AC-081). */
export const Success: Story = {
  play: async () => {
    await pickReason('spam');
    await submit();
  },
};

/** Submit fails (no session -> reportUser throws) -> inline error text. */
export const SubmitError: Story = {
  decorators: [withSession(false)],
  play: async () => {
    await pickReason('spam');
    await submit();
  },
};

/** Sheet closed (visible=false) renders nothing. */
export const Closed: Story = { args: { visible: false } };
