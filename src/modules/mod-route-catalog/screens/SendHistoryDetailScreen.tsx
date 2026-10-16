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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Card,
  IconButton,
  InlineError,
  SendStatus,
  Spinner,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useTabBarInset } from '../../mod-home/components/AppHeaderContext';
import { deleteAscent, fetchMyAscentsForRoute } from '../../mod-send-logging';
import type { AscentWithProfile } from '../../mod-send-logging';

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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);
  const tabInset = useTabBarInset();
  useAppHeader({ title: t('routeCatalog.detail.sendHistoryTitle'), onBack });

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
    <SwipeBackWrapper onBack={onBack}>
    <View style={styles.root}>
      {isLoading ? (
        <View style={styles.centeredContainer}>
          <Spinner />
        </View>
      ) : errorMessage !== null ? (
        <View style={styles.errorBlock}>
          <InlineError
            variant="block"
            message={errorMessage}
            actionLabel={t('common.retry')}
            onAction={() => { void loadAscents(); }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: theme.spacing.xxl + tabInset.contentBottom }]}
          scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
        >
          {ascents.length === 0 ? (
            <AppText variant="body" color="textSecondary" align="center" style={styles.emptyText}>
              {t('routeCatalog.detail.noSends')}
            </AppText>
          ) : (
            ascents.map((ascent) => {
              const displayDate = new Date(ascent.logged_at).toLocaleDateString();
              return (
                <Card key={ascent.id} variant="static">
                  <View style={styles.ascentRowHeader}>
                    <SendStatus sendStyle={ascent.style} variant="tag" />
                    <View style={styles.ascentRowHeaderRight}>
                      <AppText variant="footnote" color="textSecondary">{displayDate}</AppText>
                      {/* Delete button — all rows in this screen are the current user's own ascents */}
                      <IconButton
                        name={ICON.delete.outline}
                        size={20}
                        color="textSecondary"
                        onPress={() => { handleDeleteAscent(ascent.id); }}
                        accessibilityLabel={t('sendLogging.delete.delete')}
                      />
                    </View>
                  </View>
                  <View style={styles.ascentMeta}>
                    <AppText variant="footnote">
                      {t('sends.attemptsCount', { count: ascent.attempts })}
                    </AppText>
                    {ascent.is_private && (
                      <AppText variant="caption1" color="textSecondary">{t('sends.privateLabel')}</AppText>
                    )}
                  </View>
                  {ascent.note !== null && (
                    <View style={styles.noteContainer}>
                      <AppText variant="footnote" style={styles.noteText}>{ascent.note}</AppText>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: screenMargin,
    },
    errorBlock: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.md,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
      gap: theme.layout.cardGap,
    },
    emptyText: {
      paddingVertical: theme.spacing.xl,
    },
    ascentRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ascentRowHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginRight: -theme.spacing.smd,
    },
    ascentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      flexWrap: 'wrap',
    },
    noteContainer: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.control,
      backgroundColor: theme.colors.surfaceAlt,
    },
    noteText: {
      fontStyle: 'italic',
    },
  });
}
