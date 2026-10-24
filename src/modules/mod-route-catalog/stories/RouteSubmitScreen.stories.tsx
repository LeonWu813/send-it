import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { setStubPickedPhoto } from '../../../../.storybook/stubs/expo-image-picker';
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { useToast } from '../../../components/ui';
import RouteSubmitScreen from '../screens/RouteSubmitScreen';
import type { RouteSummary } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const session = { user: { id: 'story-user-me' } } as unknown as Session;

const GYM_ID = 'gym-1';
const GYM_NAME = '紅石攀岩館';

function makeRoute(id: string, grade: RouteSummary['grade'], colorTag: RouteSummary['color_tag']): RouteSummary {
  return {
    id,
    gym_id: GYM_ID,
    grade,
    color_tag: colorTag,
    section_label: null,
    photo_url: '',
    status: 'active',
    created_at: new Date(2026, 8, 1).toISOString(),
  };
}

/** Existing routes used to trigger the AC-187 duplicate notice. */
const EXISTING_ROUTES: RouteSummary[] = [
  makeRoute('route-dup-1', 'V4', 'red'),
  makeRoute('route-dup-2', 'V4', 'red'),
  makeRoute('route-1', 'V3', 'blue'),
  makeRoute('route-2', 'V5', 'green'),
];

/** Placeholder route photo (inline SVG, no network). */
const PHOTO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a7f72"/><circle cx="260" cy="200" r="46" fill="#d9503f"/><circle cx="480" cy="330" r="46" fill="#d9503f"/><circle cx="330" cy="470" r="46" fill="#d9503f"/></svg>';
const PHOTO_URI = `data:image/svg+xml;base64,${btoa(PHOTO_SVG)}`;

/** Story steps run against the rendered DOM (web only): click the control carrying this accessibility label. */
type Step = 'pick-photo' | 'submit' | 'confirm';
const STEP_LABEL: Record<Step, string[]> = {
  'pick-photo': ['從相簿選擇', 'Choose from Library'],
  submit: ['新增路線', 'Add Route'],
  confirm: ['確認新增，這是不同的路線', 'Continue to add, this is a different route'],
};

function useSteps(steps: Step[]): void {
  useEffect(() => {
    const timers = steps.map((step, i) =>
      setTimeout(() => {
        const labels = STEP_LABEL[step];
        const el = Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find((n) =>
          labels.includes(n.getAttribute('aria-label') ?? ''),
        );
        el?.click();
      }, 600 + i * 700),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

interface ScreenProps {
  routes?: RouteSummary[];
  grade?: RouteSummary['grade'];
  color?: RouteSummary['color_tag'];
  pending?: boolean;
  /** Pick the placeholder photo through the real picker button. */
  photo?: boolean;
  /** Make the submit RPC fail. */
  failSubmit?: boolean;
  steps?: Step[];
}

function Screen({ routes = [], grade, color, pending = false, photo = false, failSubmit = false, steps = [] }: ScreenProps): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  setStubData('routes', routes);
  if (pending) setStubData('rpc:submit_route', { id: 'new-route', status: 'pending' });
  if (failSubmit) setStubData('rpc:submit_route', { __stubError: 'story failure' });
  setStubPickedPhoto(photo ? PHOTO_URI : null);
  useSteps(steps);
  return (
    <RouteSubmitScreen
      gymId={GYM_ID}
      gymName={GYM_NAME}
      session={session}
      onBack={() => {}}
      onSuccess={() => {}}
      initialGrade={grade}
      initialColorTag={color}
    />
  );
}

const meta: Meta = {
  title: 'Pages/Gyms/Route Submit',
  component: RouteSubmitScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [withPhoneFrame],
};
export default meta;
type Story = StoryObj;

/** Empty form: no pre-fills, no duplicates. Grade (6+6) and colour tiles (6+3) share one 6-column grid, all visible; the photo field hints that a photo is required; Add Route is always enabled in the sticky footer. */
export const Default: Story = { render: () => <Screen /> };

/** V4 / Red pre-filled and a photo chosen (88pt thumbnail + Change Photo). Nothing scrolls. */
export const FilledWithPhoto: Story = {
  name: 'Filled With Photo',
  render: () => <Screen grade="V4" color="red" photo steps={['pick-photo']} />,
};

/** Missing photo: grade and colour are set, Add Route is pressed with no photo, so the photo field turns into an inline error. */
export const MissingPhotoError: Story = {
  name: 'Missing Photo Error',
  render: () => <Screen grade="V4" color="red" steps={['submit']} />,
};

/** Submit failure on a photo + duplicate form (confirms the duplicate sheet, then the RPC fails): error callout at the end, scrolled so it sits just above the footer. */
export const SubmitFailure: Story = {
  name: 'Submit Failure',
  render: () => <Screen routes={EXISTING_ROUTES} grade="V4" color="red" photo failSubmit steps={['pick-photo', 'submit', 'confirm']} />,
};

/** Grade V4 and Red are pre-filled; two matching routes exist, so the AC-187 info notice (bold title + body, not warning-orange) shows. */
export const DuplicateCandidates: Story = {
  name: 'Duplicate Candidates',
  render: () => <Screen routes={EXISTING_ROUTES} grade="V4" color="red" />,
};

/** Shows the toast the screen raises after a pending submit, over the pre-filled form (V3 / Blue). */
function PendingToast(): React.JSX.Element {
  const toast = useToast();
  const { t } = useTranslation('common');
  useEffect(() => {
    toast.show({ message: t('routeCatalog.pendingToast'), durationMs: 600000 });
  }, [toast, t]);
  return <Screen grade="V3" color="blue" pending />;
}

/** Auto-approve OFF: after submit the screen raises a success toast and goes back. The story shows that toast; the pre-selected Blue chip is scrolled into view. */
export const PendingApproval: Story = {
  name: 'Pending Approval',
  render: () => <PendingToast />,
};
