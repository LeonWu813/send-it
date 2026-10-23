import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import RouteCard from '../../../components/RouteCard';

// Off-spec design tooling. Fake data only.
// Thumbnails go through getPhotoSignedUrl -> stubbed supabase storage, which returns 'about:blank',
// so "hasPhoto" renders an empty Image (not a real picture). Without a photo: surfaceAlt + image icon.
const PHOTO = 'https://example.invalid/storage/v1/object/public/route-photos/fake.jpg';

const SECTIONS = {
  none: '',
  short: 'A',
  normal: 'Zone A',
  long: 'Overhang Cave, Left Side Of The Main Wall Near The Entrance',
} as const;

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black', 'unknown'] as const;

interface Args {
  variant: 'compact' | 'regular';
  saved: boolean;
  sendStyle: 'none' | 'flash' | 'top';
  betaVideoCount: number;
  hasPhoto: boolean;
  section: keyof typeof SECTIONS;
  grade: string;
  colorTag: (typeof COLORS)[number];
  /** Cross-gym lists (Home): shown after the section in textSecondary; empty hides it. */
  gymName: string;
}

function Demo({ variant, saved, sendStyle, betaVideoCount, hasPhoto, section, grade, colorTag, gymName }: Args): React.JSX.Element {
  const [isSaved, setIsSaved] = useState(saved);
  useEffect(() => setIsSaved(saved), [saved]);
  return (
    <View style={{ width: 375, padding: 16 }}>
      <RouteCard
        variant={variant}
        route={{
          id: 'r1',
          name: `${grade} ${colorTag}`,
          grade,
          section: SECTIONS[section] || null,
          photo_url: hasPhoto ? PHOTO : null,
          gymName: gymName || undefined,
          colorTag,
        }}
        onPress={() => {}}
        betaVideoCount={betaVideoCount}
        hasSend={sendStyle !== 'none'}
        sendStyle={sendStyle === 'none' ? null : sendStyle}
        isSaved={isSaved}
        onBookmarkToggle={() => setIsSaved((v) => !v)}
      />
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Patterns/RouteCard',
  component: Demo,
  args: {
    variant: 'compact',
    saved: false,
    sendStyle: 'none',
    betaVideoCount: 0,
    hasPhoto: false,
    section: 'normal',
    grade: 'V4',
    colorTag: 'red',
    gymName: 'Boulder Lab Taipei',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['compact', 'regular'], description: 'compact (default, 80pt, one meta line) or regular (104pt)' },
    sendStyle: { control: 'inline-radio', options: ['none', 'flash', 'top'], description: 'Flash / top only; attempts show nothing (AC-190)' },
    betaVideoCount: { control: { type: 'number', min: 0, max: 120 }, description: '0 hides the line; the play disc also needs a photo (AC-189)' },
    section: { control: 'inline-radio', options: Object.keys(SECTIONS) },
    grade: { control: 'text', description: 'Printed on the tape badge (24/800)' },
    colorTag: { control: 'select', options: COLORS, description: 'Tape colour of the grade badge' },
  },
};
export default meta;

/** Tap the bookmark (pop + cross-fade), press the card body (colour wash), change the section length / font scale (>= 1.6 hides the thumbnail) to see the layout adapt. */
export const Playground: StoryObj<Args> = {};

const LIST = [
  { id: 'a', section: 'B', colorTag: 'blue', grade: 'V3', send: 'top' as const, beta: 4, saved: true },
  { id: 'b', section: null, colorTag: 'yellow', grade: 'V5', send: 'flash' as const, beta: 0, saved: true },
  { id: 'c', section: 'Overhang Cave', colorTag: 'black', grade: 'V6', send: null, beta: 12, saved: true },
];

function ListDemo({ variant }: { variant: 'compact' | 'regular' }): React.JSX.Element {
  const [savedIds, setSavedIds] = useState(new Set(LIST.map((r) => r.id)));
  return (
    <View style={{ width: 375, padding: 16, rowGap: 12 }}>
      {LIST.map((r) => (
        <RouteCard
          variant={variant}
          key={r.id}
          route={{ id: r.id, name: `${r.grade} ${r.colorTag}`, section: r.section, grade: r.grade, photo_url: null, colorTag: r.colorTag, gymName: 'Boulder Lab Taipei' }}
          onPress={() => {}}
          betaVideoCount={r.beta}
          hasSend={r.send !== null}
          sendStyle={r.send}
          isSaved={savedIds.has(r.id)}
          onBookmarkToggle={() =>
            setSavedIds((prev) => {
              const next = new Set(prev);
              if (next.has(r.id)) next.delete(r.id);
              else next.add(r.id);
              return next;
            })
          }
        />
      ))}
    </View>
  );
}

/** Cards stacked with `cardGap` 12, as in Projecting Routes: press, scroll-press and bookmark each independently. */
export const AllVariants: StoryObj = { render: () => <ListDemo variant="compact" /> };

/** RL-1 compact (the list default): thumb 64 + 2 x 8 = 80pt, pitch 92, grade on the tape badge, ONE meta line (colour・section・gym, beta count at the right). */
export const Compact: StoryObj = { render: () => <ListDemo variant="compact" /> };

/** The previous 104pt layout, kept as `variant="regular"` for opt-in. */
export const Regular: StoryObj = { render: () => <ListDemo variant="regular" /> };
