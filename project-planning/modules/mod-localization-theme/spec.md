# MOD-010: Localization & Theming — Spec

**Module ID**: MOD-010
**Module Name**: Localization & Theming
**Phase**: 1
**Dependencies**: none

---

## Purpose

Provide i18n message catalog loading (English, zh-TW), device-locale detection with zh-TW fallback, in-app language toggle, and Light/Dark theming that follows OS preference with a manual Settings override.

---

## Context

Send It targets the Taiwan indoor bouldering community, so Traditional Chinese (zh-TW) is the primary fallback language. The app supports English and zh-TW only in Phase 1. On first launch, the device locale is detected: if English, the app language is set to English; for any other locale, the fallback is zh-TW. Users can toggle language in Settings with immediate effect (no app restart required). Light/Dark mode follows the OS preference by default; Settings exposes a three-state override (System / Light / Dark) that also takes effect without an app restart. All user-facing strings must be pulled through the i18n hook — no inline string literals in components. Message catalogs must be complete (no missing zh-TW keys) at ship. A CI check must fail on any missing zh-TW key. Every screen must use tokens from the theme provider — no hardcoded hex colors in components.

**Non-goals for this module:**
- Languages other than English and zh-TW (out of scope for Phase 1; Phase 2+ backlog for other languages).
- Right-to-left layout support (zh-TW and English are both LTR).
- Per-locale date/number formatting beyond what the i18n library provides (not specified as a requirement).

---

## User Stories Covered

- **US-017**: Use the app in Traditional Chinese or English
- **US-018**: Use the app in Dark Mode

---

## Acceptance Criteria Covered

**AC-090**: The system shall detect the device locale on first launch, set the app language to English if the device locale is English, and otherwise fall back to Traditional Chinese (zh-TW).

**AC-091**: The system shall expose a language toggle in Settings between English and zh-TW that takes effect immediately without an app restart.

**AC-092**: The system shall default to the OS Light/Dark appearance and expose a Settings override with three states (System, Light, Dark) that takes effect immediately without an app restart.

---

## Integration Points

none

---

## Data Model

No dedicated Supabase tables for this module. Language preference and theme preference may be persisted locally (e.g., via `AsyncStorage` or Expo SecureStore) or on the `User` profile row if persistence across devices is desired. The PRD does not specify cross-device sync of language/theme preference — the minimal approach is local persistence.

---

## Input / Output Contract

**Inputs (language detection on first launch):**
- Device locale from `expo-localization` (or equivalent)

**Outputs (language detection):**
- Active language set to `en` if device locale is English; `zh-TW` otherwise
- All user-facing strings loaded from the corresponding message catalog

**Inputs (language toggle in Settings):**
- User selection: English or zh-TW

**Outputs (language toggle):**
- Active language updated immediately — no app restart
- All rendered strings switch to the selected catalog

**Inputs (theme detection on launch):**
- OS appearance value from React Native `Appearance` API

**Outputs (theme detection):**
- Active theme follows OS (Light or Dark) by default

**Inputs (theme override in Settings):**
- User selection: System / Light / Dark

**Outputs (theme override):**
- Active theme updated immediately — no app restart
- All theme tokens update across the app

---

## Key Implementation Notes

- **Tech stack**: i18n-js or expo-localization + JSON message catalogs. Final library selection confirmed during MOD-010 engineering; the approach must support immediate language switching without restart.
- **i18n hook**: All user-facing strings must use the i18n hook (e.g., `t('key')`). No inline string literals in JSX or component code. This rule applies to every module.
- **CI completeness gate**: A CI check must fail if any English key lacks a zh-TW counterpart (e.g., `i18next-parser --fail-on-warnings` or a custom script). This check must be set up as part of MOD-010 and applied globally.
- **zh-TW fallback rule**: For any non-English device locale (e.g., Japanese, Spanish), the fallback is zh-TW — not English. English is served only when the device locale is explicitly English.
- **Theme tokens**: Every screen in every module must use tokens from the theme provider (e.g., colors defined as `theme.colors.background`, not `'#FFFFFF'`). MOD-010 owns the theme provider and token definitions. All other modules consume tokens.
- **Three-state override (AC-092)**: The Settings override has three states: System (follows OS), Light (forced), Dark (forced). The override takes effect immediately without an app restart.
- **Dark mode + zh-TW combinatorial testing**: QA must verify every screen in 4 combinations (light/dark × en/zh-TW). This should be incorporated into every module's test plan rather than treated as a one-off audit.
- **No hardcoded hex colors**: Any hardcoded `#RRGGBB` or `rgb()` color in component code is a defect. All colors must come from the theme token system.

---

## Out of Scope for This Module

- Languages other than English and zh-TW (Phase 1 only; additional locales are Phase 2+ backlog).
- Right-to-left layout support.
- Per-locale number/date formatting beyond what the i18n library provides out of the box.
- Android-specific locale or theme handling (Phase 2).
