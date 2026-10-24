/**
 * AscentList — displays ascents for a route on the route detail screen.
 *
 * Wires up the placeholder slot left by MOD-003 (RouteDetailScreen).
 * Each ascent shows: avatar + name, send-style chip, date, attempts, note (own only).
 *
 * Grade is NOT shown on each ascent row — it is displayed at the route level.
 * (Grade comes from Route.grade, never from the ascent row.)
 *
 * Design system v2.2 (§32.8): `pageSection` title, `surface` container (card 20), ListRow `content` rows
 * (Avatar + name `headline` + date/attempts `footnote`, SendStatus `disc` trailing, delete for own rows),
 * floating BottomSheet `confirm` for delete (failure shows inside the sheet, the row stays),
 * section Spinner / EmptyState `section` (E2) / InlineError states, and the new-row landing motion (D1).
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, LayoutAnimation, Platform, UIManager, View } from 'react-native';

import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  InlineError,
  ListRow,
  SendStatus,
  Spinner,
  useLoadingPhase,
  useToast,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { CONTINUOUS, RADIUS, useTheme } from '../../../lib/theme';
import { deleteAscent, loadAscentsForRoute } from '../send-service';
import type { AscentStyle, AscentWithProfile } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AscentListProps {
  routeId: string;
  session: Session;
  /** Called when the user taps the "Log a Send" button — opens LogSendScreen. */
  onLogSend: () => void;
  /**
   * Opaque counter incremented by the parent after each successful log
   * (AC-013). Changing this value causes the useEffect to re-run, which
   * re-fetches the ascent list without requiring re-navigation.
   */
  refreshKey?: number;
}

function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(language);
}

/** Calendar day key (local) used to decide "first flash of the day". */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function AscentList({
  routeId,
  session,
  onLogSend,
  refreshKey = 0,
}: AscentListProps): React.JSX.Element {
  const { t, i18n } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, reduceMotion, haptic } = useMotion();
  const toast = useToast();

  const [ascents, setAscents] = useState<AscentWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [landing, setLanding] = useState<{ id: string; burst: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AscentWithProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  /** Ids seen by the previous successful load; null until the first load finishes. */
  const knownIds = useRef<Set<string> | null>(null);
  const phase = useLoadingPhase(isLoading && ascents.length === 0);

  const animateLayout = useCallback(
    (ms: number): void => {
      if (reduceMotion) return;
      LayoutAnimation.configureNext({
        duration: ms,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
    },
    [reduceMotion],
  );

  const fetchAscents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await loadAscentsForRoute(routeId);
      const previous = knownIds.current;
      // D1: a refresh that brings one of the user's own new rows in is the "just logged" case.
      const fresh =
        previous === null ? undefined : data.find((a) => !previous.has(a.id) && a.user_id === session.user.id);
      knownIds.current = new Set(data.map((a) => a.id));
      if (fresh) {
        animateLayout(duration.medium);
        const burst =
          fresh.style === 'flash' &&
          !data.some(
            (a) =>
              a.id !== fresh.id &&
              a.user_id === session.user.id &&
              a.style === 'flash' &&
              dayKey(a.logged_at) === dayKey(fresh.logged_at),
          );
        setLanding({ id: fresh.id, burst });
        haptic(fresh.style === 'flash' ? 'emphasis' : fresh.style === 'top' ? 'toggle' : 'select', 'ascent-landing');
        AccessibilityInfo.announceForAccessibility(
          t('sends.logged', { style: t(`sends.styles.${fresh.style}`) }),
        );
      }
      setAscents(data);
    } catch {
      setErrorMessage(t('sends.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, session.user.id, t, animateLayout, duration.medium, haptic]);

  // refreshKey is intentionally included here (not in useCallback) so that
  // the parent can trigger a re-fetch after a successful send log (AC-013)
  // by incrementing the key, without widening the fetchAscents identity.
  useEffect(() => {
    void fetchAscents();
  }, [fetchAscents, refreshKey]);

  const closeDeleteSheet = useCallback((): void => {
    setDeleteTarget(null);
    setDeleteError(undefined);
  }, []);

  /**
   * Confirm delete inside the sheet. Success: sheet closes, the row collapses, toast "Deleted".
   * Failure: InlineError block in the sheet (with retry), the row stays untouched.
   */
  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      await deleteAscent(id);
      animateLayout(duration.short);
      knownIds.current?.delete(id);
      setAscents((prev) => prev.filter((a) => a.id !== id));
      setDeleteTarget(null);
      toast.show({ message: t('sends.deleted') });
    } catch {
      haptic('error', 'ascent-delete');
      setDeleteError(t('sends.errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, animateLayout, duration.short, toast, t, haptic]);

  /** Grouped container: `surface`, card 20, clipped (rows carry their own dividers). */
  const groupStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.card,
    ...CONTINUOUS,
    overflow: 'hidden' as const,
  };

  const showSpinner = isLoading && ascents.length === 0 && phase === 'loading';
  const showTimeout = isLoading && ascents.length === 0 && phase === 'timeout';
  const showError = errorMessage !== null && !isLoading;
  const isEmpty = !isLoading && errorMessage === null && ascents.length === 0;

  return (
    <View style={{ marginTop: theme.layout.sectionGap }}>
      {/* Section header. No primary here (§32.8); standalone use gets a ghost sm "Log Send". */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.layout.sectionHeaderGap,
        }}
      >
        <AppText variant="pageSection" accessibilityRole="header">
          {t('sends.ascentsSectionTitle')}
        </AppText>
        {!isEmpty && (
          <Button label={t('sends.logSend')} onPress={onLogSend} variant="ghost" size="sm" on="background" />
        )}
      </View>

      {/* Loading */}
      {showSpinner && (
        <View
          accessible
          accessibilityLabel={t('sends.loading')}
          style={{ minHeight: theme.layout.sectionLoadingSlot, alignItems: 'center', justifyContent: 'center' }}
        >
          <Spinner context="section" />
        </View>
      )}

      {/* Error (also the 10s loading timeout) */}
      {(showError || showTimeout) && (
        <InlineError
          variant="block"
          message={errorMessage ?? t('sends.errors.loadFailed')}
          actionLabel={t('common.retry')}
          onAction={() => void fetchAscents()}
          actionLoading={isLoading}
          on="surface"
        />
      )}

      {/* Empty */}
      {isEmpty && (
        <EmptyState
          variant="section"
          description={t('sends.noAscents')}
          secondaryLabel={t('sends.logSend')}
          onSecondary={onLogSend}
        />
      )}

      {/* Ascent rows */}
      {errorMessage === null && ascents.length > 0 && (
        <View style={groupStyle}>
          {ascents.map((ascent, index) => (
            <AscentRow
              key={ascent.id}
              ascent={ascent}
              last={index === ascents.length - 1}
              isOwn={ascent.user_id === session.user.id}
              landing={landing?.id === ascent.id ? landing : null}
              onDelete={setDeleteTarget}
              language={i18n.language}
            />
          ))}
        </View>
      )}

      <BottomSheet
        visible={deleteTarget !== null}
        onClose={closeDeleteSheet}
        variant="confirm"
        title={t('sendLogging.delete.confirm')}
        confirmLabel={t('sendLogging.delete.delete')}
        confirmIcon={ICON.delete.outline}
        onConfirm={() => void confirmDelete()}
        cancelLabel={t('sendLogging.delete.cancel')}
        loading={isDeleting}
        error={deleteError}
        errorActionLabel={t('common.retry')}
        onErrorAction={() => void confirmDelete()}
      />
    </View>
  );
}

// ── AscentRow sub-component ────────────────────────────────────────────────────

interface AscentRowProps {
  ascent: AscentWithProfile;
  last: boolean;
  isOwn: boolean;
  /** Non-null on the row that has just been logged: plays D1. */
  landing: { id: string; burst: boolean } | null;
  language: string;
  /** Called with the ascent when the user taps delete (opens the confirm sheet). */
  onDelete: (ascent: AscentWithProfile) => void;
}

function AscentRow({ ascent, last, isOwn, landing, language, onDelete }: AscentRowProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration } = useMotion();
  const [noteExpanded, setNoteExpanded] = useState<boolean>(false);
  const [noteTruncated, setNoteTruncated] = useState<boolean>(false);
  const highlight = useRef(new Animated.Value(0)).current;

  // D1 highlight: hold, then fade out. Attempt rows are not highlighted.
  useEffect(() => {
    if (!landing || ascent.style === 'attempt') return;
    highlight.setValue(1);
    Animated.sequence([
      Animated.delay(duration.highlightHold),
      Animated.timing(highlight, {
        toValue: 0,
        duration: duration.long,
        easing: bezierFor('standard'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing?.id]);

  const displayDate = formatDate(ascent.logged_at, language);
  const styleLabel = t(`sends.styles.${ascent.style}`);
  const attemptsLabel = t('sends.attemptsCount', { count: ascent.attempts });
  // VoiceOver: "<name>, <style>, <date>, <attempts>[, private][, note]" read as one node.
  const rowLabel = [
    ascent.display_name,
    styleLabel,
    displayDate,
    attemptsLabel,
    ascent.is_private ? t('sends.privateLabel') : null,
    isOwn && ascent.note !== null ? ascent.note : null,
  ]
    .filter((p): p is string => p !== null)
    .join(', ');

  const highlightColor: 'sendTopContainer' | 'sendFlashContainer' =
    ascent.style === 'flash' ? 'sendFlashContainer' : 'sendTopContainer';

  const subtitle = [`${displayDate} · ${attemptsLabel}`, ascent.is_private ? t('sends.privateLabel') : null]
    .filter((p): p is string => p !== null)
    .join(' · ');
  // Divider starts at the title's left edge: row padding (md) + avatar + gap (smd).
  const dividerInset = theme.spacing.md + theme.avatarSize.sm + theme.spacing.smd;

  return (
    <View>
      {landing && ascent.style !== 'attempt' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors[highlightColor],
            opacity: highlight,
          }}
        />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ListRow
          variant="content"
          title={ascent.display_name}
          subtitle={subtitle}
          leading={<Avatar size="sm" name={ascent.display_name} decorative />}
          leadingWidth={theme.avatarSize.sm}
          trailing={
            <SendStatus
              variant="disc"
              sendStyle={ascent.style as AscentStyle}
              landing={landing?.id}
              burst={landing?.burst}
            />
          }
          divider={false}
          accessibilityLabel={rowLabel}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        />
        {/* Delete: own ascents only; others keep no empty slot. */}
        {isOwn && (
          <IconButton
            name={ICON.delete.outline}
            size={theme.iconSize.md}
            color="textSecondary"
            accessibilityLabel={t('sends.deleteLabel', { date: displayDate, style: styleLabel })}
            onPress={() => onDelete(ascent)}
            style={{ marginRight: theme.spacing.xs }}
          />
        )}
      </View>

      {/* Note: owner only; footnote, 3 lines + "More". */}
      {isOwn && ascent.note !== null && (
        <View
          style={{
            paddingLeft: dividerInset,
            paddingRight: theme.spacing.md,
            paddingBottom: theme.layout.listRowPaddingV,
            marginTop: -theme.spacing.xs,
          }}
        >
          <AppText
            variant="footnote"
            color="textSecondary"
            numberOfLines={noteExpanded ? undefined : 3}
            onTextLayout={(e: { nativeEvent: { lines: unknown[] } }) => {
              if (!noteExpanded) setNoteTruncated(e.nativeEvent.lines.length > 3);
            }}
          >
            {ascent.note}
          </AppText>
          {noteTruncated && !noteExpanded && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button label={t('sends.noteMore')} onPress={() => setNoteExpanded(true)} variant="ghost" size="sm" />
            </View>
          )}
        </View>
      )}

      {!last && (
        <View
          pointerEvents="none"
          style={{ height: theme.stroke.hairline, marginLeft: dividerInset, backgroundColor: theme.colors.divider }}
        />
      )}
    </View>
  );
}
