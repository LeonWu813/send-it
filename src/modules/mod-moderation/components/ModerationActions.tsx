/**
 * ModerationActions — Report + Block controls for a given user (AC-080–AC-084).
 *
 * Design system §32.10 / §32.11:
 *   - Block: ui/ Button `destructive` (ICON.block.outline) → BottomSheet `confirm` (destructive on
 *     top, cancel below) → toast on success.
 *   - Unblock: ui/ Button `secondary`, no confirmation, toast on success, no haptic.
 *   - Report: ui/ Button `ghost` → ReportSheet.
 *   - Never renders for the user's own profile (hooks still run in the same order every render).
 *
 * Requires a ToastProvider above it (mounted once by AppShell).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, useToast } from '../../../components/ui';
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ModerationActions({
  targetUserId,
  currentUserId,
  onBlock,
  onUnblock,
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
    <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
      <Button
        variant="ghost"
        size="md"
        on="background"
        fullWidth
        label={t('moderation.reportUser')}
        onPress={() => setReportSheetVisible(true)}
      />

      {blocked ? (
        <Button
          variant="secondary"
          size="md"
          fullWidth
          label={t('moderation.unblockUser')}
          loading={blockLoading}
          onPress={() => void handleUnblock()}
        />
      ) : (
        <Button
          variant="destructive"
          size="md"
          fullWidth
          icon={ICON.block.outline}
          label={t('moderation.blockUser')}
          loading={loadingStatus}
          onPress={() => setConfirmVisible(true)}
        />
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
