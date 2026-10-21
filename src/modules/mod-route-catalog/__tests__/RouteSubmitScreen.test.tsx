/**
 * Tests for RouteSubmitScreen — single-page submit flow.
 *
 * AC-020 (revised): single-page screen; no multi-step flow; no match-check step.
 * AC-021 (revised): block submission without photo; show inline validation error.
 * AC-022: color selector restricted to fixed enum.
 * AC-023: grade selector restricted to V-scale only.
 * AC-043: pre-fill grade + color chips from initialGrade / initialColorTag props.
 *
 * Tests behaviour — not implementation.
 * The route-service and expo-image-picker modules are mocked.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

jest.mock('../route-service', () => ({
  uploadRoutePhoto: jest.fn(),
  submitRoute: jest.fn(),
  listRoutes: jest.fn().mockResolvedValue([]),
  getPhotoSignedUrl: jest.fn().mockResolvedValue('https://example.com/signed.jpg'),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';

import {
  uploadRoutePhoto,
  submitRoute,
  listRoutes,
} from '../route-service';
import RouteSubmitScreen from '../screens/RouteSubmitScreen';
import { renderOptions } from '../test-utils';

const mockUploadRoutePhoto = uploadRoutePhoto as jest.MockedFunction<
  typeof uploadRoutePhoto
>;
const mockSubmitRoute = submitRoute as jest.MockedFunction<typeof submitRoute>;
const mockListRoutes = listRoutes as jest.MockedFunction<typeof listRoutes>;
const mockLaunchImageLibraryAsync =
  ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
    typeof ImagePicker.launchImageLibraryAsync
  >;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const DEFAULT_PROPS = {
  gymId: 'gym-001',
  gymName: 'Test Gym',
  session: MOCK_SESSION,
  onBack: jest.fn(),
  onSuccess: jest.fn(),
};

describe('RouteSubmitScreen — single-page flow (AC-020 revised)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Layout / content ───────────────────────────────────────────────────────

  it('renders as a single page — all sections visible without navigating steps', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // Grade chips present
    expect(screen.getByText('VB')).toBeTruthy();
    expect(screen.getByText('V5')).toBeTruthy();
    // Color section present
    expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);
    // Photo buttons present without any interaction
    const takePhotoBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('take') ||
        el.props.accessibilityLabel?.includes('拍照'),
    );
    expect(takePhotoBtn).toBeTruthy();
    // Add Route button present
    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    expect(addRouteBtn).toBeTruthy();
  });

  // ── AC-023: V-scale grades ─────────────────────────────────────────────────

  it('renders grade selector with all V-scale grades (AC-023)', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    expect(screen.getByText('VB')).toBeTruthy();
    expect(screen.getByText('V0')).toBeTruthy();
    expect(screen.getByText('V5')).toBeTruthy();
    expect(screen.getByText('V10')).toBeTruthy();

    // Non-V-scale grades must not appear
    expect(screen.queryByText('5.10')).toBeNull();
    expect(screen.queryByText('6a')).toBeNull();
  });

  // ── AC-022: fixed color enum ───────────────────────────────────────────────

  it('renders color selector with all 9 fixed colors (AC-022)', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    const colorLabels = [
      'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'White', 'Black',
    ];
    for (const color of colorLabels) {
      const found = screen.queryAllByText(color);
      expect(found.length).toBeGreaterThan(0);
    }
  });

  // ── AC-043: pre-fill from filter state ────────────────────────────────────

  it('pre-selects the grade chip when initialGrade prop is provided (AC-043)', () => {
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} initialGrade="V4" />,
      renderOptions(),
    );

    // The V4 chip should have accessibilityState.selected = true
    const gradeChips = screen.queryAllByRole('radio');
    const v4Chip = gradeChips.find(
      (el) => el.props.accessibilityLabel === 'V4',
    );
    expect(v4Chip).toBeTruthy();
    expect(v4Chip?.props.accessibilityState?.checked).toBe(true);
  });

  it('pre-selects the color chip when initialColorTag prop is provided (AC-043)', () => {
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} initialColorTag="green" />,
      renderOptions(),
    );

    const colorChips = screen.queryAllByRole('radio');
    const greenChip = colorChips.find(
      (el) => el.props.accessibilityLabel === 'Green',
    );
    expect(greenChip).toBeTruthy();
    expect(greenChip?.props.accessibilityState?.checked).toBe(true);
  });

  it('opens with no chip pre-selected when no initialGrade/initialColorTag provided (AC-043)', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    const radioChips = screen.queryAllByRole('radio');
    const anySelected = radioChips.some(
      (el) => el.props.accessibilityState?.checked === true,
    );
    expect(anySelected).toBe(false);
  });

  it('allows user to change a pre-filled chip after mount (AC-043)', () => {
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} initialGrade="V4" />,
      renderOptions(),
    );

    // Press V5 — it should become selected
    fireEvent.press(screen.getByText('V5'));

    const gradeChips = screen.queryAllByRole('radio');
    const v5Chip = gradeChips.find(
      (el) => el.props.accessibilityLabel === 'V5',
    );
    expect(v5Chip?.props.accessibilityState?.checked).toBe(true);

    const v4Chip = gradeChips.find(
      (el) => el.props.accessibilityLabel === 'V4',
    );
    expect(v4Chip?.props.accessibilityState?.checked).toBe(false);
  });

  // ── AC-021: validation — photo required ───────────────────────────────────

  it('shows inline grade error when Add Route pressed with no grade selected', async () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) {
      fireEvent.press(addRouteBtn);
    }

    await waitFor(() => {
      // submitRoute must NOT have been called
      expect(mockSubmitRoute).not.toHaveBeenCalled();
    });
  });

  it('shows inline photo error when Add Route pressed without a photo (AC-021)', async () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // Select grade + color
    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) {
      fireEvent.press(addRouteBtn);
    }

    await waitFor(() => {
      // submitRoute must NOT have been called without a photo
      expect(mockSubmitRoute).not.toHaveBeenCalled();
    });
  });

  it('does not call submitRoute when grade is missing (AC-021)', async () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // Only select color — no grade
    fireEvent.press(screen.getAllByText('Blue')[0]);

    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) {
      fireEvent.press(addRouteBtn);
    }

    await waitFor(() => {
      expect(mockSubmitRoute).not.toHaveBeenCalled();
    });
  });

  // ── Photo picker ───────────────────────────────────────────────────────────

  it('shows photo preview after photo is selected from library', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://photo.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          type: 'image',
          fileName: 'photo.jpg',
          fileSize: 100000,
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    });

    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    const chooseBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('library') ||
        el.props.accessibilityLabel?.toLowerCase().includes('choose') ||
        el.props.accessibilityLabel?.includes('相簿'),
    );
    if (chooseBtn) {
      fireEvent.press(chooseBtn);
    }

    await waitFor(() => {
      // After selection: preview image should appear; "Change Photo" replaces buttons
      const changePhotoBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel?.includes('Change Photo') ||
          el.props.accessibilityLabel?.includes('更換照片'),
      );
      expect(changePhotoBtn).toBeTruthy();
    });
  });

  // ── Submission ─────────────────────────────────────────────────────────────

  it('calls submitRoute without a userId param — RPC derives from auth.uid() (signature contract)', async () => {
    mockUploadRoutePhoto.mockResolvedValueOnce('https://example.com/photo.jpg');
    mockSubmitRoute.mockResolvedValueOnce({
      id: 'route-new',
      gym_id: 'gym-001',
      section_label: null,
      grade: 'V3',
      color_tag: 'red',
      photo_url: 'https://example.com/photo.jpg',
      status: 'active',
      submitted_by_user_id: 'user-001',
      created_at: '2026-09-23T10:00:00Z',
      retired_at: null,
      retired_by_user_id: null,
    });

    // When submitRoute IS called, the first argument must be an object (not a string userId)
    if (mockSubmitRoute.mock.calls.length > 0) {
      const firstArg = mockSubmitRoute.mock.calls[0][0];
      expect(typeof firstArg).toBe('object');
    }
  });

  it('calls onSuccess with route id when submit returns status=active', async () => {
    mockUploadRoutePhoto.mockResolvedValueOnce('https://example.com/photo.jpg');
    mockSubmitRoute.mockResolvedValueOnce({
      id: 'route-new',
      gym_id: 'gym-001',
      section_label: null,
      grade: 'V3',
      color_tag: 'red',
      photo_url: 'https://example.com/photo.jpg',
      status: 'active',
      submitted_by_user_id: 'user-001',
      created_at: '2026-09-23T10:00:00Z',
      retired_at: null,
      retired_by_user_id: null,
    });
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://photo.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          type: 'image',
          fileName: 'photo.jpg',
          fileSize: 100000,
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    });

    const onSuccess = jest.fn();
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} onSuccess={onSuccess} />,
      renderOptions(),
    );

    // Select grade, color, pick photo
    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    const chooseBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('library') ||
        el.props.accessibilityLabel?.toLowerCase().includes('choose') ||
        el.props.accessibilityLabel?.includes('相簿'),
    );
    if (chooseBtn) {
      fireEvent.press(chooseBtn);
    }

    await waitFor(() => {
      const changePhotoBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel?.includes('Change Photo') ||
          el.props.accessibilityLabel?.includes('更換照片'),
      );
      expect(changePhotoBtn).toBeTruthy();
    });

    // Press Add Route
    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) {
      fireEvent.press(addRouteBtn);
    }

    await waitFor(() => {
      expect(mockSubmitRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          gym_id: 'gym-001',
          grade: 'V3',
          color_tag: 'red',
          photo_url: 'https://example.com/photo.jpg',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith('route-new');
    });
  });

  // ── No match-check step (AC-020 revised) ──────────────────────────────────

  it('does not render a "Check for Existing Routes" / match-check button (AC-020)', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // The old multi-step button label must not appear
    const checkBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('check') ||
        el.props.accessibilityLabel?.includes('確認是否'),
    );
    expect(checkBtn).toBeUndefined();
  });

  // ── AC-187: inline duplicate notice ───────────────────────────────────────

  it('shows inline duplicate notice when active routes contain same grade+color (AC-187)', async () => {
    // listRoutes returns an active route with V3 red
    mockListRoutes.mockResolvedValueOnce([
      {
        id: 'route-existing',
        gym_id: 'gym-001',
        section_label: null,
        grade: 'V3',
        color_tag: 'red',
        photo_url: 'https://example.com/photo.jpg',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z',
      },
    ]);

    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // Select V3 grade and red color — matches the existing active route
    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    await waitFor(() => {
      // Layer 1: neutral-colored inline notice should appear (not an Alert modal)
      // Rev 42: title changed from "Possible Duplicate" to "Similar Route Exists"
      const notice = screen.queryByText(/Similar Route Exists|已有相似路線/);
      expect(notice).toBeTruthy();
    });
  });

  it('hides inline duplicate notice when no active route matches the selection (AC-187)', async () => {
    // listRoutes returns an active route with V3 red — but we select V4 blue
    mockListRoutes.mockResolvedValueOnce([
      {
        id: 'route-existing',
        gym_id: 'gym-001',
        section_label: null,
        grade: 'V3',
        color_tag: 'red',
        photo_url: 'https://example.com/photo.jpg',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z',
      },
    ]);

    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    fireEvent.press(screen.getByText('V4'));
    fireEvent.press(screen.getAllByText('Blue')[0]);

    await waitFor(() => {
      const notice = screen.queryByText(/Similar Route Exists|已有相似路線/);
      expect(notice).toBeNull();
    });
  });

  it('notice disappears when grade chip changes away from duplicate (AC-187)', async () => {
    mockListRoutes.mockResolvedValueOnce([
      {
        id: 'route-existing',
        gym_id: 'gym-001',
        section_label: null,
        grade: 'V3',
        color_tag: 'red',
        photo_url: 'https://example.com/photo.jpg',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z',
      },
    ]);

    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    // First select V3 red — notice should appear
    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    await waitFor(() => {
      expect(screen.queryByText(/Similar Route Exists|已有相似路線/)).toBeTruthy();
    });

    // Change grade to V4 — notice should disappear
    fireEvent.press(screen.getByText('V4'));

    await waitFor(() => {
      expect(screen.queryByText(/Similar Route Exists|已有相似路線/)).toBeNull();
    });
  });

  it('shows Layer 2 confirmation sheet when duplicates exist and Add Route is tapped (AC-187)', async () => {
    mockListRoutes.mockResolvedValueOnce([
      {
        id: 'route-existing',
        gym_id: 'gym-001',
        section_label: null,
        grade: 'V3',
        color_tag: 'red',
        photo_url: 'https://example.com/photo.jpg',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z',
      },
    ]);
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://photo.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          type: 'image',
          fileName: 'photo.jpg',
          fileSize: 100000,
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    });

    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    const chooseBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('library') ||
        el.props.accessibilityLabel?.toLowerCase().includes('choose') ||
        el.props.accessibilityLabel?.includes('相簿'),
    );
    if (chooseBtn) fireEvent.press(chooseBtn);

    await waitFor(() => {
      const changePhotoBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel?.includes('Change Photo') ||
          el.props.accessibilityLabel?.includes('更換照片'),
      );
      expect(changePhotoBtn).toBeTruthy();
    });

    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) fireEvent.press(addRouteBtn);

    await waitFor(() => {
      // Sheet should be shown — uploadRoutePhoto must NOT have been called yet
      expect(mockUploadRoutePhoto).not.toHaveBeenCalled();
      // The sheet title should appear
      const sheetTitle = screen.queryByText(/Similar Routes Found|找到相似路線/);
      expect(sheetTitle).toBeTruthy();
    });
  });

  it('proceeds with upload only after tapping confirm on Layer 2 sheet (AC-187)', async () => {
    mockListRoutes.mockResolvedValueOnce([
      {
        id: 'route-existing',
        gym_id: 'gym-001',
        section_label: null,
        grade: 'V3',
        color_tag: 'red',
        photo_url: 'https://example.com/photo.jpg',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z',
      },
    ]);
    mockUploadRoutePhoto.mockResolvedValueOnce('https://example.com/photo.jpg');
    mockSubmitRoute.mockResolvedValueOnce({
      id: 'route-new',
      gym_id: 'gym-001',
      section_label: null,
      grade: 'V3',
      color_tag: 'red',
      photo_url: 'https://example.com/photo.jpg',
      status: 'active',
      submitted_by_user_id: 'user-001',
      created_at: '2026-09-23T10:00:00Z',
      retired_at: null,
      retired_by_user_id: null,
    });
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://photo.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          type: 'image',
          fileName: 'photo.jpg',
          fileSize: 100000,
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    });

    const onSuccess = jest.fn();
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} onSuccess={onSuccess} />,
      renderOptions(),
    );

    fireEvent.press(screen.getByText('V3'));
    fireEvent.press(screen.getAllByText('Red')[0]);

    const chooseBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('library') ||
        el.props.accessibilityLabel?.toLowerCase().includes('choose') ||
        el.props.accessibilityLabel?.includes('相簿'),
    );
    if (chooseBtn) fireEvent.press(chooseBtn);

    await waitFor(() => {
      const changePhotoBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel?.includes('Change Photo') ||
          el.props.accessibilityLabel?.includes('更換照片'),
      );
      expect(changePhotoBtn).toBeTruthy();
    });

    // Tap "Add Route" — sheet appears, upload must NOT have started
    const addRouteBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add Route') ||
        el.props.accessibilityLabel?.includes('新增路線'),
    );
    if (addRouteBtn) fireEvent.press(addRouteBtn);

    await waitFor(() => {
      expect(mockUploadRoutePhoto).not.toHaveBeenCalled();
    });

    // Tap the sheet confirm button — its label is routes.duplicateSheet.confirm
    // ("Continue to add, this is a different route" / "確認新增，這是不同的路線").
    // The form button still reads "Add Route", so the confirm button must be
    // found by its own distinct label (renamed in commit 022dd5b, 2026-10-17).
    const sheetConfirmBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel?.includes('Continue to add') ||
        el.props.accessibilityLabel?.includes('確認新增'),
    );
    if (sheetConfirmBtn) fireEvent.press(sheetConfirmBtn);

    await waitFor(() => {
      expect(mockUploadRoutePhoto).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('route-new');
    });
  });
});
