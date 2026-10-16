# Design-system migration guide (for module engineers)

Source: `send-it-design/ux-team/07-final-design-system.md`. Foundation work is off-spec and pending
PR review. Scope is visual + motion only. No illustrations (`accentIllustration` is ONLY the beta-video
play disc). The palette uses warm sand B.

## 1. Colours (`src/lib/theme.ts`)

Existing values changed globally, and new keys were added (55 keys, see Foundations/Tokens story).

- **`surface` changed meaning.** It is now the white card / list container. Anywhere you used
  `surface` as a grey block (input background, secondary button, chart track, inline chip, skeleton),
  switch to `surfaceAlt`. Pressed card/row = `surfacePressed`. Card-less lists (notifications,
  settings, followers): put rows on `surface`, not on `background`.
- **`textInverse` -> `onPrimary`** (text/icons on `primary`). Also `onError`, `onSendTop`, `onToast`,
  `onMedia`. `textInverse` still exists as `@deprecated`. Dark `onPrimary` is dark text.
- **`warning`**: bookmarks -> `primary`; flash -> `sendFlash` / `sendFlashContainer`; notice boxes ->
  `noticeContainer` / `onNoticeContainer` / `noticeBorder`. `warning` itself is now an orange-brown
  text/icon colour (always with a `warning-outline` icon).
- **`success`** -> `sendTop` where it means "sent"; plain success messages may keep `success`.
- Hardcoded `FLASH_BADGE_COLOR = '#FFD700'` -> `sendFlash` (icon) / `sendFlashContainer` (fill).
- Pressed feedback never uses opacity: use the `*Pressed` colour.
- Selected chip/segment: `secondaryContainer` + 1.5pt `primary` border + `onSecondaryContainer` text.
- Gold only for flash; `sendFlashBright` and `decorChalk` are particle-only.

Kept as deprecated aliases: `textInverse` (palette), `FONT_SIZE`. Never existed, so not created:
`skeleton`, `accent`, `onAccent`, `borderStrong`, `info`.

## 2. New tokens

`theme.typeScale` (`TYPE_SCALE`), `theme.layout` (`LAYOUT`), `theme.iconSize`, `theme.elevation`
(already resolved for the current theme: dark has no shadow, use a 1px `border`), `theme.componentSize`,
`SPACING` additions `xxs` 2, `smd` 12, `mdl` 20. `useLayout()` returns `screenMargin` (16, or 20 at
width >= 428). Do not read `Dimensions` at module load. Fixed heights become `minHeight`; touch targets >= 44.

## 3. `src/components/ui/` (import from `components/ui`)

| Component | Use |
|---|---|
| `AppText variant color weight numeric` | all text; replaces `fontSize`/`FONT_SIZE`. Variants map to `TYPE_SCALE` plus `sectionHeader`. |
| `PressableScale feedback="control"|"row" pressedColor inScroll` | press feedback: scale 0.96 + colour wash (controls) or wash only (cards/rows). `inScroll` adds the 50ms press delay. |
| `Button variant="primary|secondary|destructive|ghost" loading` | destructive always carries an icon (defaults to trash). minHeight 44 (primary 50). |
| `IconButton name accessibilityLabel` | 44x44, label is mandatory. |
| `Chip label selected swatch` | 32pt visual, 44pt touch. |
| `BottomSheet visible onClose title variant="confirm"` | drag/backdrop/escape, settle spring, Reduce Motion fade. |
| `ToastProvider` + `useToast().show({...})` | mount once above the tab bar (`bottomOffset` = tab bar height + 8). Tones: default, flash, error. |
| `Skeleton surface="card|page"`, `SkeletonGroup`, `useSkeletonPhase(loading)` | shared pulse; 300ms delay, 10s timeout. |
| `CelebrationHost` + `useCelebration().celebrate(...)` | mount at the top of AppShell. |
| `ParticleBurst kind` | palette-driven particles. |

User-facing strings go through i18n; shared a11y strings live under `ui.*` in `locales/*/common.json`.

## 4. Motion and haptics

```ts
const { duration, easing, spring, scale, reduceMotion, haptic } = useMotion();
```
- Read durations from `useMotion()` (Storybook slow motion and overrides depend on it).
- `reduceMotion`: no translate/scale/shake/particles; cross-fade at `duration.short`; information unchanged.
- `haptic('toggle', 'bookmark-123')`: throttled per sourceId (300ms), respects `hapticsEnabled`, calls the
  current `HapticDriver`. The default driver is a no-op (`expo-haptics` is not installed). Fire it on the same
  frame as the visual feedback. Every haptic needs a visual/VoiceOver counterpart.
- Use `USE_NATIVE_DRIVER` from `lib/motion` for `Animated` (it is false on web/Storybook).

## 5. Story convention

- Prefer **one story with Controls (`args` / `argTypes`)** over many near-duplicates. Example: AppHeader's
  unread count is a number control, not `NoUnread` / `OneUnread` / `Over99` stories; Button's `variant`,
  `loading`, `disabled` are controls.
- Add a separate story only for a genuinely different layout (e.g. `Scale` showing the whole type scale).
- Use the toolbar for theme, language, Reduce Motion, speed; do not build theme/language variants as stories.
- Stories use fake data only; seed via `setStubData` (see README).
