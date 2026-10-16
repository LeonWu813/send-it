/**
 * ModerationActions — Report + Block controls for a given user (AC-080–AC-084).
 *
 * Design system §32.10 / §32.11:
 * (v2.2, profile context, G.7):
 *   - Block: ui/ Button `destructiveTonal` (no icon) → floating BottomSheet `confirm` (no X, stacked
 *     solid-red `destructive` on top, cancel below) → toast on success.
 *   - Unblock: `footnote` "You blocked {name}" + ui/ Button `secondary` `sm`; no confirmation, no haptic.
 *   - Report: ui/ Button `ghost` → ReportSheet.
 *   - Never renders for the user's own profile (hooks still run in the same order every render).
 *
 * Requires a ToastProvider above it (mounted once by AppShell).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, BottomSheet, Button, useToast } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import { blockUser, isBlocked, unblockUser } from '../moderation-service';
import ReportSheet from './ReportSheet';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ModerationActionsProps {
  /** UUID of the user being moderated. */
  targetUserId: string;
  /** UUID of the logged-in user. Never render for own profile. */
  currentUserId: string;
  /** Called after a successful block. Parent can refresh UI. */
  onBlock?: () => void;
  /** Called after a successful unblock. */
  onUnblock?: () => void;
  /** Display name used in the blocked notice ("You blocked {name}"). Optional. */
  targetName?: string;
  /** Surface the buttons sit on (the profile header Card is `surface`). Default `surface`. */
  on?: 'background' | 'surface';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ModerationActions({
  targetUserId,
  currentUserId,
  onBlock,
  onUnblock,
  targetName,
  on = 'surface',
}: ModerationActionsProps): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { haptic } = useMotion();
  const toast = useToast();

  const isOwnProfile = targetUserId === currentUserId;

  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | undefined>(undefined);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // ── Load initial block status ───────────────────────────────────────────────

  const loadBlockStatus = useCallback(async (): Promise<void> => {
    try {
      const result = await isBlocked(targetUserId);
      setBlocked(result);
    } catch {
      // Non-critical — silently fail; controls render as unblocked.
    } finally {
      setLoadingStatus(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (isOwnProfile) return;
    void loadBlockStatus();
  }, [isOwnProfile, loadBlockStatus]);

  // ── Block / Unblock ─────────────────────────────────────────────────────────

  const handleBlock = useCallback(async (): Promise<void> => {
    setBlockLoading(true);
    setBlockError(undefined);
    try {
      await blockUser(targetUserId);
      setBlocked(true);
      setConfirmVisible(false);
      haptic('success', 'moderation-block');
      toast.show({ message: t('moderation.block.blocked'), icon: ICON.block.outline });
      onBlock?.();
    } catch {
      setBlockError(t('moderation.block.error'));
    } finally {
      setBlockLoading(false);
    }
  }, [targetUserId, haptic, toast, t, onBlock]);

  const handleUnblock = useCallback(async (): Promise<void> => {
    setBlockLoading(true);
    try {
      await unblockUser(targetUserId);
      setBlocked(false);
      toast.show({ message: t('moderation.block.unblocked') });
      onUnblock?.();
    } catch {
      toast.show({ message: t('moderation.block.error'), tone: 'error' });
    } finally {
      setBlockLoading(false);
    }
  }, [targetUserId, toast, t, onUnblock]);

  const closeConfirm = useCallback(() => {
    setConfirmVisible(false);
    setBlockError(undefined);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Never render for own profile (after all hooks).
  if (isOwnProfile) return null;

  return (
    <View>
      {blocked ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            {targetName
              ? t('moderation.blockedNotice', { name: targetName })
              : t('moderation.blockedNoticeGeneric')}
          </AppText>
          <Button
            variant="secondary"
            size="sm"
            on={on}
            label={t('moderation.unblockUser')}
            loading={blockLoading}
            onPress={() => void handleUnblock()}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="destructiveTonal"
              size="md"
              on={on}
              fullWidth
              label={t('moderation.blockUser')}
              loading={loadingStatus}
              onPress={() => setConfirmVisible(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              size="md"
              on={on}
              fullWidth
              label={t('moderation.reportUser')}
              onPress={() => setReportSheetVisible(true)}
            />
          </View>
        </View>
      )}

      <BottomSheet
        variant="confirm"
        visible={confirmVisible}
        onClose={closeConfirm}
        title={t('moderation.block.confirmBlock')}
        description={t('moderation.block.confirmBody')}
        confirmLabel={t('moderation.blockUser')}
        confirmIcon={ICON.block.outline}
        onConfirm={() => void handleBlock()}
        loading={blockLoading}
        error={blockError}
        errorActionLabel={t('common.retry')}
        onErrorAction={() => void handleBlock()}
      />

      <ReportSheet
        targetUserId={targetUserId}
        visible={reportSheetVisible}
        onDismiss={() => setReportSheetVisible(false)}
      />
    </View>
  );
}
