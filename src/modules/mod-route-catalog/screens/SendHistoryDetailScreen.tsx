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
 * SH-1: a route summary card sits on top (thumbnail, tape badge, colour · section, gym name; same
 * layout as the LogSend summary card, which is not exported). Delete is a "..." action per card that
 * opens a confirm sheet (replaces the trash icon and the system Alert).
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
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  BottomSheet,
  Card,
  IconButton,
  InlineError,
  PressableScale,
  SendStatus,
  Spinner,
} from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, RADIUS, innerRadius, useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import { deleteAscent, fetchMyAscentsForRoute } from '../../mod-send-logging';
import type { AscentWithProfile } from '../../mod-send-logging';
import RouteColorBadge from '../components/RouteColorBadge';
import { getPhotoSignedUrl, loadRoute } from '../route-service';
import type { Route } from '../types';

interface SendHistoryDetailScreenProps {
  routeId: string;
  session: Session;
  onBack: () => void;
  /** Gym name shown in the route summary card. */
  gymName?: string;
  /** Stories / tests only: open the delete confirmation for this ascent on mount. */
  initialDeleteAscentId?: string;
}

export default function SendHistoryDetailScreen({
  routeId,
  onBack,
  gymName,
  initialDeleteAscentId,
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
  // SH-1: route summary (best-effort; the card is omitted if the route cannot be loaded)
  const [route, setRoute] = useState<Route | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // SH-1: ascent awaiting delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(initialDeleteAscentId ?? null);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const data = await loadRoute(routeId);
        if (cancelled || !data) return;
        setRoute(data);
        if (data.photo_url) {
          try {
            const signed = await getPhotoSignedUrl(data.photo_url);
            if (!cancelled) setPhotoUri(signed);
          } catch {
            // Non-fatal: the thumbnail stays empty.
          }
        }
      } catch {
        // Non-fatal: the summary card is simply omitted.
      }
    })();
    return () => { cancelled = true; };
  }, [routeId]);

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
  const confirmDelete = useCallback((): void => {
    const ascentId = pendingDeleteId;
    setPendingDeleteId(null);
    if (ascentId === null) return;
    setAscents((prev) => prev.filter((a) => a.id !== ascentId));
    void deleteAscent(ascentId).catch(() => {
      // Revert on failure by re-fetching
      void loadAscents();
    });
  }, [pendingDeleteId, loadAscents]);

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
          {route ? (
            <RouteSummaryCard route={route} gymName={gymName} photoUri={photoUri} />
          ) : null}
          {ascents.length === 0 ? (
            <AppText variant="body" color="textSecondary" align="left" style={styles.emptyText}>
              {t('routeCatalog.detail.noSends')}
            </AppText>
          ) : (
            ascents.map((ascent) => {
              const displayDate = new Date(ascent.logged_at).toLocaleDateString();
              return (
                <Card key={ascent.id} variant="static" style={styles.ascentCard}>
                  <View style={styles.ascentRowHeader}>
                    {/* A7: SendStatus is alignSelf flex-start; the wrapper lets the row centre it */}
                    <View>
                      <SendStatus sendStyle={ascent.style} variant="tag" />
                    </View>
                    <View style={styles.ascentRowHeaderRight}>
                      <AppText variant="footnote" color="textSecondary">{displayDate}</AppText>
                      {/* SH-1: "..." opens the delete confirmation — all rows are the user's own ascents */}
                      {/* C2: layout box = the 20pt glyph (C4: glyph edge on R16); the 44pt target is hitSlop 12 (4pt inside the card clip) */}
                      <PressableScale
                        onPress={() => { setPendingDeleteId(ascent.id); }}
                        hitSlop={styles.moreSlop}
                        accessibilityRole="button"
                        accessibilityLabel={t('routeCatalog.detail.moreActions')}
                      >
                        <Ionicons name={ICON.more.outline} size={theme.iconSize.md} color={theme.colors.textSecondary} />
                      </PressableScale>
                    </View>
                  </View>
                  <View style={styles.ascentMeta}>
                    <AppText variant="footnote">
                      {t('sends.attemptsCount', { count: ascent.attempts })}
                    </AppText>
                    {ascent.is_private && (
                      <AppText variant="footnote" color="textSecondary">{t('sends.privateLabel')}</AppText>
                    )}
                  </View>
                  {ascent.note !== null && (
                    <AppText variant="subhead" color="textSecondary">{ascent.note}</AppText>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
      {/* SH-1: delete confirmation (destructive + cancel) */}
      <BottomSheet
        visible={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        variant="confirm"
        title={t('sendLogging.delete.confirm')}
        confirmLabel={t('sendLogging.delete.delete')}
        confirmIcon={ICON.delete.outline}
        cancelLabel={t('sendLogging.delete.cancel')}
        onConfirm={confirmDelete}
      />
    </View>
    </SwipeBackWrapper>
  );
}

/** SH-1: compact route summary (card 20, padding 8, thumbnail 64) — mirrors the LogSend summary card. */
function RouteSummaryCard({
  route,
  gymName,
  photoUri,
}: {
  route: Route;
  gymName?: string;
  photoUri: string | null;
}): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const thumb = theme.componentSize.routeThumbCompact;
  const colour = t(`routeCatalog.colors.${route.color_tag}`);
  const title = route.section_label ? `${colour} · ${route.section_label}` : colour;
  return (
    <Card variant="static" padding={theme.layout.routeCardPadding}>
      <View
        accessible
        testID="route-summary-card"
        accessibilityLabel={[route.grade, title, gymName].filter((p): p is string => !!p).join(', ')}
        style={{ flexDirection: 'row', alignItems: 'center', columnGap: theme.spacing.smd }}
      >
        <View
          style={{
            width: thumb,
            height: thumb,
            borderRadius: innerRadius(RADIUS.card, theme.layout.routeCardPadding),
            ...CONTINUOUS,
            overflow: 'hidden',
            backgroundColor: theme.colors.surfaceAlt,
          }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: thumb, height: thumb }} accessibilityIgnoresInvertColors />
          ) : null}
        </View>
        {/* A4/A5: same header spec as Log Send; the wrapper keeps the badge on the row centre */}
        <View>
          <RouteColorBadge color={route.color_tag} grade={route.grade} size="lg" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" numberOfLines={1}>{title}</AppText>
          {gymName ? (
            <AppText variant="footnote" color="textSecondary" numberOfLines={1}>{gymName}</AppText>
          ) : null}
        </View>
      </View>
    </Card>
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
    ascentCard: {
      gap: theme.spacing.sm,
    },
    moreSlop: {
      top: theme.spacing.md - theme.spacing.xs,
      bottom: theme.spacing.md - theme.spacing.xs,
      left: theme.spacing.md - theme.spacing.xs,
      right: theme.spacing.md - theme.spacing.xs,
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
    },
    ascentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      flexWrap: 'wrap',
    },
  });
}
