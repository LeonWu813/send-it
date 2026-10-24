/**
 * RouteSubmitScreen — single-page route submit flow (AC-020 revised, AC-021 revised, AC-043).
 *
 * Single page containing:
 *   - Grade chips (all ROUTE_GRADES, wrapped grid: RS-1, nothing hides off-screen)
 *   - Hold-color chips (all ROUTE_COLORS, with color dots)
 *   - Inline photo picker (Take Photo / Choose from Library); after selection
 *     shows a preview image and a "Change Photo" option instead of the buttons
 *   - Optional section-label text input
 *   - "Add Route" button that validates and submits via submitRoute() RPC
 *
 * No match-check step. No multi-step flow.
 *
 * AC-020 (revised): single-page submit, no client-side match-check step.
 * AC-021 (revised): block submission without photo; RS-1: the CTA is disabled until a photo is
 *   chosen and the photo field says why (inline, at the field).
 * AC-022: color selector restricted to fixed enum.
 * AC-023: grade selector restricted to V-scale only.
 * AC-043: pre-fill grade + color from RouteListScreen filter state via optional props.
 * AC-187 (revised, Rev 42): two-layer duplicate guard — inline notice + non-dismissable sheet.
 */

import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import RouteCard from '../../../components/RouteCard';
import type { RouteCardRoute } from '../../../components/RouteCard';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import { AppText, Button, Chip, IconButton, NoticeBox, TextField, useToast } from '../../../components/ui';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, useLayout, useTheme } from '../../../lib/theme';
import {
  listRoutes,
  submitRoute,
  uploadRoutePhoto,
} from '../route-service';
import { useAppHeader, useHideTabBar } from '@/lib/AppHeaderContext';
import { useTapeSwatch } from '../components/RouteColorBadge';
import type { RouteColor, RouteGrade, RouteSummary } from '../types';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);
  useHideTabBar();
  useAppHeader({ title: t('routes.submit.title'), onBack });

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
  const [submitFailed, setSubmitFailed] = useState(false);
  const toast = useToast();

  // Colour row: scroll the pre-selected chip into view on mount (centred), so the chosen value is visible.
  const colorScrollRef = useRef<ScrollView>(null);
  const colorLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const colorViewportWidth = useRef(0);
  const didScrollToColor = useRef(false);
  function scrollToSelectedColor(): void {
    if (didScrollToColor.current || !initialColorTag) return;
    const layout = colorLayouts.current[initialColorTag];
    if (!layout || colorViewportWidth.current === 0) return;
    didScrollToColor.current = true;
    colorScrollRef.current?.scrollTo({
      x: Math.max(0, layout.x + layout.width / 2 - colorViewportWidth.current / 2),
      animated: false,
    });
  }

  // AC-187 Layer 2: non-dismissable confirmation sheet state.
  const [showDuplicateSheet, setShowDuplicateSheet] = useState(false);

  // AC-187: client-side duplicate check against already-fetched active routes.
  // Fetch once on mount — no RPC per selection change.
  const [activeRoutes, setActiveRoutes] = useState<RouteSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listRoutes(gymId, { grade: null, colorTag: null }).then((routes) => {
      if (!cancelled) {
        setActiveRoutes(routes);
      }
    }).catch(() => {
      // Non-fatal: if we can't fetch, the notice simply won't appear.
    });
    return () => { cancelled = true; };
  }, [gymId]);

  // AC-187: derive the full list of matching duplicate candidates (not just a boolean).
  // Used by Layer 1 (notice count) and Layer 2 (RouteCard list in sheet).
  const duplicateCandidates = useMemo((): RouteSummary[] => {
    if (!selectedGrade || !selectedColor) return [];
    return activeRoutes.filter(
      (r) => r.grade === selectedGrade && r.color_tag === selectedColor,
    );
  }, [activeRoutes, selectedGrade, selectedColor]);

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

  /**
   * The actual upload + RPC call. Called either directly (no duplicates) or
   * after the user taps "Add Route" on the Layer 2 confirmation sheet.
   * Precondition: grade, color, and photoUri are all non-null (validated before call).
   */
  async function uploadAndSubmit(
    grade: RouteGrade,
    colorTag: RouteColor,
    uri: string,
  ): Promise<void> {
    setIsSubmitting(true);
    setSubmitFailed(false);
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
        // Auto-approve is OFF: confirm with a toast, then go back to the route list
        // (route is not active yet, so we can't navigate to detail).
        toast.show({ message: t('routeCatalog.pendingToast') });
        onBack();
      } else {
        // Auto-approve is ON (default Phase 1): navigate to the new active route.
        onSuccess(newRoute.id);
      }
    } catch {
      // Keep everything the user filled in; show the error callout above the submit button.
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

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

    // Narrowing guard — redundant with the hasError check above but makes the
    // compiler aware that all three values are non-null from this point on,
    // removing the need for non-null assertions on the rest of this function.
    if (!selectedGrade || !selectedColor || !photoUri) return;

    const grade = selectedGrade;
    const colorTag = selectedColor;
    const uri = photoUri;

    // AC-187 Layer 2: intercept before any photo upload begins.
    // If duplicate candidates exist, show the non-dismissable confirmation sheet
    // and stop here — uploadRoutePhoto() must NOT be called until the user confirms.
    if (duplicateCandidates.length > 0) {
      setShowDuplicateSheet(true);
      return;
    }

    // No duplicates — proceed immediately.
    await uploadAndSubmit(grade, colorTag, uri);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SwipeBackWrapper onBack={onBack} enabled={!isSubmitting}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="body" color="textSecondary">{gymName}</AppText>

      {/* Grade chips — AC-023: V-scale only */}
      <View>
        <AppText variant="pageSection" style={styles.sectionLabel}>{t('routes.submit.gradeLabel')}</AppText>
        <View style={styles.gradeGrid} accessibilityRole="radiogroup">
          {ROUTE_GRADES.map((grade) => (
            <Chip
              key={grade}
              variant="choice"
              label={grade}
              selected={selectedGrade === grade}
              onPress={() => {
                setSelectedGrade(grade);
                setGradeError(null);
              }}
            />
          ))}
        </View>
        {gradeError ? (
          <InlineFieldError message={gradeError} />
        ) : null}
      </View>

      {/* Hold-color picker — AC-022: fixed enum, tape swatches */}
      <View>
        <AppText variant="pageSection" style={styles.sectionLabel}>{t('routes.submit.colorLabel')}</AppText>
        <ScrollView
          ref={colorScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          accessibilityRole="radiogroup"
          onLayout={(e: LayoutChangeEvent) => {
            colorViewportWidth.current = e.nativeEvent.layout.width;
            scrollToSelectedColor();
          }}
        >
          {ROUTE_COLORS.map((color) => (
            <View
              key={color}
              onLayout={(e: LayoutChangeEvent) => {
                colorLayouts.current[color] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                scrollToSelectedColor();
              }}
            >
              <ColorOption
                color={color}
                selected={selectedColor === color}
                onPress={() => {
                  setSelectedColor(color);
                  setColorError(null);
                }}
              />
            </View>
          ))}
        </ScrollView>
        {colorError ? (
          <InlineFieldError message={colorError} />
        ) : null}
      </View>

      {/* Inline photo picker — AC-021 */}
      <View>
        <AppText variant="pageSection" style={styles.sectionLabel}>{t('routes.submit.photo.title')}</AppText>

        {photoUri ? (
          /* Preview + Change Photo */
          <View style={styles.photoBlock}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoPreview}
              resizeMode="cover"
              accessibilityLabel={t('routes.submit.photo.preview')}
              accessibilityIgnoresInvertColors
            />
            <Button
              variant="text"
              placement="centered"
              label={t('routeCatalog.submit.changePhoto')}
              onPress={() => void handlePickPhoto()}
            />
          </View>
        ) : (
          /* Take Photo / Choose from Library buttons */
          <View style={styles.photoButtonRow}>
            <View style={styles.photoButtonFlex}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label={t('routes.submit.photo.takePhoto')}
                onPress={() => void handleTakePhoto()}
              />
            </View>
            <View style={styles.photoButtonFlex}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label={t('routes.submit.photo.choosePhoto')}
                onPress={() => void handlePickPhoto()}
              />
            </View>
          </View>
        )}

        {/* AC-021 / RS-1: inline validation at the photo field. Permission errors in red; otherwise a
             neutral "required" line while no photo is chosen (the CTA below is disabled for that reason). */}
        {photoError ? (
          <InlineFieldError message={photoError} />
        ) : !photoUri ? (
          <AppText variant="footnote" color="textSecondary" style={styles.photoRequiredHint} testID="photo-required-hint">
            {t('routeCatalog.submit.photoRequired')}
          </AppText>
        ) : null}
      </View>

      {/* Optional section label */}
      <View>
        <TextField
          label={t('routes.submit.sectionLabel')}
          value={sectionLabel}
          onChangeText={setSectionLabel}
          placeholder={t('routeCatalog.submit.sectionPlaceholder')}
          maxLength={80}
          autoCorrect={false}
        />
      </View>

      {/* AC-187 Layer 1: inline warning notice (neutral container, warning icon + bold title) — reactive to grade/color selection */}
      {duplicateCandidates.length > 0 ? (
        <View>
          <NoticeBox
            tone="warning"
            title={t('routes.duplicateNotice.title')}
            message={t('routes.duplicateNotice.body', {
              grade: selectedGrade,
              color: t(`routeCatalog.colors.${selectedColor}`),
              count: duplicateCandidates.length,
            })}
          />
        </View>
      ) : null}

      {/* Submit failure: error callout above the button; the form keeps what the user filled in. */}
      {submitFailed ? (
        <NoticeBox
          tone="error"
          title={t('routes.submit.errors.submitFailedTitle')}
          message={t('routes.submit.errors.submitFailedBody')}
          focusOnAppear
        />
      ) : null}

      {/* Add Route button — disabled while submitting or until a photo is chosen (RS-1) */}
      <View>
        <Button
          variant="primary"
          fullWidth
          label={t('routeCatalog.submit.addRoute')}
          onPress={() => void handleAddRoute()}
          loading={isSubmitting}
          disabled={isSubmitting || !photoUri}
        />
      </View>
    </ScrollView>

    {/* AC-187 Layer 2: non-dismissable confirmation sheet shown when duplicates exist on submit.
        X button closes the sheet; swipe-to-dismiss and backdrop tap are intentionally blocked. */}
    <BottomSheet
      visible={showDuplicateSheet}
      onClose={() => setShowDuplicateSheet(false)}
      swipeable={false}
      dismissOnBackdrop={false}
      title={t('routes.duplicateSheet.title')}
      variant="content"
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            label={t('routes.duplicateSheet.confirm')}
            loading={isSubmitting}
            onPress={() => {
              setShowDuplicateSheet(false);
              // Narrowing guard — values were validated in handleAddRoute before
              // the sheet was shown, so this branch is unreachable at runtime.
              // The explicit guard lets the compiler verify non-null here too.
              if (!selectedGrade || !selectedColor || !photoUri) return;
              void uploadAndSubmit(selectedGrade, selectedColor, photoUri);
            }}
          />
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            label={t('routes.duplicateSheet.cancel')}
            disabled={isSubmitting}
            onPress={() => setShowDuplicateSheet(false)}
          />
        </View>
      }
    >
      {duplicateCandidates.map((candidate) => {
        const cardRoute: RouteCardRoute = {
          id: candidate.id,
          name: `${candidate.grade} ${t(`routeCatalog.colors.${candidate.color_tag}`)}${candidate.section_label ? ` (${candidate.section_label})` : ''}`,
          grade: candidate.grade,
          photo_url: candidate.photo_url,
          gymName: gymName,
          colorTag: candidate.color_tag,
          section: candidate.section_label ?? null,
        };
        return (
          <View key={candidate.id} style={{ marginBottom: theme.spacing.sm }}>
            <RouteCard route={cardRoute} onPress={() => {}} />
          </View>
        );
      })}
    </BottomSheet>
    </SwipeBackWrapper>
  );
}

/** Field-level validation message (error icon + text, never colour alone). */
function InlineFieldError({ message }: { message: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.layout.iconTextGap, marginTop: theme.spacing.xs }}>
      <Ionicons name={ICON.error.outline} size={theme.iconSize.sm} color={theme.colors.error} />
      <AppText variant="footnote" color="error" style={{ flex: 1 }}>{message}</AppText>
    </View>
  );
}

/** Tape colour option for the picker: inverted Chip with a 14x14 tape swatch (v2.2). */
function ColorOption({
  color,
  selected,
  onPress,
}: {
  color: RouteColor;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('common');
  const swatch = useTapeSwatch(color);
  return (
    <Chip
      variant="choice"
      label={t(`routeCatalog.colors.${color}`)}
      swatch={swatch.fill}
      selected={selected}
      onPress={onPress}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    // R0: the scroll container owns the margin and the gaps; sections set none.
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
      gap: theme.layout.sectionGap,
    },
    sectionLabel: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    chipRow: {
      columnGap: theme.layout.inlineGap,
      paddingRight: theme.spacing.sm,
    },
    gradeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.layout.inlineGap,
      rowGap: theme.layout.inlineGap,
    },
    photoBlock: {
      gap: theme.spacing.sm,
    },
    photoPreview: {
      width: '100%',
      height: 260,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      backgroundColor: theme.colors.surfaceAlt,
    },
    photoButtonRow: {
      flexDirection: 'row',
      gap: theme.layout.inlineGap,
    },
    photoButtonFlex: {
      flex: 1,
    },
    photoRequiredHint: {
      marginTop: theme.spacing.xs,
    },
  });
}
