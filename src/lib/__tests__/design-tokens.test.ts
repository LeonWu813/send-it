import { ICON, iconName } from '../icons';
import { MOTION } from '../motion';
import { AVATAR_SIZE, COMPONENT_SIZE, DARK_PALETTE, LIGHT_PALETTE, STROKE } from '../theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glyphMap: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

describe('design tokens (design system v1.1)', () => {
  it('light and dark palettes have the same 57 keys', () => {
    expect(Object.keys(DARK_PALETTE).sort()).toEqual(Object.keys(LIGHT_PALETTE).sort());
    expect(Object.keys(LIGHT_PALETTE)).toHaveLength(57);
  });

  it('adds surfaceAltPressed and mediaTrack', () => {
    expect(LIGHT_PALETTE.surfaceAltPressed).toBe('#D1C5B1');
    expect(DARK_PALETTE.surfaceAltPressed).toBe('#4E4637');
    expect(LIGHT_PALETTE.mediaTrack).toBe('rgba(255,255,255,0.3)');
    expect(DARK_PALETTE.mediaTrack).toBe('rgba(255,255,255,0.3)');
  });

  it('exposes STROKE, AVATAR_SIZE and the new component sizes', () => {
    expect(STROKE.thin).toBe(1);
    expect(STROKE.emphasis).toBe(1.5);
    expect(AVATAR_SIZE).toEqual({ xs: 24, sm: 32, md: 48, xl: 96 });
    expect(COMPONENT_SIZE).toMatchObject({
      buttonSmMinHeight: 32,
      textFieldMinHeight: 48,
      emptyStateMaxWidth: 320,
      radioSize: 20,
      radioDot: 10,
      noticeBarWidth: 4,
      tapeSwatch: 11,
      tapeSwatchRadius: 3,
      tapePadH: { sm: 6, md: 10 },
      likeBurst: 84,
    });
  });

  it('has MOTION.shake and the 5s celebration hold', () => {
    expect(MOTION.shake).toEqual({ distancePt: 4, segments: 4 });
    expect(MOTION.duration.celebrationCard).toBe(5000);
  });
});

describe('ICON dictionary', () => {
  const glyphs: { concept: string; glyph: string }[] = [];
  Object.entries(ICON).forEach(([concept, entry]) => {
    Object.values(entry).forEach((glyph) => glyphs.push({ concept, glyph: glyph as string }));
  });

  it('only uses glyphs that exist in Ionicons', () => {
    glyphs.forEach(({ glyph }) => expect(glyphMap[glyph]).toBeDefined());
  });

  it('never uses *-sharp glyphs', () => {
    glyphs.forEach(({ glyph }) => expect(glyph.endsWith('-sharp')).toBe(false));
  });

  it('maps one glyph to one concept (outline + filled of the same concept excepted)', () => {
    const owner = new Map<string, string>();
    glyphs.forEach(({ concept, glyph }) => {
      const prev = owner.get(glyph);
      expect(prev === undefined || prev === concept).toBe(true);
      owner.set(glyph, concept);
    });
  });

  it('uses trophy (not flag) for a new top grade; flag is report', () => {
    expect(ICON.newTopGrade.filled).toBe('trophy');
    expect(ICON.report.filled).toBe('flag');
  });

  it('iconName picks the state glyph and falls back for line icons', () => {
    expect(iconName('bookmark')).toBe('bookmark-outline');
    expect(iconName('bookmark', true)).toBe('bookmark');
    expect(iconName('back', true)).toBe('chevron-back');
    expect(iconName('passwordVisibility', true)).toBe('eye-off-outline');
  });
});
