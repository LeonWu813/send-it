import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

// Not '@/lib/AppHeaderContext': that barrel also pulls AppHeaderOverlayScope -> AppHeader -> the notifications module
// (and supabase), which would make this primitive impossible to import from the ui barrel in unit tests.
import { useHeaderContentInset, useTabBarInset } from '../../modules/mod-home/components/AppHeaderContext';
import { useTheme } from '../../lib/theme';
import { Spinner } from './ProgressBar';

export interface PageLoadingProps {
  /** Override the default `common.loading` label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one full-page loading state (states-audit-ui 1.2). Use when nothing from data is on screen yet:
 * `if (phase === 'loading') return <PageLoading />` with `phase` from useLoadingPhase (nothing for the first
 * 300ms; after 10s swap in <EmptyState variant="error" />). A large `textSecondary` spinner, horizontally
 * centred both ways in the visible area: below the header (useHeaderContentInset; on tab roots the large
 * title header's height) and above the floating tab bar (useTabBarInset; 0 without one). No card, no text,
 * no skeleton. E1/E3/E4 stay top-anchored at `pageLoadingOffset`.
 */
export function PageLoading({ accessibilityLabel, style }: PageLoadingProps): React.JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const inset = useHeaderContentInset();
  const { indicatorBottom } = useTabBarInset();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('common.loading')}
      accessibilityState={{ busy: true }}
      style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, paddingTop: inset, paddingBottom: indicatorBottom }, style]}
    >
      <Spinner context="page" />
    </View>
  );
}
