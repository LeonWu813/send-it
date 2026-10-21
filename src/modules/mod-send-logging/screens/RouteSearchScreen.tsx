/**
 * RouteSearchScreen — route selector for the global "+" entry point.
 *
 * When the user taps the global "+" button (not from a specific route detail
 * page), they must first search and select a route before logging a send.
 *
 * After selection the caller navigates to LogSendScreen with the chosen route.
 *
 * Design system v2.2: capsule search field, grouped `surface` card 20 of ListRow `content` rows
 * (56 thumbnail = TapeBadge on `surfaceAlt`, `headline` title, `footnote` section), AscentRowSkeleton.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  EmptyState,
  InlineError,
  ListRow,
  AscentRowSkeleton,
  SkeletonGroup,
  TextField,
  useSkeletonPhase,
} from '../../../components/ui';
import { CONTINUOUS, RADIUS, useLayout, useTheme } from '../../../lib/theme';
import { listRoutes } from '../../mod-route-catalog';
import { TapeBadge } from '@/lib/tape';
import type { RouteSummary } from '../../mod-route-catalog';

interface RouteSearchScreenProps {
  /** Authenticated session. */
  session: Session;
  /** Called with the selected route when the user taps a result. */
  onRouteSelected: (route: RouteSummary) => void;
  /** Called when the user dismisses the screen without selecting. */
  onCancel: () => void;
}

export default function RouteSearchScreen({
  session: _session,
  onRouteSelected,
  onCancel,
}: RouteSearchScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const insets = useSafeAreaInsets();

  const [gymIdInput, setGymIdInput] = useState<string>('');
  const [results, setResults] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const phase = useSkeletonPhase(isLoading);

  const handleSearch = useCallback(async (): Promise<void> => {
    const trimmedGymId = gymIdInput.trim();
    if (trimmedGymId === '') {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setHasSearched(true);
    try {
      const routes = await listRoutes(trimmedGymId, { grade: null, colorTag: null });
      setResults(routes);
    } catch {
      setErrorMessage(t('sends.errors.routeSearchFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymIdInput, t]);

  /** Grouped container: `surface`, card 20, clipped. */
  const groupStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.card,
    ...CONTINUOUS,
    overflow: 'hidden' as const,
  };

  const canSearch = gymIdInput.trim() !== '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.layout.minTouchTarget,
          marginTop: insets.top + theme.spacing.sm,
          paddingHorizontal: screenMargin,
        }}
      >
        <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" size="md" on="background" />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <AppText variant="title3" accessibilityRole="header">
            {t('sends.selectRoute')}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenMargin,
          paddingTop: theme.layout.sectionGap,
          paddingBottom: theme.spacing.xxl,
          rowGap: theme.layout.cardGap,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gym ID search input */}
        <TextField
          variant="search"
          value={gymIdInput}
          onChangeText={setGymIdInput}
          placeholder={t('sends.gymIdPlaceholder')}
          returnKeyType="search"
          onSubmitEditing={() => void handleSearch()}
          autoCapitalize="none"
          autoCorrect={false}
          loading={isLoading}
          accessibilityLabel={t('sends.gymIdPlaceholder')}
        />
        <Button
          label={t('sends.search')}
          onPress={() => void handleSearch()}
          variant="secondary"
          size="md"
          disabled={!canSearch || isLoading}
          fullWidth
        />

        {/* Loading */}
        {isLoading && phase !== 'idle' && (
          <SkeletonGroup label={t('sends.searching')}>
            <View style={groupStyle}>
              {[0, 1, 2].map((i) => (
                <AscentRowSkeleton key={i} />
              ))}
            </View>
          </SkeletonGroup>
        )}

        {/* Error */}
        {errorMessage !== null && !isLoading && (
          <InlineError
            variant="block"
            message={errorMessage}
            actionLabel={t('common.retry')}
            onAction={() => void handleSearch()}
          />
        )}

        {/* Results list */}
        {!isLoading && errorMessage === null && results.length > 0 && (
          <View style={groupStyle}>
            {results.map((item, index) => (
              <ListRow
                key={item.id}
                variant="content"
                thumbnail={
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  >
                    <TapeBadge color={item.color_tag} grade={item.grade} size="sm" />
                  </View>
                }
                title={`${item.grade} ${item.color_tag}`}
                subtitle={item.section_label ?? undefined}
                divider={index < results.length - 1}
                onPress={() => onRouteSelected(item)}
                accessibilityLabel={`${item.grade} ${item.color_tag}`}
                inScroll
              />
            ))}
          </View>
        )}

        {!isLoading && errorMessage === null && hasSearched && results.length === 0 && (
          <EmptyState variant="inline" description={t('routes.noResults')} />
        )}
      </ScrollView>
    </View>
  );
}
