/**
 * AppHeaderContext — registration API for nested screens (design system v2.2 §30).
 */
import React from 'react';
import { render } from '@testing-library/react-native';

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
