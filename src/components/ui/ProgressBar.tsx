import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Image, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { ICON } from '../../lib/icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

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
 * 6pt pill track + fill. The fill never animates `width`: a full-width fill is translated inside the
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
          borderRadius: theme.radius.full,
          backgroundColor: track,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            width,
            height: '100%',
            borderRadius: theme.radius.full,
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

export interface UploadProgressCardProps {
  /** Local first-frame thumbnail returned by the picker (3:4). Omitted: a `surfaceAlt` block. */
  thumbnailUri?: string;
  /** "Uploading..." / "Upload failed". */
  title: string;
  /** Route name (footnote, textSecondary). */
  routeName: string;
  /** 0-100. */
  percent: number;
  failed?: boolean;
  /** Caption under the bar while uploading ("Please stay on this screen until it finishes."). */
  caption?: string;
  /** Caption while failed ("Upload was interrupted. Your video is still here."). */
  errorCaption?: string;
  retryLabel?: string;
  cancelLabel?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  progressLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Upload modal body (v2.2, 27.2): `elevated` Card (radius 20, padding 16, max 360), 60x80 thumbnail
 * (`media` 12) of the chosen video, right column title / route name + percent / 6pt ProgressBar /
 * caption. Failure: title changes, the fill turns `error` where it stopped, the caption becomes an
 * alert line and `sm` Retry (primary) + Cancel (secondary) appear below.
 */
export function UploadProgressCard({
  thumbnailUri,
  title,
  routeName,
  percent,
  failed = false,
  caption,
  errorCaption,
  retryLabel,
  cancelLabel,
  onRetry,
  onCancel,
  progressLabel,
  style,
}: UploadProgressCardProps): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = theme.componentSize.uploadThumb;
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <Card variant="elevated" style={[{ width: '100%', maxWidth: 360 }, style]}>
      <View style={{ flexDirection: 'row' }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width, height, borderRadius: theme.radius.media, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c.surfaceAlt }}
        >
          {thumbnailUri ? <Image source={{ uri: thumbnailUri }} resizeMode="cover" accessibilityIgnoresInvertColors style={{ width, height }} /> : null}
        </View>
        <View style={{ flex: 1, marginLeft: theme.spacing.md, justifyContent: 'center' }}>
          <AppText variant="headline" accessibilityRole="header">
            {title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
            <AppText variant="footnote" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {routeName}
            </AppText>
            <AppText variant="footnote" numeric color="textSecondary" style={{ marginLeft: theme.spacing.sm }}>{`${pct}%`}</AppText>
          </View>
          <ProgressBar value={pct} failed={failed} accessibilityLabel={progressLabel} style={{ marginTop: 6 }} />
          {failed ? (
            errorCaption ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: theme.spacing.sm }}>
                <Ionicons name={ICON.error.outline} size={theme.iconSize.sm} color={c.error} style={{ marginTop: 2, marginRight: theme.layout.iconTextGap }} accessibilityElementsHidden />
                <AppText variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                  {errorCaption}
                </AppText>
              </View>
            ) : null
          ) : caption ? (
            <AppText variant="footnote" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
              {caption}
            </AppText>
          ) : null}
        </View>
      </View>
      {failed && (retryLabel || cancelLabel) ? (
        <View style={{ flexDirection: 'row', columnGap: theme.spacing.sm, marginTop: theme.spacing.md, justifyContent: 'flex-end' }}>
          {cancelLabel ? <Button variant="secondary" size="sm" label={cancelLabel} onPress={() => onCancel?.()} /> : null}
          {retryLabel ? <Button variant="primary" size="sm" label={retryLabel} onPress={() => onRetry?.()} /> : null}
        </View>
      ) : null}
    </Card>
  );
}
