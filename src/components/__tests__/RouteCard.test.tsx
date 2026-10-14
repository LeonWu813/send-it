/**
 * Tests for RouteCard (AC-183).
 *
 * Verifies:
 *   - Route name, grade, and optional gymName are rendered.
 *   - 48×48 thumbnail is rendered when photo_url is provided.
 *   - Placeholder is rendered when photo_url is null.
 *   - "New Beta" badge is rendered when hasNewBetaVideo is true.
 *   - "New Beta" badge is NOT rendered when hasNewBetaVideo is false/omitted.
 *   - onPress is called when the card is pressed.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import RouteCard from '../RouteCard';
import { TestProviders } from '../../modules/mod-home/test-utils';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_ROUTE = {
  id: 'route-001',
  name: 'Crimson Tide',
  grade: 'V5',
  photo_url: 'https://example.com/route.jpg',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RouteCard (AC-183)', () => {
  it('renders the route name and grade', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Crimson Tide')).toBeTruthy();
    expect(screen.getByText('V5')).toBeTruthy();
  });

  it('renders gymName when provided', () => {
    render(
      <RouteCard
        route={{ ...BASE_ROUTE, gymName: 'MegaSTONE' }}
        onPress={jest.fn()}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('MegaSTONE')).toBeTruthy();
  });

  it('does not render gymName when not provided', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('MegaSTONE')).toBeNull();
  });

  it('renders the thumbnail image when photo_url is provided', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    // Image with the route photo_url should be present.
    const images = screen.UNSAFE_queryAllByType(
      require('react-native').Image,
    );
    const thumbnail = images.find(
      (img) => img.props.source?.uri === BASE_ROUTE.photo_url,
    );
    expect(thumbnail).toBeTruthy();
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

  it('renders the "New Beta" badge when hasNewBetaVideo is true (AC-181)', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasNewBetaVideo />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('New Beta')).toBeTruthy();
  });

  it('does not render the "New Beta" badge when hasNewBetaVideo is false', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} hasNewBetaVideo={false} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('New Beta')).toBeNull();
  });

  it('does not render the "New Beta" badge when hasNewBetaVideo is omitted', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByText('New Beta')).toBeNull();
  });

  it('calls onPress when the card is pressed', () => {
    const mockOnPress = jest.fn();
    render(
      <RouteCard route={BASE_ROUTE} onPress={mockOnPress} />,
      { wrapper: TestProviders },
    );
    fireEvent.press(screen.getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders the card as an accessible button', () => {
    render(
      <RouteCard route={BASE_ROUTE} onPress={jest.fn()} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
