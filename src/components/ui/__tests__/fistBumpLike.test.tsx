/** FistBumpLike (v6 motion.md §10.3): onContact timing, playKey gating, interruption, reduce motion. */
import { act, render } from '@testing-library/react-native';
import React from 'react';

import { MotionProvider } from '../../../lib/motion';
import { FistBumpLike } from '../FistBumpLike';

const make = (reduceMotion = false) => {
  const onContact = jest.fn();
  const ui = (liked: boolean, playKey: number) => (
    <MotionProvider reduceMotion={reduceMotion}>
      <FistBumpLike liked={liked} playKey={playKey} size={28} color="#fff" onContact={onContact} />
    </MotionProvider>
  );
  return { onContact, ui };
};

describe('FistBumpLike', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls onContact at 120ms, not before', () => {
    const { onContact, ui } = make();
    const r = render(ui(false, 0));
    r.rerender(ui(true, 1));
    act(() => void jest.advanceTimersByTime(119));
    expect(onContact).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(2));
    expect(onContact).toHaveBeenCalledTimes(1);
  });

  it('does not bump when liked changes without playKey', () => {
    const { onContact, ui } = make();
    const r = render(ui(false, 0));
    r.rerender(ui(true, 0));
    act(() => void jest.advanceTimersByTime(1000));
    expect(onContact).not.toHaveBeenCalled();
  });

  it('interrupting before 120ms never calls onContact', () => {
    const { onContact, ui } = make();
    const r = render(ui(false, 0));
    r.rerender(ui(true, 1));
    act(() => void jest.advanceTimersByTime(60));
    r.rerender(ui(false, 1));
    act(() => void jest.advanceTimersByTime(1000));
    expect(onContact).not.toHaveBeenCalled();
  });

  it('reduce motion calls onContact at 0ms', () => {
    const { onContact, ui } = make(true);
    const r = render(ui(false, 0));
    r.rerender(ui(true, 1));
    expect(onContact).toHaveBeenCalledTimes(1);
  });
});
