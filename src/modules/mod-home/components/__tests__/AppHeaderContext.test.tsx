/**
 * AppHeaderContext — registration API for nested screens (design system v2.2 §30).
 */
jest.mock('../../../mod-notifications/UnreadCountProvider', () => ({
  useUnreadCount: () => 0,
}));

import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppHeaderProvider, AppHeaderStore, AppHeaderTabScope, useAppHeader } from '../AppHeaderContext';

function Screen({ title, onBack }: { title: string; onBack?: () => void }): null {
  useAppHeader({ title, onBack });
  return null;
}

describe('useAppHeader', () => {
  it('registers per tab, the latest mount wins, and unmount restores the previous', () => {
    const store = new AppHeaderStore(0, 0);
    const wrap = (children: React.ReactNode, tab: 'home' | 'gyms' = 'gyms') => (
      <AppHeaderProvider value={store}>
        <AppHeaderTabScope tab={tab}>{children}</AppHeaderTabScope>
      </AppHeaderProvider>
    );
    const back = jest.fn();
    const list = render(wrap(<Screen title="List" onBack={back} />));
    expect(store.top('gyms')?.config.title).toBe('List');
    expect(store.top('home')).toBeUndefined();
    const detail = render(wrap(<Screen title="Detail" onBack={back} />));
    expect(store.top('gyms')?.config.title).toBe('Detail');
    detail.unmount();
    expect(store.top('gyms')?.config.title).toBe('List');
    list.unmount();
    expect(store.top('gyms')).toBeUndefined();
  });

  it('is a no-op outside AppShell', () => {
    expect(() => render(<Screen title="x" />)).not.toThrow();
  });
});

describe('AppHeaderOverlayScope', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppHeaderOverlayScope } = require('../AppHeaderOverlayScope');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TestProviders } = require('../../test-utils');
  const { useTabBarInset, useHideTabBar } = require('../AppHeaderContext');

  function Probe({ onBack }: { onBack: () => void }): React.JSX.Element {
    useAppHeader({ title: 'Settings', onBack });
    useHideTabBar();
    const inset = useTabBarInset();
    return <Text>{`inset:${inset.contentBottom}`}</Text>;
  }

  it('renders a nested header from useAppHeader, zero tab-bar inset, and does not touch the tab store', () => {
    const tabStore = new AppHeaderStore(0, 34);
    const onBack = jest.fn();
    render(
      <AppHeaderProvider value={tabStore}>
        <AppHeaderTabScope tab="home">
          <AppHeaderOverlayScope topInset={0} bottomInset={34} onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()}>
            <Probe onBack={onBack} />
          </AppHeaderOverlayScope>
        </AppHeaderTabScope>
      </AppHeaderProvider>,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('inset:0')).toBeTruthy();
    expect(tabStore.top('home')).toBeUndefined();
    expect(tabStore.isTabBarHidden('home')).toBe(false);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders no header when nothing registers', () => {
    render(
      <AppHeaderOverlayScope topInset={0} bottomInset={0} onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()}>
        <Text>body</Text>
      </AppHeaderOverlayScope>,
      { wrapper: TestProviders },
    );
    expect(screen.queryByLabelText('Back')).toBeNull();
    expect(screen.getByText('body')).toBeTruthy();
  });
});
