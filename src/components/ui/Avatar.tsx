import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { AVATAR_SIZE, useTheme } from '../../lib/theme';
import type { TypeVariant } from '../../lib/theme';
import { AppText } from './AppText';

export type AvatarSize = keyof typeof AVATAR_SIZE;

export interface AvatarProps {
  /** xs 24, sm 32 (single-line rows), md 48 (two-line rows), lg 64 (profile header), xl 96 (edit profile). Only these five exist. */
  size?: AvatarSize;
  /** Photo URL. While loading or on failure the default (initial / person glyph) shows. */
  uri?: string | null;
  /** Display name: its first character is the default avatar, and it labels the avatar. */
  name?: string;
  /** The name is read next to the avatar: hide this node from VoiceOver. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TEXT: Record<AvatarSize, { variant: TypeVariant; weight?: '600' }> = {
  xs: { variant: 'footnote', weight: '600' },
  sm: { variant: 'footnote', weight: '600' },
  md: { variant: 'headline' },
  lg: { variant: 'title2' },
  xl: { variant: 'title1' },
};

function initial(name?: string): string {
  const first = Array.from((name ?? '').trim())[0];
  return first ? first.toUpperCase() : '';
}

/** Circle on `surfaceAlt` with a hairline `border` ring, photo fades in over `short` + `linear`. */
export function Avatar({ size = 'md', uri, name, decorative, style }: AvatarProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration } = useMotion();
  const dim = AVATAR_SIZE[size];
  const [failed, setFailed] = useState(false);
  const photo = useRef(new Animated.Value(0)).current;
  const ch = initial(name);
  const showPhoto = !!uri && !failed;

  useEffect(() => {
    setFailed(false);
    photo.setValue(0);
  }, [uri, photo]);

  return (
    <View
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : t('ui.avatarOf', { name: name ?? '' })}
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: theme.stroke.hairline,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {ch ? (
        <AppText variant={TEXT[size].variant} weight={TEXT[size].weight} color="textSecondary">
          {ch}
        </AppText>
      ) : (
        <Ionicons name={ICON.profile.filled} size={Math.round(dim / 2)} color={theme.colors.textSecondary} />
      )}
      {showPhoto ? (
        <Animated.View style={{ position: 'absolute', width: dim, height: dim, opacity: photo }}>
          <Image
            source={{ uri: uri as string }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onLoad={() =>
              Animated.timing(photo, { toValue: 1, duration: duration.short, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }).start()
            }
            onError={() => setFailed(true)}
            style={{ width: dim, height: dim, borderRadius: theme.radius.full }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
