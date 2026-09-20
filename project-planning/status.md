# Send It — Project Status

## Last Action

```
agent: qa-mod-send-logging
mode: verify
module: mod-send-logging
result: pending-human-signoff
commit: ba83bb7007c2a67d100a07106af160753945dd97
timestamp: 2026-09-20T00:00:00Z
```

## Module Map

| MOD-ID  | Directory              | Status      | Agent last acted          |
|---------|------------------------|-------------|---------------------------|
| MOD-001 | mod-auth-profile       | QA Passed   | qa-mod-auth-profile       |
| MOD-002 | mod-gym-directory      | QA Passed   | qa-mod-gym-directory      |
| MOD-003 | mod-route-catalog      | QA Passed   | qa-mod-route-catalog      |
| MOD-004 | mod-send-logging       | QA Pending Human Sign-off | qa-mod-send-logging |
| MOD-005 | mod-beta-video         | Not started | —                         |
| MOD-006 | mod-social-feed        | Not started | —                         |
| MOD-007 | mod-notifications      | Not started | —                         |
| MOD-008 | mod-profile-history    | Not started | —                         |
| MOD-009 | mod-moderation         | Not started | —                         |
| MOD-010 | mod-localization-theme | Not started | —                         |
| MOD-011 | mod-analytics          | Not started | —                         |

## Skill Recommendations

- **Cross-module i18n catalog updates**: When a module adds user-facing strings, the engineer must also update `locales/en/common.json` and `locales/zh-TW/common.json`. The self-check script's git scope check flags these as "out of scope" but they are required by the production.md i18n convention. The self-check script should be updated to whitelist `locales/` as an allowed cross-cutting path for any module implementing i18n strings. Alternatively, each module should own its own locale namespace file (e.g. `locales/en/routes.json`) to stay within the module boundary.

- **React Native named colors for enum-to-color mappings**: When a domain enum (like route hold colors) needs to render as a visual chip, map enum values to React Native's built-in named color strings (e.g. `'red'`, `'blue'`) rather than hex literals. Named colors are OS-resolved (not hardcoded hex), satisfy the "no hardcoded hex" convention, and are visually accurate. Document this in the skill as an approved pattern for enum-color mapping in RN components.

- **Generated column formula must match spec exactly**: When a spec and production.md both document a Postgres GENERATED ALWAYS AS formula, verify the migration SQL matches character-for-character (including separators). Even cosmetic differences (e.g., adding `-` separators not in the spec formula) are spec deviations that QA must flag, even when there is zero functional impact. Add this to qa-checklist references as a pattern to check on any module with a GENERATED ALWAYS AS column.

- **Frontend modules: stale list after modal submission**: When a modal form submits and closes, any list rendered outside the modal (in the parent screen) will NOT re-fetch unless explicitly triggered. The standard pattern is to pass a refresh callback from the list to the success handler, or use a context/event bus. QA should check this pattern on every frontend module where a modal creates a new item that should appear in a visible list.

- **Frontend modules: "success confirmation" spec language is ambiguous**: Specs that say "Success confirmation shown to user" without specifying the form (toast, banner, or implicit modal dismissal) will generate a spec issue on every frontend module. PM should standardize this language in the spec template to specify the required UX pattern (e.g., "display a toast/snackbar message" vs. "dismiss the modal").
