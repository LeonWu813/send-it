import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import i18n from '../../../lib/i18n';
import ModerationActions from '../components/ModerationActions';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 * Block status comes from the stubbed `blocks` table; block/unblock succeed when an auth
 * session is seeded and fail ("Not authenticated") when it is not.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const tr = (key: string): string => i18n.t(key, { ns: 'common' });

async function clickByLabel(key: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const el = document.querySelector<HTMLElement>(`[aria-label="${tr(key)}"]`);
    if (el) {
      await sleep(100);
      el.click();
      return;
    }
    await sleep(50);
  }
  throw new Error('button not found');
}

interface Seed {
  signedIn?: boolean;
  blocked?: boolean;
}
const seed =
  ({ signedIn = true, blocked = false }: Seed) =>
  (Story: () => React.JSX.Element): React.JSX.Element => {
    resetStubData();
    if (signedIn) setStubData('auth:session', { user: { id: 'user-me' } });
    if (blocked) {
      setStubData('blocks', [{ blocker_user_id: 'user-me', blocked_user_id: 'user-target' }]);
    }
    return <Story />;
  };

const meta: Meta<typeof ModerationActions> = {
  title: 'Moderation/ModerationActions',
  component: ModerationActions,
  args: {
    targetUserId: 'user-target',
    currentUserId: 'user-me',
    onBlock: fn(),
    onUnblock: fn(),
  },
  decorators: [
    seed({}),
    (Story) => (
      <div style={{ width: 360, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ModerationActions>;

/** Another user's profile, not blocked: Report + Block. */
export const OtherUser: Story = {};

/** Already blocked: Report + Unblock. */
export const AlreadyBlocked: Story = { decorators: [seed({ blocked: true })] };

/** Own profile: component renders nothing. */
export const OwnProfile: Story = { args: { targetUserId: 'user-me' } };

/** After tapping Block: blocked feedback message. */
export const BlockedFeedback: Story = {
  play: () => clickByLabel('moderation.blockUser'),
};

/** After tapping Unblock: unblocked feedback message. */
export const UnblockedFeedback: Story = {
  decorators: [seed({ blocked: true })],
  play: () => clickByLabel('moderation.unblockUser'),
};

/** Block fails (no session): inline error text. */
export const BlockError: Story = {
  decorators: [seed({ signedIn: false })],
  play: () => clickByLabel('moderation.blockUser'),
};

/** Tapping Report User opens the ReportSheet modal. */
export const ReportSheetOpen: Story = {
  play: () => clickByLabel('moderation.reportUser'),
};
