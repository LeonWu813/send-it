/**
 * Tests for TabBar component (MOD-012).
 *
 * Tests behaviour: renders all three tabs, calls onTabPress with the correct
 * tab key, and reflects the active tab via accessibilityState.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// @expo/vector-icons renders native icon components that are unavailable in Jest.
// Mock the Ionicons component to render nothing so tests can focus on behaviour.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import TabBar from '../components/TabBar';
import { renderOptions } from '../test-utils';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TabBar', () => {
  it('renders all three tab labels with correct accessibility roles', () => {
    render(
      <TabBar activeTab="home" onTabPress={jest.fn()} bottomInset={0} />,
      renderOptions(),
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('marks the active tab as selected via accessibilityState', () => {
    render(
      <TabBar activeTab="gyms" onTabPress={jest.fn()} bottomInset={0} />,
      renderOptions(),
    );

    const gymsTab = screen.getByLabelText('Gyms');
    expect(gymsTab.props.accessibilityState?.selected).toBe(true);

    const homeTab = screen.getByLabelText('Home');
    expect(homeTab.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onTabPress with "home" when the Home tab is pressed', () => {
    const onTabPress = jest.fn();
    render(
      <TabBar activeTab="gyms" onTabPress={onTabPress} bottomInset={0} />,
      renderOptions(),
    );

    fireEvent.press(screen.getByLabelText('Home'));
    expect(onTabPress).toHaveBeenCalledWith('home');
  });

  it('calls onTabPress with "gyms" when the Gyms tab is pressed', () => {
    const onTabPress = jest.fn();
    render(
      <TabBar activeTab="home" onTabPress={onTabPress} bottomInset={0} />,
      renderOptions(),
    );

    fireEvent.press(screen.getByLabelText('Gyms'));
    expect(onTabPress).toHaveBeenCalledWith('gyms');
  });

  it('calls onTabPress with "profile" when the Profile tab is pressed', () => {
    const onTabPress = jest.fn();
    render(
      <TabBar activeTab="home" onTabPress={onTabPress} bottomInset={0} />,
      renderOptions(),
    );

    fireEvent.press(screen.getByLabelText('Profile'));
    expect(onTabPress).toHaveBeenCalledWith('profile');
  });
});
