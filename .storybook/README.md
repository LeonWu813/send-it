# Storybook (react-native-web + Vite)

Real React Native components rendered in the browser via react-native-web. No simulator.

```
npm run storybook          # dev server on http://localhost:6006
npm run build-storybook    # static build to storybook-static/ (git-ignored)
```

Off-spec design tooling (added on `design/storybook`, pending PR review).

## Where stories go

Colocate in the module: `src/modules/<mod-name>/stories/<ComponentName>.stories.tsx`
(Tokens page: `src/modules/mod-localization-theme/stories/Tokens.stories.tsx`).
Story titles: `<Module or area>/<ComponentName>`, e.g. `Home/HomeScreen`.
Jest ignores `*.stories.tsx` (it only runs `*.test.*` / `__tests__`).

```tsx
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { MyCard } from '../MyCard';

const meta: Meta<typeof MyCard> = { title: 'Home/MyCard', component: MyCard };
export default meta;
export const Default: StoryObj<typeof MyCard> = { args: { title: 'Hello' } };
```

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
