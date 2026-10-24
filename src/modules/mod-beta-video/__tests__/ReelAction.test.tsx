/** ReelAction like (v6 fist bump): contact haptic, unlike haptic, press-only bump, no overflow clipping. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { setHapticDriver } from '../../../lib/haptics';
import { ThemeProvider } from '../../../lib/theme';
import { ReelAction } from '../components/ReelAction';

const haptic = jest.fn();
const wrap = (selected: boolean) => (
  <ThemeProvider>
    <ReelAction testID="like" accessibilityLabel="like" onPress={() => {}} fist likeMotion selected={selected} />
  </ThemeProvider>
);
let clock = 1_000_000;

describe('ReelAction like', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clock += 10_000;
    jest.setSystemTime(clock);
    haptic.mockClear();
    setHapticDriver({ play: haptic });
  });
  afterEach(() => jest.useRealTimers());

  it('plays toggle at contact (120ms), not on press', () => {
    const r = render(wrap(false));
    fireEvent.press(screen.getByTestId('like'));
    expect(haptic).not.toHaveBeenCalled();
    r.rerender(wrap(true));
    act(() => void jest.advanceTimersByTime(130));
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(haptic.mock.calls[0][0]).toBe('toggle');
  });

  it('plays select on unlike and no toggle', () => {
    const r = render(wrap(true));
    fireEvent.press(screen.getByTestId('like'));
    r.rerender(wrap(false));
    act(() => void jest.advanceTimersByTime(500));
    expect(haptic.mock.calls.map((c) => c[0])).toEqual(['select']);
  });

  it('does not bump when selected changes without a press (data sync)', () => {
    const r = render(wrap(false));
    r.rerender(wrap(true));
    act(() => void jest.advanceTimersByTime(500));
    expect(haptic).not.toHaveBeenCalled();
  });
});
