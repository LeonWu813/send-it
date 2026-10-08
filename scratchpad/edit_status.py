import io

path = "/Users/tsan/Desktop/MacBookPro/send-it/project-planning/status.md"
with io.open(path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Replace Last Action block
old_last = """```
agent: qa-mod-beta-video
mode: regression
module: mod-beta-video
result: success
commit: d8c7b157e2c9245a77150a6544f5293f20e13211
timestamp: 2026-10-07T00:00:00Z
```"""
new_last = """```
agent: pm
mode: change
module: n/a
result: success
commit: __COMMIT__
timestamp: 2026-10-07T00:00:00Z
```"""
if text.count(old_last) != 1:
    raise SystemExit("Last Action block not found exactly once")
text = text.replace(old_last, new_last)

# 2. Insert new PM Updates entry directly above the most recent one
anchor = "- **2026-10-05 [TRIVIAL]** — Reused `expo-video` `VideoView` source-swap Shared Convention"
new_entry = """- **2026-10-07 [SUBSTANTIVE]** — MOD-007 Notifications: four user-confirmed decisions closing gaps in the in-app notification inbox (PRD Revision 32). Leon (via coordinator) approved the exact change set verbatim and directed the [SUBSTANTIVE] tag. PRD Status line `[SUBSTANTIVE] — Revision 32`; `**Revision**` bumped 31 → 32; Date 2026-10-07. **No DB migration required** — the `Notification` table already carries `recipient_user_id`, `actor_user_id`, `target_id`, `target_type`, and `is_read` (PRD §9 Data Model). **Four decisions**:
  1. **Inbox location (AC-171, new)** — the in-app notification inbox is reached via a bell icon in the top-right of MOD-001's `ProfileScreen` header; tapping the bell pushes a new `NotificationInboxScreen` owned by MOD-007. The prior spec named an in-app inbox in MOD-007's Purpose but never specified where it lives.
  2. **AC-058 navigation contract (AC-058, revised)** — tapping a beta-video-like entry in the inbox now navigates to the **actor's `UserProfileScreen`** (MOD-006), resolved directly from the notification's existing `actor_user_id` column (no extra query). This supersedes the prior AC-058 behavior of navigating to the liked video's route detail screen. **No changes to MOD-003 or MOD-005 are required.**
  3. **Batch read/unread UX (AC-172, new)** — on `NotificationInboxScreen` mount, all of the current user's unread notifications are marked read in a single batch update (`recipient_user_id` = current user AND `is_read = false` → `is_read = true`). Individual row tap does not separately mark read.
  4. **Unread badge (AC-173, new)** — the bell icon shows an unread-count badge equal to the number of the current user's unread rows (`is_read = false`); the badge clears when the inbox opens and the AC-172 batch mark-read fires.
  - **Scope/boundaries**: No module boundary changes, no dependency changes, no phase-plan changes. MOD-007 already depends on MOD-001 (bell placed in its ProfileScreen header) and MOD-006 (UserProfileScreen nav target) — both declared dependencies are correct as-is. Changes: 3 new ACs (AC-171/172/173) + 1 revised AC (AC-058), all under MOD-007; US-009 criteria list extended to cite the three new ACs; MOD-007 §6 Purpose expanded.
  - **For Doc-Sync**: sync the MOD-007 spec for AC-171/172/173 and the revised AC-058. Carry two cross-module integration points: (a) the bell entry point placed in MOD-001's `ProfileScreen` header wiring to MOD-007's `NotificationInboxScreen` (AC-171), and (b) the AC-058 inbox-tap navigation target = MOD-006's `UserProfileScreen` (resolved from `actor_user_id`). No new module, no new module directory.

"""
if text.count(anchor) != 1:
    raise SystemExit("PM Updates anchor not found exactly once")
text = text.replace(anchor, new_entry + anchor)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("status.md updated successfully")
