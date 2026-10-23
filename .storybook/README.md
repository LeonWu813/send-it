# Storybook (react-native-web + Vite)

Real React Native components rendered in the browser via react-native-web. No simulator.

```
npm run storybook          # dev server on http://localhost:6006
npm run build-storybook    # static build to storybook-static/ (git-ignored)
```

Off-spec design tooling (added on `design/storybook`, pending PR review).

## Where stories go

Colocate in the module: `src/modules/<mod-name>/stories/<ComponentName>.stories.tsx`
(Tokens and Icons pages: `src/modules/mod-localization-theme/stories/`; shared `ui/` components: `src/components/ui/stories/`).
One Controls-driven story per component; see `MIGRATION.md` section 6.
Story titles: `Components/<Name>`, `Patterns/<Name>`, `Pages/<Tab>/<Page>` (see "How to add a page story").
Jest ignores `*.stories.tsx` (it only runs `*.test.*` / `__tests__`).

```tsx
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { MyCard } from '../MyCard';

const meta: Meta<typeof MyCard> = { title: 'Home/MyCard', component: MyCard };
export default meta;
export const Default: StoryObj<typeof MyCard> = { args: { title: 'Hello' } };
```

## How to add a page story

Pages (full screens) live under `Pages/<Tab>/<Page>` (see `send-it-design/ux-team/storybook-ia/storybook-ia.md`)
and render inside `PhoneFrame` (`.storybook/PhoneFrame.tsx`): an iPhone 16 Pro viewport (393x852, safe area top 59 /
bottom 34) with the REAL `AppHeader` (driven by the real header store, so `useAppHeader` / `useAppHeaderRoot` /
`useHideTabBar` / `useTabBarInset` work as in AppShell) and the real floating `TabBar`. Do not render your own
header, TabBar or `ToastProvider`; the frame provides them (plus `CelebrationHost` and an unread-count provider).

`parameters.page`: `tab` (`'home' | 'gyms' | 'profile'`, default `'home'`), `overlay` (true for notifications,
settings, other-user profile: wraps in `AppHeaderOverlayScope`, no shell header/TabBar), `chrome` (false for Sign
In / Sign Up: no header, no TabBar). The TabBar hides itself when the screen calls `useHideTabBar`.

```tsx
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';

const meta: Meta = {
  title: 'Pages/Gyms/Gym List',                  // English Title Case, no "Screen" suffix
  component: GymListScreen,                      // the real screen, for traceability
  tags: ['!autodocs'],                           // Pages have no Docs page
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [withPhoneFrame],
  render: () => <GymListScreen session={fakeSession} />,
};
export default meta;
export const Populated: StoryObj = {};           // then Empty, Loading, Error where they really exist
```

Seed fake data synchronously before the screen renders (see the Home story): call `resetStubData()`,
`setStubData('auth:session', { user: { id } })` (screens that call auth need it), then each table.
`STUB_PENDING` (from the stub) makes a query never resolve: use it for a persistent Loading story.
If a screen does not really have a Loading or Error state, do not invent one. A decorator listed in
`decorators` before `withPhoneFrame` renders inside the frame.

## What every story gets (`.storybook/preview.tsx`)

- Real `ThemeProvider` from `src/lib/theme.ts`, driven by the **Theme** toolbar (light/dark) via the
  provider's own `setOverride`. Canvas background = theme `background` token.
- `SafeAreaProvider`.
- i18n (`src/lib/i18n.ts`), default `zh-TW`, switchable with the **Language** toolbar (zh-TW / en).
- Use `ForcedTheme` (`.storybook/ForcedTheme.tsx`) to show light and dark side by side in one story.

## Supabase stub (no network, ever)

Every import of `src/lib/supabase` (relative or `@/`) is redirected by a Vite plugin in `main.ts`
to `.storybook/stubs/supabase.ts`. Query chains resolve to `{ data: [], error: null }`
(`null` after `.single()`/`.maybeSingle()`); auth/storage/functions/realtime are inert.
`EXPO_PUBLIC_SUPABASE_*` are defined as dummy values. `AsyncStorage` is an in-memory stub.
`expo-image-picker` is aliased to `.storybook/stubs/expo-image-picker.ts` (its raw TS source breaks the dep optimizer on web; pickers resolve as canceled, permissions as granted).

## Fake data

Two options:

1. Pass props/args directly to presentational components (preferred).
2. For components/screens that call services, seed the stub before render:

```tsx
import { setStubData } from '../../../../.storybook/stubs/supabase';
setStubData('routes', [{ id: '1', name: 'V3 Test' }]);   // table name
setStubData('rpc:get_feed', [/* ... */]);                // rpc:<fn>
setStubData('fn:my-edge-fn', { ok: true });              // fn:<name>
setStubData('auth:session', { user: { id: 'u1' } });     // auth session
```

The stub returns the same data for every query on that table (filters are ignored). For anything more
specific, mock the service module's props or wrap the story in a decorator.

## Native modules

Only stubbed when they actually fail. If a component imports a native-only module (expo-video,
expo-notifications, image picker, Apple auth...) and the story errors in the browser, add a stub in
`.storybook/stubs/` and an alias in `main.ts` `viteFinal` (mirror `__mocks__/`), or render the
presentational part with props.

## Motion and haptics tooling (design-system foundation)

Toolbar items (`.storybook/preview.tsx`):

- **Reduce Motion** (`Motion: reduced`) wraps the story in `MotionProvider reduceMotion` from
  `src/lib/motion.ts`, forcing `useMotion().reduceMotion = true` regardless of the OS setting.
  Verify every component's Reduce Motion fallback (cross-fade only, no scale/translate/particles).
- **Speed** (1x / 3x / 10x) scales the visual durations (`micro`..`celebrate`) through
  `MotionProvider timeScale`, for slow-motion inspection. Only components that read durations from
  `useMotion()` are affected, so always use that hook instead of `MOTION` directly.
- **Haptics**: the preview installs a logging `HapticDriver` (`.storybook/HapticLog.tsx`). Every
  `useMotion().haptic(key)` call shows a black pill `haptic: <key>` (top right of the canvas) for
  ~0.9s and logs `[haptic] <key>` to the console. Use it to check that each haptic has a visual
  counterpart and fires on the same frame. `expo-haptics` is NOT installed.
- **Replay**: use Storybook's built-in "Remount component" toolbar button (or re-trigger the story's
  own buttons). No custom replay control was added.

Shared base components live in `src/components/ui/` with stories in `src/components/ui/stories/`.
See `.storybook/MIGRATION.md` for the migration rules and the story convention.
