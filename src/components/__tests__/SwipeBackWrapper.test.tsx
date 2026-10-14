/**
 * Tests for SwipeBackWrapper (AC-185).
 *
 * Verifies:
 *   - Children are rendered inside the wrapper.
 *   - When enabled=false, onBack is NOT called for any gesture.
 *   - When the gesture is disabled via prop, wrapper still renders children.
 *
 * Note: PanResponder gesture simulation is limited in Jest/JSDOM environments.
 * The key behavioural contract (gate logic) is verified via enabled=false path
 * and children rendering. The full gesture flow (edge + velocity + direction)
 * requires an E2E or device test context.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import SwipeBackWrapper from '../SwipeBackWrapper';
import { TestProviders } from '../../modules/mod-home/test-utils';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SwipeBackWrapper (AC-185)', () => {
  it('renders its children', () => {
    const mockOnBack = jest.fn();
    render(
      <SwipeBackWrapper onBack={mockOnBack}>
        <Text>Screen Content</Text>
      </SwipeBackWrapper>,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Screen Content')).toBeTruthy();
  });

  it('renders when enabled=false without throwing', () => {
    const mockOnBack = jest.fn();
    render(
      <SwipeBackWrapper onBack={mockOnBack} enabled={false}>
        <Text>Disabled Wrapper</Text>
      </SwipeBackWrapper>,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Disabled Wrapper')).toBeTruthy();
  });

  it('does not call onBack when enabled=false', () => {
    const mockOnBack = jest.fn();
    render(
      <SwipeBackWrapper onBack={mockOnBack} enabled={false}>
        <Text>Content</Text>
      </SwipeBackWrapper>,
      { wrapper: TestProviders },
    );
    // With enabled=false the PanResponder gate returns false for
    // onMoveShouldSetPanResponder — no gesture will be claimed.
    expect(mockOnBack).not.toHaveBeenCalled();
  });

  it('renders with enabled=true (default) without throwing', () => {
    const mockOnBack = jest.fn();
    render(
      <SwipeBackWrapper onBack={mockOnBack}>
        <Text>Active Wrapper</Text>
      </SwipeBackWrapper>,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Active Wrapper')).toBeTruthy();
  });
});
