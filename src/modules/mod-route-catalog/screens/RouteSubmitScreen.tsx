/**
 * RouteSubmitScreen.
 *
 * Implements the match-before-create flow (US-003):
 *
 * Step 1 — Form: user selects grade + color + (optional) section label.
 * Step 2 — Match check: query active routes at gym with same grade + color.
 *           If matches found, present them and ask user to confirm it's a new route.
 * Step 3 — Photo: if no match or user confirms it's different, require a photo upload.
 * Step 4 — Submit: create the new route row.
 *
 * AC-020: match-before-create — present any existing active matches.
 * AC-021: block submission without a photo; show validation message.
 * AC-022: color selector restricted to fixed enum.
 * AC-023: grade selector restricted to V-scale only.
 */

import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
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

import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import {
  findMatchingActiveRoutes,
  submitRoute,
  uploadRoutePhoto,
} from '../route-service';
import type { RouteColor, RouteGrade, RouteSummary } from '../types';
import { ROUTE_COLORS, ROUTE_GRADES } from '../types';

type SubmitStep = 'form' | 'match-check' | 'photo' | 'submitting' | 'success';

interface RouteSubmitScreenProps {
  gymId: string;
  gymName: string;
  session: Session;
  onBack: () => void;
  onSuccess: (routeId: string) => void;
}

export default function RouteSubmitScreen({
  gymId,
  gymName,
  session,
  onBack,
  onSuccess,
}: RouteSubmitScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  // Form state
  const [selectedGrade, setSelectedGrade] = useState<RouteGrade | null>(null);
  const [selectedColor, setSelectedColor] = useState<RouteColor | null>(null);
  const [sectionLabel, setSectionLabel] = useState('');

  // Match check state
  const [matchedRoutes, setMatchedRoutes] = useState<RouteSummary[]>([]);
  const [isCheckingMatch, setIsCheckingMatch] = useState(false);

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission state
  const [step, setStep] = useState<SubmitStep>('form');
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ── Step 1: Form validation + match check trigger ──────────────────────────

  async function handleFormSubmit(): Promise<void> {
    setFormError(null);

    if (!selectedGrade) {
      setFormError(t('routes.submit.errors.gradeRequired'));
      return;
    }
    if (!selectedColor) {
      setFormError(t('routes.submit.errors.colorRequired'));
      return;
    }

    setIsCheckingMatch(true);
    try {
      const matches = await findMatchingActiveRoutes(
        gymId,
        selectedGrade,
        selectedColor,
      );
      setMatchedRoutes(matches);

      if (matches.length > 0) {
        setStep('match-check');
      } else {
        setStep('photo');
      }
    } catch {
      setFormError(t('routes.submit.errors.matchCheckFailed'));
    } finally {
      setIsCheckingMatch(false);
    }
  }

  // ── Step 2: Match check — user confirms it's a different route ─────────────

  function handleConfirmDifferentRoute(): void {
    setStep('photo');
  }

  function handleMatchSelected(routeId: string): void {
    // User identified the existing route — nothing to create; go back
    Alert.alert(
      t('routes.submit.matchIdentified.title'),
      t('routes.submit.matchIdentified.body'),
      [{ text: t('common.ok'), onPress: () => onBack() }],
    );
    void routeId; // routeId is available for future use (e.g. navigate to it)
  }

  // ── Step 3: Photo selection ────────────────────────────────────────────────

  async function handlePickPhoto(): Promise<void> {
    setPhotoError(null);

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setPhotoError(t('routes.submit.errors.photoPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(asset.mimeType ?? 'image/jpeg');
    }
  }

  async function handleCameraPhoto(): Promise<void> {
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

  // ── Step 4: Final submission ───────────────────────────────────────────────

  async function handleFinalSubmit(): Promise<void> {
    // AC-021: photo is required — block submission without one
    if (!photoUri) {
      setPhotoError(t('routes.submit.errors.photoRequired'));
      return;
    }
    if (!selectedGrade || !selectedColor) {
      // Should not reach here; guarded by step 1, but be defensive
      return;
    }

    setPhotoError(null);
    setStep('submitting');
    setIsUploading(true);

    try {
      const uploadedPhotoUrl = await uploadRoutePhoto(
        session.user.id,
        photoUri,
        photoMime,
      );

      const newRoute = await submitRoute(session.user.id, {
        gym_id: gymId,
        grade: selectedGrade,
        color_tag: selectedColor,
        photo_url: uploadedPhotoUrl,
        section_label: sectionLabel.trim() || null,
      });

      onSuccess(newRoute.id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('routes.submit.errors.submitFailed');
      Alert.alert(t('common.error'), message);
      // Return user to photo step so they can retry
      setStep('photo');
    } finally {
      setIsUploading(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderGradeSelector(): React.JSX.Element {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('routes.submit.gradeLabel')}</Text>
        <View style={styles.selectorGrid}>
          {ROUTE_GRADES.map((grade) => {
            const isSelected = selectedGrade === grade;
            return (
              <Pressable
                key={grade}
                style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                onPress={() => setSelectedGrade(grade)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={grade}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    isSelected && styles.selectorChipTextActive,
                  ]}
                >
                  {grade}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderColorSelector(): React.JSX.Element {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('routes.submit.colorLabel')}</Text>
        <View style={styles.selectorGrid}>
          {ROUTE_COLORS.map((color) => {
            const isSelected = selectedColor === color;
            return (
              <Pressable
                key={color}
                style={[
                  styles.colorChip,
                  isSelected && styles.colorChipSelected,
                ]}
                onPress={() => setSelectedColor(color)}
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
        </View>
      </View>
    );
  }

  // ── Step rendering ─────────────────────────────────────────────────────────

  if (step === 'form') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={onBack}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>

        <Text style={styles.screenTitle}>{t('routes.submit.title')}</Text>
        <Text style={styles.gymNameSubtitle}>{gymName}</Text>

        {renderGradeSelector()}
        {renderColorSelector()}

        {/* Section label (optional) */}
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

        {formError ? (
          <Text style={styles.errorText}>{formError}</Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            isCheckingMatch && styles.primaryButtonDisabled,
          ]}
          onPress={() => void handleFormSubmit()}
          disabled={isCheckingMatch}
          accessibilityRole="button"
          accessibilityLabel={t('routes.submit.checkMatches')}
          accessibilityState={{ disabled: isCheckingMatch }}
        >
          {isCheckingMatch ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t('routes.submit.checkMatches')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'match-check') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
      >
        <Pressable
          onPress={() => setStep('form')}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>

        <Text style={styles.screenTitle}>{t('routes.submit.matchCheck.title')}</Text>
        <Text style={styles.bodyText}>{t('routes.submit.matchCheck.body')}</Text>

        {matchedRoutes.map((matched) => (
          <Pressable
            key={matched.id}
            style={styles.matchCard}
            onPress={() => handleMatchSelected(matched.id)}
            accessibilityRole="button"
            accessibilityLabel={`${matched.grade} ${matched.color_tag} route`}
          >
            <Image
              source={{ uri: matched.photo_url }}
              style={styles.matchPhoto}
              resizeMode="cover"
            />
            <View style={styles.matchInfo}>
              <Text style={styles.matchGrade}>{matched.grade}</Text>
              <RouteColorBadge color={matched.color_tag} size="sm" />
              {matched.section_label ? (
                <Text style={styles.matchSection}>{matched.section_label}</Text>
              ) : null}
              <Text style={styles.matchDate}>
                {new Date(matched.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.matchCta}>
              {t('routes.submit.matchCheck.thisIsIt')}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.matchDifferentLabel}>
          {t('routes.submit.matchCheck.differentRoute')}
        </Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleConfirmDifferentRoute}
          accessibilityRole="button"
          accessibilityLabel={t('routes.submit.matchCheck.addNew')}
        >
          <Text style={styles.secondaryButtonText}>
            {t('routes.submit.matchCheck.addNew')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'photo') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
      >
        <Pressable
          onPress={() => setStep(matchedRoutes.length > 0 ? 'match-check' : 'form')}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>

        <Text style={styles.screenTitle}>{t('routes.submit.photo.title')}</Text>
        <Text style={styles.bodyText}>{t('routes.submit.photo.body')}</Text>

        {/* Summary of what's being submitted */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryGrade}>{selectedGrade}</Text>
          {selectedColor && <RouteColorBadge color={selectedColor} size="md" />}
          {sectionLabel.trim() ? (
            <Text style={styles.summarySection}>{sectionLabel.trim()}</Text>
          ) : null}
        </View>

        {/* Photo preview */}
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.photoPreview}
            resizeMode="cover"
            accessibilityLabel={t('routes.submit.photo.preview')}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>
              {t('routes.submit.photo.placeholder')}
            </Text>
          </View>
        )}

        {/* Photo buttons */}
        <View style={styles.photoButtonRow}>
          <Pressable
            style={[styles.secondaryButton, styles.photoButtonFlex]}
            onPress={() => void handleCameraPhoto()}
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

        {/* AC-021: photo required error */}
        {photoError ? (
          <Text style={styles.errorText}>{photoError}</Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            isUploading && styles.primaryButtonDisabled,
          ]}
          onPress={() => void handleFinalSubmit()}
          disabled={isUploading}
          accessibilityRole="button"
          accessibilityLabel={t('routes.submit.submitRoute')}
          accessibilityState={{ disabled: isUploading }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t('routes.submit.submitRoute')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // 'submitting' and 'success' states handled via callbacks/alerts;
  // show a loading screen while awaiting the server response
  return (
    <View style={styles.centeredContainer}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.loadingText}>{t('routes.submit.submitting')}</Text>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    backLink: {
      marginBottom: theme.spacing.md,
    },
    backLinkText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
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
    bodyText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
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
    selectorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    selectorChip: {
      paddingHorizontal: theme.spacing.sm + 4,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    selectorChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    selectorChipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.fontWeight.medium,
    },
    selectorChipTextActive: {
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
    secondaryButton: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm + 4,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    secondaryButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    // Match check step
    matchCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: theme.spacing.md,
    },
    matchPhoto: {
      width: '100%',
      height: 180,
      backgroundColor: theme.colors.surface,
    },
    matchInfo: {
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      flexWrap: 'wrap',
    },
    matchGrade: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    matchSection: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    matchDate: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textDisabled,
    },
    matchCta: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    matchDifferentLabel: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    // Photo step
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
    },
    summaryGrade: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    summarySection: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    photoPreview: {
      width: '100%',
      height: 260,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.md,
    },
    photoPlaceholder: {
      width: '100%',
      height: 200,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    photoPlaceholderText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textDisabled,
    },
    photoButtonRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    photoButtonFlex: {
      flex: 1,
    },
    loadingText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
    },
  });
}
