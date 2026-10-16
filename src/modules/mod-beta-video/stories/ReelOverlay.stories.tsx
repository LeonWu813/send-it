import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { IconButton } from '../../../components/ui/IconButton';
import { ICON } from '../../../lib/icons';
import { LIGHT_PALETTE, useTheme } from '../../../lib/theme';
import { ACTION_SIZE, ReelAction } from '../components/ReelAction';

// A static preview of the Reel viewer's overlay (BetaVideoReelViewer imports expo-video, which
// Storybook cannot load). It uses the same pieces and the same safe-area layout rules as the
// viewer, over a fake "video" so the media tokens can be checked against dark and bright footage.

interface DemoArgs {
  /** Fake footage: black, or bright (a white frame, the worst case for onMedia). */
  footage: 'dark' | 'bright';
  /** Simulated safe-area insets (iPhone 15 Pro: top 59, bottom 34). */
  insetTop: number;
  insetBottom: number;
  index: number;
  total: number;
  liked: boolean;
  likeCount: number;
  showReport: boolean;
  reported: boolean;
}

const WIDTH = 390;
const HEIGHT = 780;
const MARGIN = 16;

function Demo(args: DemoArgs): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const [liked, setLiked] = useState(args.liked);
  const [count, setCount] = useState(args.likeCount);
  React.useEffect(() => { setLiked(args.liked); setCount(args.likeCount); }, [args.liked, args.likeCount]);

  return (
    <View
      style={{
        width: WIDTH,
        height: HEIGHT,
        overflow: 'hidden',
        backgroundColor: args.footage === 'dark' ? c.mediaBackground : LIGHT_PALETTE.surface,
      }}
    >
      {/* Close: IconButton media (mediaScrim disc, onMedia glyph) */}
      <View style={{ position: 'absolute', top: args.insetTop + theme.spacing.smd, left: MARGIN }}>
        <IconButton
          variant="media"
          name={ICON.back.outline}
          accessibilityLabel="關閉"
          onPress={() => console.log('close')}
        />
      </View>

      {args.total > 1 ? (
        <View
          style={{
            position: 'absolute',
            top: args.insetTop + theme.spacing.smd,
            right: MARGIN,
            minHeight: theme.layout.minTouchTarget,
            justifyContent: 'center',
            backgroundColor: c.mediaScrim,
            borderRadius: theme.borderRadius.full,
            paddingHorizontal: theme.spacing.smd,
          }}
        >
          <AppText variant="footnote" weight="600" numeric color="onMedia">
            {args.index} / {args.total}
          </AppText>
        </View>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: MARGIN,
          right: MARGIN,
          bottom: Math.max(args.insetBottom, theme.spacing.md) + theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            flex: 1,
            marginRight: theme.spacing.sm,
            gap: theme.spacing.xs,
            backgroundColor: c.mediaScrim,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: theme.layout.minTouchTarget }}>
            <Avatar size="sm" name="小明" decorative />
            <AppText variant="footnote" weight="600" color="onMedia" numberOfLines={1} style={{ flex: 1 }}>
              小明
            </AppText>
          </View>
          <AppText variant="footnote" color="onMedia" numberOfLines={1}>
            V3 測試路線 · 測試岩館
          </AppText>
        </View>

        <View style={{ width: ACTION_SIZE, alignItems: 'center', gap: theme.spacing.md }}>
          <ReelAction
            testID="reel-like-button"
            accessibilityLabel={`按讚，${count} 個讚`}
            onPress={() => {
              setLiked((v) => !v);
              setCount((n) => (liked ? n - 1 : n + 1));
            }}
            nameOff={ICON.like.outline}
            nameOn={ICON.like.filled}
            selected={liked}
            likeMotion
            caption={String(count)}
          />
          {args.showReport ? (
            <ReelAction
              testID="reel-report-button"
              accessibilityLabel={args.reported ? '已檢舉' : '檢舉'}
              onPress={() => console.log('report')}
              nameOff={ICON.report.outline}
              nameOn={ICON.report.filled}
              selected={args.reported}
              disabled={args.reported}
              caption={args.reported ? '已檢舉' : '檢舉'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const meta: Meta<DemoArgs> = {
  title: 'Beta Video/Reel overlay',
  component: Demo,
  args: {
    footage: 'bright',
    insetTop: 59,
    insetBottom: 34,
    index: 2,
    total: 5,
    liked: false,
    likeCount: 12,
    showReport: true,
    reported: false,
  },
  argTypes: {
    footage: { control: 'inline-radio', options: ['dark', 'bright'] },
    insetTop: { control: { type: 'range', min: 20, max: 62, step: 1 } },
    insetBottom: { control: { type: 'range', min: 0, max: 34, step: 1 } },
    index: { control: { type: 'number', min: 1, max: 5 } },
    total: { control: { type: 'number', min: 1, max: 5 } },
    liked: { control: 'boolean' },
    likeCount: { control: { type: 'number', min: 0, max: 999 } },
    showReport: { control: 'boolean' },
    reported: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<DemoArgs>;

/** Tap the heart (peak scale, particles; Reduce Motion cross-fades only), switch Footage to bright, and toggle the theme: the overlay must look identical in light and dark. */
export const Playground: Story = {};
