/**
 * ModerationActions — Report + Block controls for a given user (AC-080–AC-084).
 *
 * Renders:
 *   - "Report User" button → opens ReportSheet modal
 *   - "Block" / "Unblock" toggle button (loads current block status on mount)
 *   - Confirmation message after block/unblock
 *
 * Never renders when targetUserId === currentUserId.
 *
 * Uses useTheme() for all colors and useTranslation('common') for all strings.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from 'react-native';

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
  const styles = makeStyles(theme);

  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockFeedback, setBlockFeedback] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Never render for own profile.
  if (targetUserId === currentUserId) return null;

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
    void loadBlockStatus();
  }, [loadBlockStatus]);

  // ── Block / Unblock ─────────────────────────────────────────────────────────

  const handleBlockToggle = useCallback(async (): Promise<void> => {
    setBlockLoading(true);
    setBlockError(null);
    setBlockFeedback(null);

    const wasBlocked = blocked;
    try {
      if (wasBlocked) {
        await unblockUser(targetUserId);
        setBlocked(false);
        setBlockFeedback(t('moderation.block.unblocked'));
        onUnblock?.();
      } else {
        await blockUser(targetUserId);
        setBlocked(true);
        setBlockFeedback(t('moderation.block.blocked'));
        onBlock?.();
      }
    } catch {
      setBlockError(t('moderation.block.error'));
    } finally {
      setBlockLoading(false);
    }
  }, [blocked, targetUserId, t, onBlock, onUnblock]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Report User button */}
      <Pressable
        style={styles.reportButton}
        onPress={() => setReportSheetVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('moderation.reportUser')}
      >
        <Text style={styles.reportButtonText}>{t('moderation.reportUser')}</Text>
      </Pressable>

      {/* Block / Unblock toggle */}
      {loadingStatus ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.primary}
          style={styles.blockLoader}
        />
      ) : (
        <Pressable
          style={[styles.blockButton, blocked && styles.blockButtonUnblock]}
          onPress={() => void handleBlockToggle()}
          disabled={blockLoading}
          accessibilityRole="button"
          accessibilityLabel={
            blocked ? t('moderation.unblockUser') : t('moderation.blockUser')
          }
          accessibilityState={{ disabled: blockLoading }}
        >
          {blockLoading ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.blockButtonText}>
              {blocked ? t('moderation.unblockUser') : t('moderation.blockUser')}
            </Text>
          )}
        </Pressable>
      )}

      {/* Feedback messages */}
      {blockFeedback !== null && (
        <Text style={styles.feedbackText}>{blockFeedback}</Text>
      )}
      {blockError !== null && (
        <Text style={styles.errorText}>{blockError}</Text>
      )}

      {/* Report sheet modal */}
      <ReportSheet
        targetUserId={targetUserId}
        visible={reportSheetVisible}
        onDismiss={() => setReportSheetVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    reportButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    reportButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    blockButton: {
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      backgroundColor: theme.colors.error,
    },
    blockButtonUnblock: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    blockButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    blockLoader: {
      paddingVertical: theme.spacing.sm,
    },
    feedbackText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.success,
      textAlign: 'center',
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });
}
