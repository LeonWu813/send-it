/**
 * HomeScreen — Tab 1 content (AC-111, AC-112, AC-113, AC-114, AC-115, AC-123, AC-124).
 *
 * Three sections in order:
 *   1. Banners — horizontal scroll of static banner cards (AC-112).
 *   2. Saved Gyms — horizontal scroll strip; "View All" + per-gym tap (AC-113, AC-114, AC-115).
 *   3. Following Climbers — empty state placeholder until MOD-006 ships (AC-123, AC-124).
 *
 * Safe area:
 *   - Top inset applied to the scroll content container via makeStyles(theme, topInset).
 *   - Bottom inset is handled by AppShell's TabBar — not applied here.
 *
 * Cross-module imports:
 *   - fetchSavedGymIds() from mod-gym-directory public service (gym IDs only).
 *   - Gym details fetched inline via Supabase singleton (SELECT scoped to the
 *     saved IDs only — a read, acceptable per the cross-module import rule).
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BANNERS } from '../../../lib/banners';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import { fetchSavedGymIds } from '../../mod-gym-directory/gym-service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  session: Session;
  onViewAllGyms: () => void;
  onSelectGym: (gymId: string) => void;
}

/** Minimal gym shape needed for the saved-gyms strip. */
interface SavedGymItem {
  id: string;
  name: string;
  photo_url: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({
  session: _session,
  onViewAllGyms,
  onSelectGym,
}: HomeScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  // ── Saved Gyms state ────────────────────────────────────────────────────────
  const [savedGyms, setSavedGyms] = useState<SavedGymItem[]>([]);
  const [savedGymsLoading, setSavedGymsLoading] = useState(true);

  const loadSavedGyms = useCallback(async () => {
    setSavedGymsLoading(true);
    try {
      const ids = await fetchSavedGymIds();
      if (ids.length === 0) {
        setSavedGyms([]);
        return;
      }
      // Fetch minimal gym details for the saved IDs.
      // Per the cross-module import rule, this is a read-only SELECT on gyms
      // using the shared Supabase singleton — acceptable since MOD-012 owns the
      // Home read path and gym-service does not yet expose fetchGymsByIds().
      const { data, error } = await supabase
        .from('gyms')
        .select('id, name, photo_url')
        .in('id', ids);
      if (error) {
        setSavedGyms([]);
        return;
      }
      setSavedGyms((data as SavedGymItem[]) ?? []);
    } catch {
      setSavedGyms([]);
    } finally {
      setSavedGymsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedGyms();
  }, [loadSavedGyms]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section 1: Banners (AC-112) ─────────────────────────────────── */}
      {BANNERS.length > 0 && (
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bannerRow}
          >
            {BANNERS.map((banner) => (
              <View key={banner.id} style={styles.bannerCard}>
                <Image
                  source={banner.imageSource}
                  style={styles.bannerImage}
                  resizeMode="cover"
                  accessibilityLabel={t(banner.titleKey)}
                />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{t(banner.titleKey)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Section 2: Saved Gyms (AC-113, AC-114, AC-115) ─────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.savedGyms.title')}</Text>
          <Pressable
            onPress={onViewAllGyms}
            accessibilityRole="button"
            accessibilityLabel={t('home.savedGyms.viewAll')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>{t('home.savedGyms.viewAll')}</Text>
          </Pressable>
        </View>

        {!savedGymsLoading && savedGyms.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.savedGyms.empty')}</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gymStripRow}
          >
            {savedGyms.map((gym) => (
              <Pressable
                key={gym.id}
                style={styles.gymChip}
                onPress={() => onSelectGym(gym.id)}
                accessibilityRole="button"
                accessibilityLabel={gym.name}
              >
                {gym.photo_url ? (
                  <Image
                    source={{ uri: gym.photo_url }}
                    style={styles.gymChipImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.gymChipImagePlaceholder} />
                )}
                <Text style={styles.gymChipName} numberOfLines={2}>
                  {gym.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Section 3: Following Climbers (AC-123, AC-124) ──────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.following.title')}</Text>
        </View>
        {/* TODO: replace with MOD-006 public service call when MOD-006 is implemented */}
        <Text style={styles.emptyText}>{t('home.following.empty')}</Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    viewAllText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
    },
    // Banner styles
    bannerRow: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    bannerCard: {
      width: 280,
      height: 140,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    bannerOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.overlay,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    bannerTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    // Saved gym strip styles
    gymStripRow: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    gymChip: {
      width: 96,
      alignItems: 'center',
    },
    gymChipImage: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xs,
    },
    gymChipImagePlaceholder: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.xs,
    },
    gymChipName: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
  });
}
