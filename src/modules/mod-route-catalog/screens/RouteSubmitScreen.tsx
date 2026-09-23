/**
 * RouteSubmitScreen — single-page route submit flow (AC-020 revised, AC-021 revised, AC-043).
 *
 * Single page containing:
 *   - Grade chips (all ROUTE_GRADES, horizontally scrollable)
 *   - Hold-color chips (all ROUTE_COLORS, with color dots)
 *   - Inline photo picker (Take Photo / Choose from Library); after selection
 *     shows a preview image and a "Change Photo" option instead of the buttons
 *   - Optional section-label text input
 *   - "Add Route" button that validates and submits via submitRoute() RPC
 *
 * No match-check step. No multi-step flow.
 *
 * AC-020 (revised): single-page submit, no client-side match-check step.
 * AC-021 (revised): block submission without photo; show inline validation error.
 * AC-022: color selector restricted to fixed enum.
 * AC-023: grade selector restricted to V-scale only.
 * AC-043: pre-fill grade + color from RouteListScreen filter state via optional props.
 */

import 'expo-blob';

import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import {
  submitRoute,
  uploadRoutePhoto,
} from '../route-service';
import type { RouteColor, RouteGrade } from '../types';
import { ROUTE_COLORS, ROUTE_GRADES } from '../types';

interface RouteSubmitScreenProps {
  gymId: string;
  gymName: string;
  session: Session;
  onBack: () => void;
  /**
   * Called when a route is submitted with status = 'active'.
   * Navigates to the route detail screen.
   */
  onSuccess: (routeId: string) => void;
  /**
   * AC-043: optional pre-fill from RouteListScreen filter state.
   * If set, the corresponding chip is pre-selected on mount (user may change it).
   */
  initialGrade?: RouteGrade;
  initialColorTag?: RouteColor;
}

export default function RouteSubmitScreen({
  gymId,
  gymName,
  session,
  onBack,
  onSuccess,
  initialGrade,
  initialColorTag,
}: RouteSubmitScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  // Form state — pre-filled from filter state if provided (AC-043)
  const [selectedGrade, setSelectedGrade] = useState<RouteGrade | null>(
    initialGrade ?? null,
  );
  const [selectedColor, setSelectedColor] = useState<RouteColor | null>(
    initialColorTag ?? null,
  );
  const [sectionLabel, setSectionLabel] = useState('');

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');

  // Validation / submission state
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Photo picker ───────────────────────────────────────────────────────────

  async function handleTakePhoto(): Promise<void> {
    setPhotoError(null);

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      setPhotoError(t('routes.submit.errors.cameraPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(asset.mimeType ?? 'image/jpeg');
    }
  }

  async function handlePickPhoto(): Promise<void> {
    setPhotoError(null);

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setPhotoError(t('routes.submit.errors.photoPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(asset.mimeType ?? 'image/jpeg');
    }
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  async function handleAddRoute(): Promise<void> {
    // Inline validation — show all missing-field errors at once
    let hasError = false;

    if (!selectedGrade) {
      setGradeError(t('routes.submit.errors.gradeRequired'));
      hasError = true;
    } else {
      setGradeError(null);
    }

    if (!selectedColor) {
      setColorError(t('routes.submit.errors.colorRequired'));
      hasError = true;
    } else {
      setColorError(null);
    }

    // AC-021: photo is required
    if (!photoUri) {
      setPhotoError(t('routes.submit.errors.photoRequired'));
      hasError = true;
    } else {
      setPhotoError(null);
    }

    if (hasError) return;

    // TypeScript narrowing — all three are now non-null
    const grade = selectedGrade!;
    const colorTag = selectedColor!;
    const uri = photoUri!;

    setIsSubmitting(true);

    try {
      const uploadedPhotoUrl = await uploadRoutePhoto(
        session.user.id,
        uri,
        photoMime,
      );

      const newRoute = await submitRoute({
        gym_id: gymId,
        grade,
        color_tag: colorTag,
        photo_url: uploadedPhotoUrl,
        section_label: sectionLabel.trim() || null,
      });

      if (newRoute.status === 'pending') {
        // Auto-approve is OFF: show the pending approval message then go back
        // to the route list (route is not active yet, so we can't navigate to detail).
        Alert.alert(
          t('routes.submit.title'),
          t('routeCatalog.pendingApproval'),
          [{ text: t('common.ok'), onPress: () => onBack() }],
        );
      } else {
        // Auto-approve is ON (default Phase 1): navigate to the new active route.
        onSuccess(newRoute.id);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('routes.submit.errors.submitFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back navigation */}
      <Pressable
        onPress={onBack}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
      </Pressable>

      <Text style={styles.screenTitle}>{t('routes.submit.title')}</Text>
      <Text style={styles.gymNameSubtitle}>{gymName}</Text>

      {/* Grade chips — AC-023: V-scale only */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('routes.submit.gradeLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {ROUTE_GRADES.map((grade) => {
            const isSelected = selectedGrade === grade;
            return (
              <Pressable
                key={grade}
                style={[styles.gradeChip, isSelected && styles.gradeChipActive]}
                onPress={() => {
                  setSelectedGrade(grade);
                  setGradeError(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={grade}
              >
                <Text
                  style={[
                    styles.gradeChipText,
                    isSelected && styles.gradeChipTextActive,
                  ]}
                >
                  {grade}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {gradeError ? (
          <Text style={styles.errorText}>{gradeError}</Text>
        ) : null}
      </View>

      {/* Hold-color chips — AC-022: fixed enum, with color dots */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('routes.submit.colorLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {ROUTE_COLORS.map((color) => {
            const isSelected = selectedColor === color;
            return (
              <Pressable
                key={color}
                style={[
                  styles.colorChip,
                  isSelected && styles.colorChipSelected,
                ]}
                onPress={() => {
                  setSelectedColor(color);
                  setColorError(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={color}
              >
                <RouteColorBadge color={color} size="sm" />
                {isSelected && (
                  <View style={styles.colorCheckmark}>
                    <Text style={styles.colorCheckmarkText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {colorError ? (
          <Text style={styles.errorText}>{colorError}</Text>
        ) : null}
      </View>

      {/* Inline photo picker — AC-021 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('routes.submit.photo.title')}</Text>

        {photoUri ? (
          /* Preview + Change Photo */
          <View>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoPreview}
              resizeMode="cover"
              accessibilityLabel={t('routes.submit.photo.preview')}
            />
            <Pressable
              style={styles.changePhotoButton}
              onPress={() => void handlePickPhoto()}
              accessibilityRole="button"
              accessibilityLabel={t('routeCatalog.submit.changePhoto')}
            >
              <Text style={styles.changePhotoText}>
                {t('routeCatalog.submit.changePhoto')}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Take Photo / Choose from Library buttons */
          <View style={styles.photoButtonRow}>
            <Pressable
              style={[styles.secondaryButton, styles.photoButtonFlex]}
              onPress={() => void handleTakePhoto()}
              accessibilityRole="button"
              accessibilityLabel={t('routes.submit.photo.takePhoto')}
            >
              <Text style={styles.secondaryButtonText}>
                {t('routes.submit.photo.takePhoto')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.photoButtonFlex]}
              onPress={() => void handlePickPhoto()}
              accessibilityRole="button"
              accessibilityLabel={t('routes.submit.photo.choosePhoto')}
            >
              <Text style={styles.secondaryButtonText}>
                {t('routes.submit.photo.choosePhoto')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* AC-021: inline photo-required error */}
        {photoError ? (
          <Text style={styles.errorText}>{photoError}</Text>
        ) : null}
      </View>

      {/* Optional section label */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {t('routes.submit.sectionLabel')}
        </Text>
        <TextInput
          style={styles.textInput}
          value={sectionLabel}
          onChangeText={setSectionLabel}
          placeholder={t('routes.submit.sectionPlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          maxLength={80}
          autoCorrect={false}
          accessibilityLabel={t('routes.submit.sectionLabel')}
        />
      </View>

      {/* Add Route button */}
      <Pressable
        style={[
          styles.primaryButton,
          isSubmitting && styles.primaryButtonDisabled,
        ]}
        onPress={() => void handleAddRoute()}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t('routeCatalog.submit.addRoute')}
        accessibilityState={{ disabled: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {t('routeCatalog.submit.addRoute')}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    backLink: {
      marginBottom: theme.spacing.md,
    },
    screenTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    gymNameSubtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
    },
    chipRow: {
      gap: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
    },
    gradeChip: {
      paddingHorizontal: theme.spacing.sm + 4,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    gradeChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    gradeChipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.fontWeight.medium,
    },
    gradeChipTextActive: {
      color: theme.colors.textInverse,
      fontWeight: theme.fontWeight.semibold,
    },
    colorChip: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 4,
    },
    colorChipSelected: {
      borderColor: theme.colors.primary,
    },
    colorCheckmark: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorCheckmarkText: {
      fontSize: 11,
      color: theme.colors.textInverse,
      fontWeight: theme.fontWeight.bold,
    },
    photoPreview: {
      width: '100%',
      height: 260,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.sm,
    },
    changePhotoButton: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    changePhotoText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    photoButtonRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    photoButtonFlex: {
      flex: 1,
    },
    secondaryButton: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm + 4,
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 4,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
  });
}
