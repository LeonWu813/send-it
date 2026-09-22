/**
 * RouteSearchScreen — route selector for the global "+" entry point.
 *
 * When the user taps the global "+" button (not from a specific route detail
 * page), they must first search and select a route before logging a send.
 *
 * After selection the caller navigates to LogSendScreen with the chosen route.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { listRoutes } from '../../mod-route-catalog/route-service';
import type { RouteSummary } from '../../mod-route-catalog/types';

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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [gymIdInput, setGymIdInput] = useState<string>('');
  const [results, setResults] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleSearch = useCallback(async (): Promise<void> => {
    const trimmedGymId = gymIdInput.trim();
    if (trimmedGymId === '') {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setHasSearched(true);
    try {
      const routes = await listRoutes(trimmedGymId, { grade: null, status: 'active' });
      setResults(routes);
    } catch {
      setErrorMessage(t('sends.errors.routeSearchFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymIdInput, t]);

  function renderRouteItem({ item }: { item: RouteSummary }): React.JSX.Element {
    return (
      <Pressable
        style={styles.resultItem}
        onPress={() => onRouteSelected(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.grade} ${item.color_tag}`}
      >
        <Text style={styles.resultGrade}>{item.grade}</Text>
        <Text style={styles.resultColor}>{item.color_tag}</Text>
        {item.section_label ? (
          <Text style={styles.resultSection}>{item.section_label}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>{t('sends.selectRoute')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Gym ID search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={gymIdInput}
          onChangeText={setGymIdInput}
          placeholder={t('sends.gymIdPlaceholder')}
          returnKeyType="search"
          onSubmitEditing={() => void handleSearch()}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('sends.gymIdPlaceholder')}
        />
        <Pressable
          style={[
            styles.searchButton,
            gymIdInput.trim() === '' && styles.searchButtonDisabled,
          ]}
          onPress={() => void handleSearch()}
          disabled={gymIdInput.trim() === '' || isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('sends.search')}
        >
          <Text style={styles.searchButtonText}>{t('sends.search')}</Text>
        </Pressable>
      </View>

      {/* Loading */}
      {isLoading && (
        <ActivityIndicator
          style={styles.loader}
          color={theme.colors.primary}
          size="large"
        />
      )}

      {/* Error */}
      {errorMessage !== null && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Results list */}
      {!isLoading && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            hasSearched ? (
              <Text style={styles.emptyText}>{t('routes.noResults')}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    cancelButton: {
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
    },
    cancelButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    screenTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    headerSpacer: {
      width: 60,
    },
    searchRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    searchButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
    },
    searchButtonDisabled: {
      opacity: 0.5,
    },
    searchButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textInverse,
    },
    loader: {
      marginTop: theme.spacing.xl,
    },
    errorContainer: {
      margin: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultGrade: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      minWidth: 36,
    },
    resultColor: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    resultSection: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    emptyText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.xl,
    },
  });
}
