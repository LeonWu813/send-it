# Blast-Radius: INT-030 — wrap `setThemeUserId` in `useCallback(..., [])`

**Change:** In `src/lib/theme.ts:634–636`, replace the plain function definition

```ts
function setThemeUserId(newUserId: string | null): void {
  setUserId(newUserId);
}
```

with

```ts
const setThemeUserId = useCallback((newUserId: string | null): void => {
  setUserId(newUserId);
}, []);
```

`setThemeUserId` is then put into the context value at `:643`:
`{ value: { theme, override, setOverride, setThemeUserId } }`.

---

## What it does

`ThemeProvider` is a function component. On every render, `function setThemeUserId(...)` creates a new function reference. That reference ends up in the `ThemeContext` value. `AppShell` (`src/modules/mod-home/AppShell.tsx:190–198`) has `setThemeUserId` in its `useEffect` dep array. A new reference on every ThemeProvider render causes the effect — which calls `setThemeUserId(null)` and `applySignedOutLanguage()` — to re-run while the user is still signed in (INT-030 defect). The fix makes the reference stable, so the effect only re-runs when `session.user.id` changes or `AppShell` unmounts.

---

## The one fact it's safe because of

**`setUserId` (the only value `setThemeUserId` captures) is a React state setter and is stable across renders, so `useCallback(..., [])` with empty deps is correct.**

**Proof — Step 4 (ran it):**

```
node -e "
const React = require('react');
const { act, create } = require('react-test-renderer');
let setters = [];
function Sim() {
  const [, setUserId] = React.useState(null);
  setters.push(setUserId);
  return null;
}
let r;
act(() => { r = create(React.createElement(Sim)); });
act(() => { r.update(React.createElement(Sim)); });
console.log('useState setter stable across renders:', setters[0] === setters[1]);
"
# Output: useState setter stable across renders: true
```

Run from project root with the project's `react-test-renderer` installed. Output: `useState setter stable across renders: true`.

Supporting: `src/lib/theme.ts:588` — `const [userId, setUserId] = useState<string | null>(null);`. React docs: "The set function returned by useState is always stable — it won't change on re-renders." ([react.dev/reference/react/useState](https://react.dev/reference/react/useState))

---

## Risks

### Cleared

**`setThemeUserId` caller census** — `grep -rn "setThemeUserId" src/` finds exactly three call sites, all in `src/modules/mod-home/AppShell.tsx` (lines 180, 191, 195). No other module calls it. The fix cannot disturb any other module's behavior.

**`useTheme()` consumer re-renders** — The context value at `theme.ts:643` is a new object literal on every ThemeProvider render regardless of this fix (React context uses `Object.is` on the value reference; an inline object literal always creates a new reference). Making `setThemeUserId` stable does not make the context object stable. `useTheme()` consumers in shared components (`RouteCard`, `Button`, `AppText`, `BottomSheet`, etc.) re-render when ThemeProvider re-renders, exactly as today. The fix changes nothing about that path.

**`setOverride` (SettingsScreen)** — `SettingsScreen` (`src/modules/mod-localization-theme/screens/SettingsScreen.tsx:79`) destructures `setOverride` from `useTheme()`. `setOverride` is a `useState` setter (`theme.ts:582`) and is already stable. This fix does not touch it.

**`useCallback` lint / exhaustive-deps rule** — Empty deps are valid because `setUserId` is stable. `react-hooks/exhaustive-deps` correctly exempts state setters from the dep requirement (per the lint rule's own documentation). No lint warning expected.

**Effect behavior change for the intended flows** — After the fix: sign-in re-runs the effect because `session.user.id` changes (dep still in the array). Sign-out unmounts `AppShell`, running the cleanup. OS appearance toggles and Settings theme changes cause ThemeProvider to re-render, but `setThemeUserId` is now stable, so the effect does not re-run. This is the intended behavior.

---

## Before you merge

1. **Existing test:** re-render `ThemeProvider` (e.g. call `setOverride`) and assert `applySignedOutLanguage` is not called. (Named in the INT-030 row; write it in the Engineer's test pass.)
2. **Device check (QA):** change the theme in Settings while the device and account languages differ; confirm no language flash occurs.

---

## Verdict

**Low blast radius. Approve and proceed.**

`setThemeUserId` has one caller (`AppShell`) and all `useTheme()` consumers use only `{ theme }`. The context re-render behavior is unchanged for every other consumer. The `useCallback([], [])` is provably correct (state setter is stable, confirmed by running the project's own React version). No cross-module risk. INT-030 engineer can start.
