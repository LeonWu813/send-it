import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import RouteCard from '../../../components/RouteCard';

// Off-spec design tooling. Fake data only.
// Thumbnails go through getPhotoSignedUrl -> stubbed supabase storage, which returns 'about:blank',
// so "hasPhoto" renders an empty Image (not a real picture). Without a photo the thumbnail is the
// route's tape colour as a plain block (no icon, no pattern).
const PHOTO = 'https://example.invalid/storage/v1/object/public/route-photos/fake.jpg';

const NAMES = {
  short: 'V4 Red',
  normal: 'V4 Red (Zone A)',
  long: 'V10 Purple (Overhang Cave, Left Side Of The Main Wall Near The Entrance)',
} as const;

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black', 'unknown'] as const;

interface Args {
  saved: boolean;
  sendStyle: 'none' | 'flash' | 'top';
  betaVideoCount: number;
  hasPhoto: boolean;
  nameLength: keyof typeof NAMES;
  colorTag: (typeof COLORS)[number];
  /** Spoken by VoiceOver only (cross-gym lists); never drawn. */
  gymName: string;
}

function Demo({ saved, sendStyle, betaVideoCount, hasPhoto, nameLength, colorTag, gymName }: Args): React.JSX.Element {
  const [isSaved, setIsSaved] = useState(saved);
  useEffect(() => setIsSaved(saved), [saved]);
  return (
    <View style={{ width: 375, padding: 16 }}>
      <RouteCard
        route={{
          id: 'r1',
          name: NAMES[nameLength],
          grade: 'V4',
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
  title: 'Home/RouteCard',
  component: Demo,
  args: {
    saved: false,
    sendStyle: 'none',
    betaVideoCount: 0,
    hasPhoto: false,
    nameLength: 'normal',
    colorTag: 'red',
    gymName: 'Boulder Lab Taipei',
  },
  argTypes: {
    sendStyle: { control: 'inline-radio', options: ['none', 'flash', 'top'], description: 'Flash / top only; attempts show nothing (AC-190)' },
    betaVideoCount: { control: { type: 'number', min: 0, max: 120 }, description: '0 hides the line and the play disc (AC-189)' },
    nameLength: { control: 'inline-radio', options: Object.keys(NAMES) },
    colorTag: { control: 'select', options: COLORS, description: 'Tape colour of the no-photo thumbnail' },
  },
};
export default meta;

/** Tap the bookmark (pop + cross-fade), press the card body (colour wash), raise font scale / change name length to see the layout adapt. */
export const Playground: StoryObj<Args> = {};

const LIST = [
  { id: 'a', name: 'V3 Blue (Zone B)', colorTag: 'blue', grade: 'V3', send: 'top' as const, beta: 4, saved: true },
  { id: 'b', name: 'V5 Yellow', colorTag: 'yellow', grade: 'V5', send: 'flash' as const, beta: 0, saved: true },
  { id: 'c', name: 'V6 Black (Overhang Cave)', colorTag: 'black', grade: 'V6', send: null, beta: 12, saved: true },
];

function ListDemo(): React.JSX.Element {
  const [savedIds, setSavedIds] = useState(new Set(LIST.map((r) => r.id)));
  return (
    <View style={{ width: 375, padding: 16, rowGap: 12 }}>
      {LIST.map((r) => (
        <RouteCard
          key={r.id}
          route={{ id: r.id, name: r.name, grade: r.grade, photo_url: null, colorTag: r.colorTag, gymName: 'Boulder Lab Taipei' }}
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
export const List: StoryObj = { render: () => <ListDemo /> };
