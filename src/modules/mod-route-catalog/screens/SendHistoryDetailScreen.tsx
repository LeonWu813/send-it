/**
 * SendHistoryDetailScreen — AC-129.
 *
 * Displays the logged-in user's individual ascent records for a specific route.
 * Data is fetched from MOD-004's public service (fetchMyAscentsForRoute) on mount
 * so the history is current even if the user logged sends since opening the
 * route detail screen.
 *
 * Navigation:
 * - Back button returns to the route detail screen (not to the list) per AC-129.
 *   The RouteNavigator sets onBack to navigate to { name: 'detail', routeId }.
 *
 * Each ascent row shows at minimum:
 * - Style (flash/top/attempt) with a colored badge
 * - Attempts count
 * - Date (logged_at formatted)
 *
 * Safe area insets are applied per production.md Screen Layout & Safe Area Insets.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { deleteAscent, fetchMyAscentsForRoute } from '../../mod-send-logging';
import type { AscentStyle, AscentWithProfile } from '../../mod-send-logging';

/** Gold color for flash badge — matches the flash achievement icon. */
const FLASH_BADGE_COLOR = '#FFD700';

function getStyleBadgeColor(
  style: AscentStyle,
  theme: ReturnType<typeof useTheme>['theme'],
): string {
  switch (style) {
    case 'flash':
      return FLASH_BADGE_COLOR;
    case 'top':
      return theme.colors.success;
    case 'attempt':
      return theme.colors.textSecondary;
  }
}

interface SendHistoryDetailScreenProps {
  routeId: string;
  session: Session;
  onBack: () => void;
}

export default function SendHistoryDetailScreen({
  routeId,
  onBack,
}: SendHistoryDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [ascents, setAscents] = useState<AscentWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAscents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchMyAscentsForRoute(routeId);
      setAscents(data);
    } catch {
      setErrorMessage(t('sends.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

  /**
   * Optimistically remove the ascent from local state, then call deleteAscent.
   * On failure, re-fetch the list to restore accurate state.
   */
  const handleDeleteAscent = useCallback(
    (ascentId: string): void => {
      Alert.alert(
        t('sendLogging.delete.confirm'),
        undefined,
        [
          {
            text: t('sendLogging.delete.cancel'),
            style: 'cancel',
          },
          {
            text: t('sendLogging.delete.delete'),
            style: 'destructive',
            onPress: () => {
              // Optimistic remove
              setAscents((prev) => prev.filter((a) => a.id !== ascentId));
              void deleteAscent(ascentId).catch(() => {
                // Revert on failure by re-fetching
                void loadAscents();
              });
            },
          },
        ],
      );
    },
    [t, loadAscents],
  );

  useEffect(() => {
    void loadAscents();
  }, [loadAscents]);

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.title}>{t('routeCatalog.detail.sendHistoryTitle')}</Text>
        {/* Spacer to center the title */}
        <View style={styles.titleSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : errorMessage !== null ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => { void loadAscents(); }}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          {ascents.length === 0 ? (
            <Text style={styles.emptyText}>{t('routeCatalog.detail.noSends')}</Text>
          ) : (
            ascents.map((ascent) => {
              const badgeColor = getStyleBadgeColor(ascent.style, theme);
              const displayDate = new Date(ascent.logged_at).toLocaleDateString();
              return (
                <View key={ascent.id} style={styles.ascentRow}>
                  <View style={styles.ascentRowHeader}>
                    <View style={[styles.styleBadge, { backgroundColor: badgeColor }]}>
                      <Text style={styles.styleBadgeText}>
                        {t(`sends.styles.${ascent.style}`)}
                      </Text>
                    </View>
                    <View style={styles.ascentRowHeaderRight}>
                      <Text style={styles.dateText}>{displayDate}</Text>
                      {/* Delete button — all rows in this screen are the current user's own ascents */}
                      <Pressable
                        onPress={() => { handleDeleteAscent(ascent.id); }}
                        accessibilityRole="button"
                        accessibilityLabel={t('sendLogging.delete.delete')}
                        style={styles.deleteButton}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.ascentMeta}>
                    <Text style={styles.attemptsText}>
                      {t('sends.attemptsCount', { count: ascent.attempts })}
                    </Text>
                    {ascent.is_private && (
                      <Text style={styles.privateLabel}>{t('sends.privateLabel')}</Text>
                    )}
                  </View>
                  {ascent.note !== null && (
                    <View style={styles.noteContainer}>
                      <Text style={styles.noteText}>{ascent.note}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
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
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: topInset,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.background,
    },
    backButton: {
      // no extra padding — topBar handles spacing
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    titleSpacer: {
      width: 24, // matches back button icon width for centering
    },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    errorText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    retryButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    emptyText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.spacing.xl,
    },
    ascentRow: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ascentRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    ascentRowHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    deleteButton: {
      padding: theme.spacing.xs,
    },
    styleBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
    },
    styleBadgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      textTransform: 'uppercase',
    },
    dateText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    ascentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      flexWrap: 'wrap',
    },
    attemptsText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
    },
    privateLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textDisabled,
    },
    noteContainer: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.divider,
    },
    noteText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      fontStyle: 'italic',
    },
  });
}
