/**
 * ProfileHistoryView — Profile History as a pushed view (page-review P-1).
 *
 * Nested header (back + title) through `useAppHeader`; below it the full StatsPanel (72pt hero +
 * chart) and the sends list from ProfileHistoryScreen. The header sits in flow, so the list needs no
 * top inset. Swipe-back is enabled like the other pushed screens.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import { useAppHeader } from '@/lib/AppHeaderContext';
import ProfileHistoryScreen from './ProfileHistoryScreen';

export interface ProfileHistoryViewProps {
  userId: string;
  isOwnProfile: boolean;
  /** Back button / swipe-back. */
  onBack: () => void;
  refetchKey?: number;
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
  onLogSend?: () => void;
}

export default function ProfileHistoryView({
  userId,
  isOwnProfile,
  onBack,
  refetchKey,
  onNavigateToRoute,
  onLogSend,
}: ProfileHistoryViewProps): React.JSX.Element {
  const { t } = useTranslation('common');
  useAppHeader({ title: t('profile.sendHistory'), onBack });

  return (
    <SwipeBackWrapper onBack={onBack}>
      <ProfileHistoryScreen
        userId={userId}
        isOwnProfile={isOwnProfile}
        refetchKey={refetchKey}
        onNavigateToRoute={onNavigateToRoute}
        onLogSend={onLogSend}
        headerHandled
      />
    </SwipeBackWrapper>
  );
}
