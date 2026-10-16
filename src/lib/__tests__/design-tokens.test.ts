import { ICON, iconName } from '../icons';
import { MOTION } from '../motion';
import { AVATAR_SIZE, COMPONENT_SIZE, DARK_PALETTE, ELEVATION, ELEVATION_DARK, LAYOUT, LIGHT_PALETTE, RADIUS, STROKE, TYPE_SCALE, TYPE_VARIANT, innerRadius } from '../theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glyphMap: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

describe('design tokens (design system v2.2)', () => {
  it('light and dark palettes have the same 58 keys', () => {
    expect(Object.keys(DARK_PALETTE).sort()).toEqual(Object.keys(LIGHT_PALETTE).sort());
    expect(Object.keys(LIGHT_PALETTE)).toHaveLength(58);
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
    expect(AVATAR_SIZE).toEqual({ xs: 24, sm: 32, md: 48, lg: 64, xl: 96 });
    expect(COMPONENT_SIZE).toMatchObject({
      buttonSmMinHeight: 32,
      textFieldMinHeight: 48,
      emptyStateMaxWidth: 320,
      radioSize: 20,
      radioDot: 10,
      noticeBarWidth: 4,
      tapeSwatch: 14,
      tapePadH: { sm: 6, md: 8, lg: 10 },
      tapeHeight: { sm: 20, md: 24, lg: 34 },
      chipHeight: 36,
      buttonPrimaryMinHeight: 52,
      progressBarHeight: 6,
      segmentedHeight: { compact: 32, standard: 36, icon: 68 },
      stepperHeight: 56,
      stepperMin: 1,
      stepperMax: 9999,
      smallButton: 30,
      listThumb: 56,
      routeThumb: 88,
      likeBurst: 84,
    });
  });

  it('has the v2.2 radius roles and innerRadius', () => {
    expect(RADIUS).toEqual({ minor: 4, tape: 6, control: 12, media: 12, card: 20, sheet: 32, full: 9999 });
    expect(innerRadius(RADIUS.card, 8)).toBe(12);
    expect(innerRadius(RADIUS.card, 16)).toBe(4);
    expect(innerRadius(RADIUS.control, 30)).toBe(RADIUS.minor);
  });

  it('adds segmentedThumb, the control elevation and layout sizes', () => {
    expect(LIGHT_PALETTE.segmentedThumb).toBe('#FFFFFF');
    expect(DARK_PALETTE.segmentedThumb).toBe('#4E4637');
    expect(ELEVATION.control.shadowOpacity).toBe(0.1);
    expect(ELEVATION_DARK.control.shadowOpacity).toBe(0);
    expect(LAYOUT).toMatchObject({ listRowPaddingV: 14, listRowMinHeight: 52, sheetInset: 8, routeCardPadding: 8, mediaGridGapInset: 2 });
  });

  it('adds the display / numeric1 type roles and derived variants', () => {
    expect(TYPE_SCALE.display).toMatchObject({ fontSize: 72, lineHeight: 76, fontWeight: '700', maxFontSizeMultiplier: 1.2 });
    expect(TYPE_SCALE.numeric1).toMatchObject({ fontSize: 34, lineHeight: 40 });
    expect(TYPE_VARIANT.pageSection.base).toBe('title3');
    expect(TYPE_VARIANT.sectionHeader).toBe(TYPE_VARIANT.groupHeader);
    expect(TYPE_VARIANT.tapeLabel.lg.fontWeight).toBe('800');
    expect(TYPE_VARIANT.fieldLabel.fontWeight).toBe('600');
  });

  it('has the v2.2 motion tokens', () => {
    expect(MOTION.duration.press).toBe(100);
    expect(MOTION.duration.release).toBe(120);
    expect(MOTION.spring.glide).toEqual({ stiffness: 380, damping: 34, mass: 1 });
    expect(MOTION.scale.pressWide).toBe(0.98);
    expect(MOTION.distance).toEqual({ sheetFloatEnter: 24, toastEnter: 8, stepperDigit: 6, bookmarkDrop: 2 });
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

  it('has the A10 glyphs', () => {
    expect(ICON.remove.outline).toBe('remove');
    expect(ICON.add.outline).toBe('add');
    expect(ICON.image.outline).toBe('image-outline');
    expect(ICON.betaCount.outline).toBe('play-circle-outline');
    expect(ICON.share.outline).toBe('share-outline');
    expect(ICON.locked.outline).toBe('lock-closed-outline');
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
