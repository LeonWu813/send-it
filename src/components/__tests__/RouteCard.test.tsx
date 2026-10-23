/**
 * Tests for RouteCard (AC-183, Rev 39/40).
 *
 * Verifies:
 *   - Route name is rendered; gymName is NOT drawn (AC-192) but VoiceOver reads it.
 *   - Grade label is NOT rendered in the card UI (AC-191).
 *   - 80×80 thumbnail is rendered on the RIGHT when photo_url is provided (AC-192).
 *   - Placeholder is rendered on the RIGHT when photo_url is null.
 *   - Beta count subtitle is rendered when betaVideoCount > 0 (AC-189).
 *   - Beta count subtitle is NOT rendered when betaVideoCount === 0.
 *   - Flash send icon is rendered when hasSend + sendStyle 'flash' (AC-190).
 *   - Top send icon is rendered when hasSend + sendStyle 'top' (AC-190).
 *   - Send icon is NOT rendered when hasSend is false.
 *   - Bookmark icon (outline) is rendered when isSaved is false (AC-046/047).
 *   - Bookmark icon (filled) is rendered when isSaved is true (AC-046/047).
 *   - onBookmarkToggle is called when bookmark is pressed; onPress is NOT called.
 *   - onPress is called when the card is pressed.
 *   - hasNewBetaVideo prop no longer exists — no "New Beta" badge rendered (AC-181).
 *   - sendBadge pill replaced by inline icon next to route name (layout redesign).
 *   - Thumbnail is on the RIGHT; name, status, beta count and bookmark are in the left column.
 *   - Bookmark is an IconButton toggle (primary when saved, textSecondary when unsaved).
 */

// ── Module mocks (must appear before imports) ─────────────────────────────────

// RouteCard imports getPhotoSignedUrl from route-service, which transitively
// imports supabase and throws if env vars are absent. Mock the whole module so
// the component tests can run without a real Supabase instance.
jest.mock('../../modules/mod-route-catalog/route-service', () => ({
  getPhotoSignedUrl: jest.fn().mockResolvedValue('https://example.com/signed.jpg'),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import RouteCard from '../RouteCard';
import { TestProviders } from '../../modules/mod-home/test-utils';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Visual-only content (name, beta count, status icon) is layered above the card body and hidden
// from VoiceOver (the body label carries it), so tests query hidden elements explicitly.
const HIDDEN = { includeHiddenElements: true };

const BASE_ROUTE = {
  id: 'route-001',
  name: 'Crimson Tide',
  grade: 'V5',
  photo_url: 'https://example.com/route.jpg',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

// The jest preset reports fontScale 2 (AX layout: thumbnail hidden). Tests default to the regular layout.
const SCREEN = { width: 375, height: 812, scale: 2, fontScale: 1 };

describe('RouteCard (AC-183, v2.2)', () => {
  beforeEach(() => {
    Dimensions.set({ window: SCREEN, screen: SCREEN });
  });

  it('renders the route name', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Crimson Tide', HIDDEN)).toBeTruthy();
  });

  it('prints the grade on the tape badge as the headline (v2.2, overrides AC-191)', () => {
    render(
      <RouteCard route={{ ...BASE_ROUTE, colorTag: 'red' }} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('V5', HIDDEN)).toBeTruthy();
  });

  it('hides the thumbnail at accessibility font scales (>= 1.6)', () => {
    Dimensions.set({ window: { ...SCREEN, fontScale: 2 }, screen: { ...SCREEN, fontScale: 2 } });
    render(<RouteCard route={BASE_ROUTE} onPress={jest.fn()} />, { wrapper: TestProviders });
    expect(screen.UNSAFE_queryAllByType(require('react-native').Image)).toHaveLength(0);
  });

  it('shows the image placeholder icon when there is no photo', () => {
    render(<RouteCard route={{ ...BASE_ROUTE, photo_url: null }} onPress={jest.fn()} />, { wrapper: TestProviders });
    expect(screen.getByTestId('thumb-placeholder', HIDDEN)).toBeTruthy();
  });

  it('shows the 「play n」 chip on the thumbnail with beta videos, hidden from VoiceOver (audit #4)', () => {
    const { rerender } = render(<RouteCard route={BASE_ROUTE} onPress={jest.fn()} betaVideoCount={2} />, { wrapper: TestProviders });
    expect(screen.queryByTestId('play-disc')).toBeNull();
    expect(screen.getByTestId('play-disc', HIDDEN)).toBeTruthy();
    expect(screen.getByText('2', HIDDEN)).toBeTruthy();
    rerender(<RouteCard route={BASE_ROUTE} onPress={jest.fn()} betaVideoCount={0} />);
    expect(screen.queryByTestId('play-disc', HIDDEN)).toBeNull();
  });

  it('draws the gym after the section on cross-gym lists and VoiceOver reads it', () => {
    render(
      <RouteCard
        route={{ ...BASE_ROUTE, gymName: 'MegaSTONE' }}
        onPress={jest.fn()}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText(/MegaSTONE/, HIDDEN)).toBeTruthy();
    expect(screen.getByLabelText(/MegaSTONE/)).toBeTruthy();
  });

  it('omits the gym from the VoiceOver label when not provided', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByLabelText(/MegaSTONE/)).toBeNull();
  });

  it('composes the one-sentence VoiceOver label: grade, colour, section, gym, status, beta count', () => {
    render(
      <RouteCard
        route={{ ...BASE_ROUTE, colorTag: 'red', section: 'A', gymName: 'MegaSTONE' }}
        onPress={jest.fn()}
        hasSend
        sendStyle="flash"
        betaVideoCount={3}
      />,
      { wrapper: TestProviders },
    );
    expect(
      screen.getByLabelText('V5, Red, A. MegaSTONE. Flashed. 3 Beta Videos'),
    ).toBeTruthy();
  });

  it('renders the thumbnail image when photo_url is provided (88×88)', async () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    // getPhotoSignedUrl is mocked to resolve to a signed URL asynchronously.
    // Wait for the state update that sets signedPhotoUrl.
    await waitFor(() => {
      const images = screen.UNSAFE_queryAllByType(
        require('react-native').Image,
      );
      const thumbnail = images.find(
        (img) => img.props.source?.uri === 'https://example.com/signed.jpg',
      );
      expect(thumbnail).toBeTruthy();
    });
  });

  it('renders a placeholder when photo_url is null', () => {
    const noPhotoRoute = { ...BASE_ROUTE, photo_url: null };
    render(
      <RouteCard route={noPhotoRoute} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    // No Image with a uri should exist.
    const images = screen.UNSAFE_queryAllByType(
      require('react-native').Image,
    );
    const uriImage = images.find((img) => img.props.source?.uri !== undefined);
    expect(uriImage).toBeUndefined();
  });

  // ── AC-189: betaVideoCount ─────────────────────────────────────────────────

  it('carries the beta count on the thumbnail chip, not as a text line (AC-189, audit #4)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} betaVideoCount={3} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('3', HIDDEN)).toBeTruthy();
    expect(screen.queryByText('3 Beta Videos', HIDDEN)).toBeNull();
  });

  it('does not render the beta count subtitle when betaVideoCount === 0 (AC-189)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} betaVideoCount={0} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText(/Beta Videos/, HIDDEN)).toBeNull();
  });

  it('does not render the beta count subtitle when betaVideoCount is omitted (AC-189)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText(/Beta Videos/, HIDDEN)).toBeNull();
  });

  // ── AC-190: send icon (inline, next to route name) ─────────────────────────
  // The old sendBadge pill (text "Flash" / "Top") has been replaced by an
  // inline Ionicons icon in the nameRow. Tests use testID="send-status" to assert
  // presence/absence of the icon element.

  it('renders the send icon when hasSend + sendStyle flash (AC-190)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasSend sendStyle="flash" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByTestId('send-status', HIDDEN)).toBeTruthy();
  });

  it('renders the send icon when hasSend + sendStyle top (AC-190)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasSend sendStyle="top" />,
      { wrapper: TestProviders },
    );
    expect(screen.getByTestId('send-status', HIDDEN)).toBeTruthy();
  });

  it('does not render the send icon when hasSend is false (AC-190)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasSend={false} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByTestId('send-status', HIDDEN)).toBeNull();
  });

  it('does not render the send icon when hasSend is omitted (AC-190)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByTestId('send-status', HIDDEN)).toBeNull();
  });

  // Old text-based send badge assertions — verify the old "Flash"/"Top" text
  // no longer appears (pill removed; icon only now).
  it('does not render "Flash" text (send icon replaced old pill badge)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasSend sendStyle="flash" />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('Flash')).toBeNull();
  });

  it('does not render "Top" text (send icon replaced old pill badge)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasSend sendStyle="top" />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('Top')).toBeNull();
  });

  // ── AC-046/047: bookmark ───────────────────────────────────────────────────

  it('renders the bookmark button with unsaved accessibility label when isSaved is false (AC-046/047)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} isSaved={false} />,
      { wrapper: TestProviders },
    );
    // The bookmark Pressable has accessibilityLabel={t('routeCard.unsaved')} = "Save".
    expect(screen.getByLabelText('Save')).toBeTruthy();
  });

  it('renders the bookmark button with saved accessibility label when isSaved is true (AC-046/047)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} isSaved />,
      { wrapper: TestProviders },
    );
    // The bookmark Pressable has accessibilityLabel={t('routeCard.saved')} = "Saved".
    expect(screen.getByLabelText('Saved')).toBeTruthy();
  });

  it('calls onBookmarkToggle when the bookmark icon is pressed (AC-046/047)', () => {
    const mockToggle = jest.fn();
    const mockOnPress = jest.fn();
    render(
      <RouteCard
        route={BASE_ROUTE}
        onPress={mockOnPress}
        isSaved={false}
        onBookmarkToggle={mockToggle}
      />,
      { wrapper: TestProviders },
    );
    fireEvent.press(screen.getByLabelText('Save'));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  // ── AC-181: "New Beta" chip removed ────────────────────────────────────────

  it('never renders a "New Beta" badge (AC-181 — chip removed)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('New Beta')).toBeNull();
    expect(screen.queryByText('新 Beta')).toBeNull();
  });

  // ── Card interaction ───────────────────────────────────────────────────────

  it('calls onPress when the card is pressed', () => {
    const mockOnPress = jest.fn();
    render(
      <RouteCard route={BASE_ROUTE} onPress={mockOnPress} />,
      { wrapper: TestProviders },
    );
    // Press the card itself via its accessibilityLabel (route name, AC-191).
    fireEvent.press(screen.getByLabelText(/Crimson Tide/));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders the card as an accessible button with route name as label (AC-191)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    // The card body reads grade + name (the grade is hidden on screen but spoken, AC-191).
    expect(screen.getByLabelText(/Crimson Tide/)).toBeTruthy();
  });

  it('is the 80pt compact card by default and 104pt with variant="regular" (RL-1)', () => {
    const minHeightOf = (variant?: 'compact' | 'regular'): number[] => {
      const { toJSON, unmount } = render(<RouteCard route={BASE_ROUTE} onPress={jest.fn()} variant={variant} />, {
        wrapper: TestProviders,
      });
      const found = [...JSON.stringify(toJSON()).matchAll(/"minHeight":(\d+)/g)].map((m) => Number(m[1]));
      unmount();
      return found;
    };
    expect(minHeightOf()).toContain(80);
    expect(minHeightOf('regular')).toContain(104);
  });
});
