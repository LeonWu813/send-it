/**
 * PosterAvatar — ui/ Avatar (sm 32) with the initial-letter fallback (AC-134/AC-138).
 *
 * Renders the poster's avatar inside a testID wrapper so tests can assert
 * placeholder vs loaded states.
 */

import React from 'react';
import { View } from 'react-native';
import { Avatar } from '../../../components/ui/Avatar';

export interface PosterAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
}

export function PosterAvatar({ avatarUrl, displayName }: PosterAvatarProps): React.JSX.Element {
  return (
    <View testID={avatarUrl ? 'reel-poster-avatar' : 'reel-poster-avatar-placeholder'}>
      <Avatar size="sm" uri={avatarUrl} name={displayName ?? undefined} decorative />
    </View>
  );
}
