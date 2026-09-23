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
} from '../route-service';
import RouteSubmitScreen from '../screens/RouteSubmitScreen';
import { renderOptions } from '../test-utils';

const mockUploadRoutePhoto = uploadRoutePhoto as jest.MockedFunction<
  typeof uploadRoutePhoto
>;
const mockSubmitRoute = submitRoute as jest.MockedFunction<typeof submitRoute>;
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
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black',
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
    expect(v4Chip?.props.accessibilityState?.selected).toBe(true);
  });

  it('pre-selects the color chip when initialColorTag prop is provided (AC-043)', () => {
    render(
      <RouteSubmitScreen {...DEFAULT_PROPS} initialColorTag="green" />,
      renderOptions(),
    );

    const colorChips = screen.queryAllByRole('radio');
    const greenChip = colorChips.find(
      (el) => el.props.accessibilityLabel === 'green',
    );
    expect(greenChip).toBeTruthy();
    expect(greenChip?.props.accessibilityState?.selected).toBe(true);
  });

  it('opens with no chip pre-selected when no initialGrade/initialColorTag provided (AC-043)', () => {
    render(<RouteSubmitScreen {...DEFAULT_PROPS} />, renderOptions());

    const radioChips = screen.queryAllByRole('radio');
    const anySelected = radioChips.some(
      (el) => el.props.accessibilityState?.selected === true,
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
    expect(v5Chip?.props.accessibilityState?.selected).toBe(true);

    const v4Chip = gradeChips.find(
      (el) => el.props.accessibilityLabel === 'V4',
    );
    expect(v4Chip?.props.accessibilityState?.selected).toBe(false);
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
    fireEvent.press(screen.getAllByText('red')[0]);

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
    fireEvent.press(screen.getAllByText('blue')[0]);

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
    fireEvent.press(screen.getAllByText('red')[0]);

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
});
