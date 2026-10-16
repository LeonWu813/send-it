import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { AppText } from './AppText';

export interface ProgressBarProps {
  /** 0-100. Determinate only: use <Spinner> when progress is unknown. */
  value: number;
  /** default: primaryContainer track + primary fill. media: mediaTrack + onMedia fill (on photos / video). */
  tone?: 'default' | 'media';
  /** The fill turns `error` and stays where it stopped. */
  failed?: boolean;
  /** "62%" above the bar, right-aligned (caption1 numeric textSecondary). */
  showPercent?: boolean;
  /** Required: describes what is progressing ("Uploading"). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 4pt pill track + fill. The fill never animates `width`: a full-width fill is translated inside the
 * clipped track (transform only, native driver). Updates tween with `linear` for at most `short`;
 * Reduce Motion: no tween, the value just updates.
 */
export function ProgressBar({
  value,
  tone = 'default',
  failed = false,
  showPercent = false,
  accessibilityLabel,
  style,
}: ProgressBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, reduceMotion } = useMotion();
  const c = theme.colors;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const progress = useRef(new Animated.Value(pct / 100)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(pct / 100);
      return;
    }
    Animated.timing(progress, {
      toValue: pct / 100,
      duration: duration.short,
      easing: bezierFor('linear'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [pct, reduceMotion, progress, duration.short]);

  const track = tone === 'media' ? c.mediaTrack : c.primaryContainer;
  const fill = failed ? c.error : tone === 'media' ? c.onMedia : c.primary;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={style}
    >
      {showPercent ? (
        <AppText variant="caption1" numeric color="textSecondary" align="right" style={{ marginBottom: theme.spacing.xs }}>
          {`${pct}%`}
        </AppText>
      ) : null}
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: theme.componentSize.progressBarHeight,
          borderRadius: theme.borderRadius.full,
          backgroundColor: track,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            width,
            height: '100%',
            borderRadius: theme.borderRadius.full,
            backgroundColor: fill,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
          }}
        />
      </View>
    </View>
  );
}

export interface SpinnerProps {
  /** Button label colour / textSecondary (search bar, small region) / onMedia (Reel buffering). */
  color?: PaletteKey;
  size?: 'small' | 'large';
  accessibilityLabel?: string;
}

/** System ActivityIndicator with palette colours. Use for indeterminate waits; pull-to-refresh uses RefreshControl. */
export function Spinner({ color = 'textSecondary', size = 'small', accessibilityLabel }: SpinnerProps): React.JSX.Element {
  const { theme } = useTheme();
  return <ActivityIndicator size={size} color={theme.colors[color]} accessibilityLabel={accessibilityLabel} />;
}
