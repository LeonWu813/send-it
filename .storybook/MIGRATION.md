# Design-system migration guide (for module engineers)

Source of truth: `send-it-design/ux-team/design-system/send-it-design-system.md` (v1.1, with the
v1.2 foundation alignment in this branch). It supersedes `07-final-design-system.md`. Foundation work
is off-spec and pending PR review. Scope is visual + motion only. **No illustrations, stickers or
mascots** (`accentIllustration` is ONLY the beta-video play disc). **No `expo-haptics`** (stub driver
only). The palette is warm sand B. Phase 2 items (spec Appendix F: quick log, non-blocking upload
cells, undo-delete, `firstSendDust`, ...) are not built; do not implement them without a PRD change.

Rules that apply everywhere: no hex / `rgba()` / font sizes / radii in components (use tokens), 44pt
touch targets, fixed heights become `minHeight`, pressed states swap to a `*Pressed` colour (never
opacity), every icon-only button has a localized `accessibilityLabel`, all strings through `t()`.

# v2.2 (design system v2.2, real component redesign) - READ THIS FIRST

Source: `send-it-design/ux-team/design-system/send-it-design-system.md` v2.2, Appendix G. The foundation
(`theme.ts`, `motion.ts`, `icons.ts`, every `src/components/ui/*`) is done; module engineers migrate their
own screens. Old names stay as deprecated aliases for one version. Sections 1-3 below describe v1.2
and are still valid except where this section overrides them.

## Radius roles (replaces `BORDER_RADIUS`)

`RADIUS.minor 4` (tape swatch, skeleton text, `innerRadius` fallback), `tape 6` (TapeBadge ONLY), `control 12`
(TextField, stepper, notices), `media 12` (thumbnails, inset video grid outer corners), `card 20` (Card, RouteCard,
grouped list, page InlineError, EmptyState, double-line toast, upload modal), `sheet 32` (fixed), `full` (buttons,
chips, segmented, avatar, single-line toast, TabBar). Also on `theme.radius`.

```ts
import { RADIUS, innerRadius, CONTINUOUS } from '../../lib/theme';
innerRadius(RADIUS.card, 8);   // 12: gap < outer / 2 => concentric (RouteCard thumbnail = card 20, padding 8)
// gap >= outer / 2 => the inner element uses its own role (list thumb 56 in a card = RADIUS.media)
<View style={{ borderRadius: RADIUS.card, borderCurve: 'continuous', overflow: 'hidden' }} />
```

Every container with radius >= 12 sets `borderCurve: 'continuous'` (`...CONTINUOUS`). `BORDER_RADIUS.sm/md/lg/xl`
are deprecated (values unchanged, v1.2): `sm` -> `minor` / `full` / delete, `md` -> `control` / `media`,
`lg` -> `card`, `xl` -> `sheet`. Never write `borderRadius: 20` / `12` / `3` directly.

## Tokens that changed or are new

- `LIGHT/DARK_PALETTE` 58 keys: new `segmentedThumb`. Header rules 4/5 rewritten (selected chip = inverted).
- `TYPE_SCALE.display` (72/76, Latin digits only, `numeric`), `numeric1` (34/40). `FontWeight` includes `'800'`
  (only `tapeLabel`). `TYPE_VARIANT`: `groupHeader` (was `sectionHeader`, alias kept), `pageSection` (title3 600),
  `unit` (half-size, textSecondary), `tapeLabel` (lg 24/800, md 13/800, sm 12/700), `fieldLabel` (subhead 600).
  `<AppText variant="pageSection" | "groupHeader" | "fieldLabel">` work; use `pageSection` for page sections
  (Home, Profile, RouteDetail) and `groupHeader` ONLY above grouped lists.
- `ELEVATION.control` (float IconButton, segmented thumb, header capsule); dark = none. `raised` also floating sheet / TabBar.
- `COMPONENT_SIZE`: `chipHeight 36`, `buttonPrimaryMinHeight 52`, `progressBarHeight 6`, `statsBarHeight 6`,
  `tapeSwatch 14`, `tapePadH {sm 6, md 8, lg 10}`, `tapeHeight {sm 20, md 24, lg 34}`, `segmentedHeight`,
  `tabBarHeight 64`, `tabItemWidth 88`, `headerActionGroup`, `smallButton 30`, `mediaButton 32`, `sendStatusDisc 28`,
  `sendStatusTag 24`, `routeThumb 88` / `routeThumbCompact 64`, `listThumb 56`, `uploadThumb`, `searchFieldHeight 44`,
  `stepperHeight/Min/Max 56/1/9999`, `unreadDot 8`, `mediaTileAspect 0.75`, `statsPrimaryMinHeight 176`.
  Deprecated: `chipBorder`, `chipSelectedBorder`, `tapeSwatchRadius`.
- `LAYOUT`: `listRowPaddingV 14`, `listRowMinHeight 52`, `routeCardPadding 8`, `sheetInset 8`, `mediaGridGapInset 2`,
  `fieldGap 16`, `compactWidthBreakpoint 360`. `ICON_SIZE.tab` 24. `AVATAR_SIZE.lg` 64.
- Icons (`ICON`): new `remove`, `image` (`image-outline`), `betaCount` (`play-circle-outline`); `add`, `share`, `locked` already existed.

## Motion (`src/lib/motion.ts`)

`duration.press 100` / `duration.release 120` (press-in / pressed colour leaving; `short` is NOT used for that any more),
`spring.glide` (selection moving between items: segmented thumb, TabBar pill), `scale.pressWide 0.98`
(PressableScale picks it itself for controls >= 200pt wide), `distance.{sheetFloatEnter 24, toastEnter 8, stepperDigit 6,
bookmarkDrop 2}` (via `useMotion().distance`; not time-scaled, unused under Reduce Motion). `useMotion()` time-scales
`micro`, `press`, `release`, `short`, `medium`, `long`, `celebrate`. M1 reworded, **M12**: springs drive transforms only
(`translate` / `scale` / `rotate`); opacity and colour always use timing + an easing token; position-derived opacity is clamped.

## Components: new, renamed, removed props

- **Button**: capsule (`RADIUS.full`) in every size; `lg` 52 / `headline`, `md` 44 / `callout`, `sm` 32 / `footnote`; new variant
  `destructiveTonal` (page entry that opens a confirm; `destructive` is only the final confirm). `destructive` no longer adds a
  default icon. Min width = height x 1.5.
- **PressableScale**: press `press` 100, release `release` 120, `pressWide` 0.98 for width >= 200.
- **IconButton**: variants `tonal` (`diameter` 44 | 52, `tonalBase`), `float`, `small` (30, touch 44), `media` (visual 32);
  new `IconButtonGroup` (96x44 header action capsule). `onPressIn` / `onPressOut` passthrough.
- **Chip**: 36 high, **selected = inverted** (textPrimary fill, `background` text), no outline and no bold copy, `subhead` 500;
  new `on: 'background' | 'surface'`; swatch 14x14 `minor`; clear button = `IconButton small`. `size="large"` kept (min 44).
  `primary` is never a selection colour.
- **SegmentedControl (new)**: `<SegmentedControl options value onChange variant accessibilityLabel hapticPurpose />`;
  `variant: 'standard' (36) | 'compact' (32) | 'icon' (68, tap only)`. Options `{ value, label, icon?, iconSelected?, selectedColor? }`.
  2-4 items; `glide` thumb, dark theme thumb has a 1pt `outline`. LogSend: use `variant="icon"` with
  `selectedColor: 'sendTop' | 'sendFlash' | 'sendAttempt'`, `hapticPurpose="send-style"`.
  `SendStylePicker` is now exactly that (kept, props unchanged).
- **Stepper (new)**: `<Stepper label description value onChange min max valueText locked lockedDescription lockedAnnouncement doneLabel hapticSource />`.
  Defaults 1..9999. The container is the VoiceOver element (`adjustable`); `locked` is the flash state (no discs, lock hint, 1pt border,
  announces `lockedAnnouncement` when it becomes locked; the caller restores the pre-flash value on unlock and submits
  `resolvedAttempts` as before). Hold -/+ for auto-repeat; tap the number to type (iOS Done accessory). Keep `value` in the screen.
- **SendStatus** (was `SendStyleChip`; the old name is a re-export that defaults to `variant="tag"`): `variant: 'disc' | 'tag'`, tonal containers
  (`sendTopContainer` / `sendFlashContainer` / `sendAttemptContainer`); `landing` pops the ICON, not the disc.
- **TextField**: radius 12, padding 14, label = `fieldLabel`, `search` = capsule 44. Put the fields of one form in ONE `Card` with
  `gap: LAYOUT.fieldGap`; keep each field's own 1pt border.
- **BottomSheet**: new `presentation: 'floating' | 'attached'` (default floating, `form` = attached), `optionCount`. Floating = inset 8, radius 32 on all
  corners; it switches to attached by itself above 60% window height, at font scale >= 1.6, or `list-single` with > 6 options.
  `confirm` has NO close X (Cancel closes). Close = `IconButton small`. Title `title2`, AX sizes never truncate.
- **Toast**: capsule when it is one line (content width, 48 high), `card` 20 when it wraps or font scale >= 1.6; **at most ONE action**
  (`actions` beyond the first are ignored); enters from +8; replacing a single-line toast tweens the width.
- **ListRow**: min 52, vertical padding 14; new `variant="content"` with `thumbnail` (56, media radius) + `trailing` (a `SendStatus disc`) or a chevron;
  title `headline`. Dividers start at the title's left edge. Grouped container: `surface`, `RADIUS.card`, `overflow: hidden`.
- **Card**: radius 20 + continuous curve, new `variant="tinted"` (`primaryContainer`); RouteCard padding is `LAYOUT.routeCardPadding` 8.
- **ProgressBar**: 6 high. New `UploadProgressCard` (thumbnail + route + percent + bar + failure state with Retry / Cancel).
- **InlineError / NoticeBox**: no colour bar. `block` has a `title` prop (headline) and the action sits on the same row;
  page = `surface` card 20, `on="elevated"` (sheet) = `surfaceAlt` 12. `notice` is NEUTRAL (`surfaceAlt`); real warnings use
  `variant="warning"` / `<NoticeBox tone="warning">` (`noticeContainer`). `warning` prop on `notice` still works.
- **Skeleton**: text lines `minor`; new compositions `RouteCardSkeleton`, `AscentRowSkeleton`, `VideoCellSkeleton`, `StatsPanelSkeleton`;
  `shape="tape"`; `thumb` is 12 radius.
- **EmptyState**: variants `slot` (dashed card, the whole card is the Pressable via `onPrimary`; `primaryLabel` is only a visual hint),
  `prompt` (`primaryContainer` card: `eyebrow`, `title`, `description`, `primaryLabel`; the ONLY prompt on a page), `filtered`, `private`, `inline`.
  `firstUse` is a deprecated alias of `prompt`.
- **Avatar**: `lg` 64; photo fades in `linear`.

## Still to migrate in module code (not part of the foundation)

TapeBadge (`RouteColorBadge`), RouteCard, AppHeader, TabBar / AppShell, StatsPanel, FilterBar, AscentHistoryItem, AscentList,
LogSendScreen, BetaVideoGrid, ReelOverlay, ReportSheet, ModerationActions (spec G.7). Not built: anything in Appendix F.

---

## 1. Colours (`src/lib/theme.ts`)

57 keys per palette (light + dark, identical key sets). See Foundations/Tokens.

- **`surface` is the white card / list container.** Grey blocks (input background, secondary
  button, chart track, in-card skeleton) use `surfaceAlt`. Pressed card/row = `surfacePressed`.
  Card-less lists (notifications, settings, followers): rows sit on a `surface` container, never
  directly on the sand `background`.
- **`surfaceAltPressed`** (new): pressed colour for secondary buttons, and for anything pressed on
  top of `background` (AppHeader / nav-bar IconButtons, ghost buttons placed on the page).
  `surfacePressed` is invisible on the sand page (1.05:1), so use the `on` prop (section 3).
- **`mediaTrack`** (new): progress-bar track on media. Only Phase 2 upload cells use it.
- `textInverse` is deprecated -> `onPrimary` / `onError` / `onSendTop` / `onToast` / `onMedia`.
- `warning`: bookmarks -> `primary`; flash -> `sendFlash` / `sendFlashContainer`; notice boxes ->
  `noticeContainer` / `onNoticeContainer` / `noticeBorder`. `warning` is only a text/icon colour and
  always pairs with the `warning-outline` glyph.
- `success` -> `sendTop` where it means "sent"; plain success messages may keep `success`.
- `FLASH_BADGE_COLOR = '#FFD700'` -> `sendFlash` (icon) / `sendFlashContainer` (fill).
- Selected chip / option: `secondaryContainer` + 1.5pt `primary` outline + `onSecondaryContainer` text.
- Gold only for flash. `sendFlashBright` and `decorChalk` are particle-only. `toastAction` only on
  `toastBackground`. Dark theme: no shadows, use a 1pt `border`.
- Never created (do not add): `skeleton`, `accent`, `onAccent`, `borderStrong`, `info`.
- `TAPE_DISPLAY` / `TAPE_HAIR` (route tape colours) are NOT in `theme.ts` yet. engineer-mod-route-catalog
  adds them (spec section 1.5).

## 2. Other tokens

| Token | Use |
|---|---|
| `theme.typeScale` | 11 roles, always through `<AppText variant>` |
| `theme.spacing` | `xxs 2, xs 4, sm 8, smd 12, md 16, mdl 20, lg 24, xl 32, xxl 48` |
| `theme.layout` | `cardPadding 16`, `cardGap 12`, `sectionGap 24`, `iconTextGap 4`, `iconTextGapInButton 8`, `minTouchTarget 44`, ... Screen margin: `useLayout().screenMargin` (16, or 20 at width >= 428). Never read `Dimensions` at module load. |
| `theme.iconSize` | `xs 14, sm 16, md 20, lg 24, tab 26, xl 28`. Only these. |
| `theme.stroke` (`STROKE`) | `hairline`, `thin 1`, `emphasis 1.5`. The only line widths. |
| `theme.avatarSize` (`AVATAR_SIZE`) | `xs 24, sm 32, md 48, xl 96` |
| `theme.componentSize` | sheet / toast / chip / button sizes plus `buttonSmMinHeight 32`, `textFieldMinHeight 48`, `emptyStateMaxWidth 320`, `radioSize 20`, `radioDot 10`, `noticeBarWidth 4`, `tapeSwatch 11`, `tapeSwatchRadius 3`, `tapePadH { sm 6, md 10 }`, `likeBurst 84` |
| `theme.elevation` | already resolved for the current theme (dark = no shadow) |
| `MOTION.shake` | `{ distancePt: 4, segments: 4 }`, used through `useShake()` |

## 3. `src/components/ui/` (import from `components/ui`)

Mounting: **`ToastProvider` and `CelebrationHost` must be mounted once by AppShell** (engineer-mod-home
does it), above the tab bar and screens. Pass `ToastProvider bottomOffset={tabBarHeight + theme.componentSize.toastOffsetAboveTabBar}`.
Components call `useToast().show(...)` / `useCelebration().celebrate(...)`; they never mount their own.

### The `on` prop (Button, IconButton)

Pressed colour depends on the surface under the control, which the control cannot see, so tell it:

| `on` | Where | Pressed |
|---|---|---|
| `'surface'` (default) | cards, rows, sheet content | `surfacePressed` wash |
| `'background'` | AppHeader, nav bars, ghost buttons straight on the page | `surfaceAltPressed` wash |
| `'media'` | on video / photos (`IconButton variant="media"` sets it) | `mediaScrimStrong` |
| `'tinted'` | on `errorContainer` / `noticeContainer` / `sendFlashContainer` | no wash; label / glyph turns `primaryPressed` |

`secondary` buttons always press to `surfaceAltPressed` regardless of `on`. All controls also scale to 0.96
(not under Reduce Motion).

### Components and props

| Component | Props (all optional unless marked) |
|---|---|
| `AppText` | `variant` (11 roles + `sectionHeader`, default `body`), `color` (palette key), `weight` (`'400'\|'500'\|'600'` only; 700 is built into title roles), `numeric`, `align`, `numberOfLines` |
| `PressableScale` | `feedback` (`control` scales + wash / `row` wash only), `pressedColor`, `underlay` (layers below the wash), `inScroll` (50ms press delay) |
| `Button` | `label` (req), `onPress` (req), `variant` (`primary\|secondary\|destructive\|ghost`), `size` (`lg` 50 / `md` 44 / `sm` 32 + hitSlop; default lg for primary, md otherwise), `on`, `icon`, `trailingIcon` (link-style ghost only), `loading` (width locked, spinner fades in), `disabled` (explain why next to it), `fullWidth`, `accessibilityHint`. Destructive always has an icon: pass `ICON.block.outline` for block, `ICON.delete.outline` for delete. One `primary` per screen. |
| `IconButton` | `name` (req), `accessibilityLabel` (req), `onPress` (req), `variant` (`plain\|toggle\|media`), `on`, `color`, `colorOn`, `nameOn` (toggle ON glyph), `selected`, `size` (20 / 24 / 28), `badge` (count; 0 hides), `badgeLive`, `disabled`. 44x44 container, never hitSlop. |
| `Badge` | `count`, `live` (0 -> n pops with `topOut` only for a live foreground notification). Normally used through `IconButton badge`. |
| `Chip` | `label` (req), `variant` (`filter\|choice\|multi`), `selected`, `onPress`, `onClear` + `clearAccessibilityLabel` (filter with a value: separate 44pt clear button), `swatch` + `swatchHair` (tape colour square, pops on select), `icon`, `iconSelected`, `iconPop`, `size` (`default\|large`), `disabled`. Lay chips out with `columnGap: 8`, `rowGap: 12`. |
| `SendStyleChip` | `sendStyle` (`top\|flash\|attempt`), `attempts`, `landing` (change it to play the new-row pop), `burst` (flash particles). Status marker, not pressable. |
| `SendStylePicker` | `value`, `onChange`, `disabled`: the log-send selector (3 choice chips, radiogroup, haptic `select`). |
| `TextField` | `variant` (`singleLine\|multiline\|search`), `label`, `value` (req), `onChangeText` (req), `placeholder` (an example, never the label), `error` (red outline + InlineError field), `helper`, `maxLength` + `showCount`, `readOnly` (value stays readable + lock glyph), `disabled`, `secureTextEntry` (eye toggle), `loading` (search), plus `keyboardType`, `autoComplete`, `textContentType`, `returnKeyType`, `onSubmitEditing`, ... |
| `ListRow` | `variant` (`navigation\|value\|toggle\|selectable\|radio\|action\|withButton`), `title` (req), `subtitle`, `value`, `leadingIcon`, `leading` + `leadingWidth`, `selected`, `toggleValue` / `onToggle`, `buttonLabel` / `onButtonPress`, `destructive`, `disabled`, `onPress`, `on` (`surface\|elevated` for sheets), `inset` (`screen\|grouped`), `divider` (omit on the last row), `density` (`settings\|content`), `inScroll`. Exports `Radio`. |
| `Card` | `variant` (`static\|pressable\|elevated`), `padding` (16, RouteCard 12), `onPress`, `inScroll`. Light = shadow no border, dark = border no shadow. No external margin: use `gap: cardGap` in the parent. |
| `ProgressBar` | `value` 0-100, `accessibilityLabel` (req), `tone` (`default\|media`), `failed`, `showPercent`. Also exports `Spinner` (`color`, `size`). |
| `Avatar` | `size` (`xs\|sm\|md\|xl`), `uri`, `name` (initial fallback; empty = person glyph), `decorative` (hide from VoiceOver when the name is next to it) |
| `EmptyState` | `variant` (`firstUse\|filtered\|private\|inline`), `icon`, `title`, `description`, `primaryLabel` / `onPrimary`, `secondaryLabel` / `onSecondary`, `on`. Primary only when it fills the screen; a region of a screen is `inline` + ghost. Show it only when sure there is no data. |
| `InlineError` | `variant` (`field\|block\|notice`), `message` (req; translated sentence, never `err.message`), `actionLabel` / `onAction`, `actionLoading`, `on` (`surface\|elevated`), `warning`. Also exports `NoticeBox`. |
| `BottomSheet` | `visible`, `onClose` (req), `title`, `description`, `variant` (`content\|list-single\|form\|confirm`), `loading`, `footer`, `confirmLabel` / `confirmIcon` / `onConfirm` / `cancelLabel` (confirm: destructive on top, cancel below, stacked full width), `error` (+ `errorActionLabel`, `onErrorAction`: InlineError block above the actions, sheet stays open), `onClosed`. Has its own close button. `useSheetSelect(onClose)` closes a `list-single` 200ms after a selection. No sheet inside a sheet; no multi-select (Phase 2). |
| `Toast` / `ToastProvider` + `useToast()` | `show({ message, tone ('default'\|'flash'\|'error'), icon, actions [{label,onPress}] or actionLabel/onAction, durationMs })`, `hide()`. One at a time; replacing cross-fades; an error is not replaced by a non-error until dismissed. Swipe down dismisses. Plain success has no icon. |
| `Skeleton` / `SkeletonGroup` / `useSkeletonPhase` | `shape` (`text\|circle\|thumb\|card\|rect`, sets the radius), `textVariant`, `surface` (`card\|page`). Always wrap a region in `SkeletonGroup label="..."` ("Loading routes"). Show after 300ms, `timeout` after 10s -> InlineError + retry. |
| `CelebrationHost` + `useCelebration()` | `celebrate({ title, subtitle, actionLabel, onAction, flash })`. Trophy icon. Tap the card = view (`onAction`, then closes); close button / swipe up dismisses; stays 5s, paused while touched, never auto-closes under VoiceOver. Trigger conditions are Phase 2. |
| `ParticleBurst` | `kind`, `flash`, `playKey` |
| `useShake()` | `{ translateX, shake(scale?) }`: the one failure shake (+-4, 4 segments, 200ms). Pair with `haptic('error')` and an error message. |

Not in `ui/`: `TapeBadge` / `RouteColorBadge` (route-catalog), `AppHeader`, `TabBar`, `RouteCard`
(home, built from these parts), product components.

## 4. Icons (`src/lib/icons.ts`)

Never write glyph strings. One concept -> one glyph; outline is the default/off state, filled is on/achieved.

```tsx
import { Ionicons } from '@expo/vector-icons';
import { ICON, iconName } from '../../lib/icons';

<Ionicons name={ICON.bookmark.outline} size={theme.iconSize.md} color={...} />
<Ionicons name={iconName('bookmark', saved)} ... />             // outline when off, filled when on
<IconButton variant="toggle" name={ICON.bookmark.outline} nameOn={ICON.bookmark.filled} selected={saved} ... />
<Button icon={ICON.block.outline} variant="destructive" ... />
```

- Only Ionicons, only `*-outline` and filled styles (no `*-sharp`), no emoji or text symbols as icons
  (replace the bell / gear emoji, `x` in chips, heart characters), no custom SVG.
- Sizes only from `theme.iconSize`. Icons never scale with Dynamic Type.
- Celebration uses `ICON.newTopGrade.filled` (`trophy`); `flag` means report. Back is always
  `ICON.back.outline` (`chevron-back`) at `lg`, `textPrimary`, in a 44 IconButton. More is
  `ellipsis-horizontal`. Attempt is `ellipse-outline` in every state.
- To add a concept: check Foundations/Icons first, then ask the UI designer (spec section 9.11).

## 5. Motion and haptics

```ts
const { duration, easing, spring, scale, shake, reduceMotion, haptic } = useMotion();
```
- Read durations from `useMotion()` (Storybook slow motion and overrides depend on it).
- Give every `Animated.timing` an easing: `easing: bezierFor('standard' | 'enter' | 'exit' | 'linear')`.
  Never the RN default and never `Easing.quad`. Every `Animated.spring` spreads `...SPRING_REST`.
- Only transform and opacity use the native driver (`USE_NATIVE_DRIVER`, false on web). Colour changes
  cross-fade two stacked layers; never animate `backgroundColor`.
- `reduceMotion`: no translate / scale / shake / particles; cross-fade at `duration.short`; information is
  unchanged. Direct manipulation (dragging a sheet, swiping a toast) keeps working.
- `haptic('toggle', 'bookmark-123')`: throttled per sourceId (300ms), respects `hapticsEnabled`, calls the
  current driver (no-op by default). Fire it on the same frame as the visual feedback. Every haptic needs a
  visual and VoiceOver counterpart. Buttons themselves never fire haptics; the caller does, at the result.

## 6. Story convention

- **One Controls-driven story per component** (`args` / `argTypes`) that covers its states. Example:
  Button's `variant`, `size`, `on`, `loading`, `disabled`, `icon` are controls, not separate stories;
  AppHeader's unread count is a number control, not `NoUnread` / `OneUnread` / `Over99`.
- Add a separate story only for a genuinely different layout (e.g. `Scale` for the type scale, Button's
  `ConfirmStack`).
- Use the toolbar for theme, language, Reduce Motion and speed; do not build theme/language variants as stories.
- Shared `ui/` stories live in `src/components/ui/stories/`; module stories in
  `src/modules/<mod>/stories/`. Stories use fake data only; seed via `setStubData` (see README).
- Put a one-line JSDoc above `Playground` saying what to try (press, drag, change X).
