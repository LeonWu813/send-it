/** Tape display values: fill only (no hair flag), white tape is visible on white cards (design §7). */
import { TAPE_DISPLAY } from '../tape';

describe('TAPE_DISPLAY', () => {
  it('light white tape is the stone fill #C9C3B8, dark white is unchanged', () => {
    expect(TAPE_DISPLAY.light.white.fill).toBe('#C9C3B8');
    expect(TAPE_DISPLAY.dark.white.fill).toBe('#F2EFE8');
  });

  it('no tape carries an outline flag', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const entry of Object.values(TAPE_DISPLAY[mode])) {
        expect(entry).not.toHaveProperty('hair');
      }
    }
  });
});
