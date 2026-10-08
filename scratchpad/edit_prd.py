import io

path = "/Users/tsan/Desktop/MacBookPro/send-it/project-planning/prd.md"
with io.open(path, "r", encoding="utf-8") as f:
    text = f.read()

replacements = []

# 1. Revision header
old_header = """**Author**: Leon
**Status**: [TRIVIAL] — Revision 31
**Date**: 2026-10-05
**Revision**: 31"""
new_header = """**Author**: Leon
**Status**: [SUBSTANTIVE] — Revision 32
**Date**: 2026-10-07
**Revision**: 32"""
replacements.append((old_header, new_header))

# 2. US-009 acceptance criteria list
old_us009 = "**Acceptance Criteria**: AC-054, AC-055, AC-056, AC-058"
new_us009 = "**Acceptance Criteria**: AC-054, AC-055, AC-056, AC-058, AC-171, AC-172, AC-173"
replacements.append((old_us009, new_us009))

# 3. MOD-007 Purpose (§6)
old_mod007 = """**Purpose**: Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox."""
new_mod007 = """**Purpose**: Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox. Own the `NotificationInboxScreen` (a list of the current user's in-app notifications, most recent first), reached via a bell icon placed in MOD-001's ProfileScreen header (AC-171). On inbox mount, batch-mark all of the current user's unread notifications as read in a single update (AC-172). Own the unread-count badge rendered on that bell icon, which reflects the current user's unread-notification count and clears when the inbox is opened (AC-173). Tapping a beta-video-like entry in the inbox navigates to the actor's UserProfileScreen (MOD-006), resolved from the notification's existing `actor_user_id` column (AC-058, revised)."""
replacements.append((old_mod007, new_mod007))

# 4. AC-058 revision (§8)
old_ac058 = """**AC-058** (new): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the liked beta video (on its route detail screen) when the user taps the entry, resolving the notification's `target_id` to the target beta video."""
new_ac058 = """**AC-058** (revised, Rev 32): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the **UserProfileScreen of the actor** (the user who liked the video) when the user taps the entry, resolving the notification's existing `actor_user_id` column directly — no additional query is required, as `actor_user_id` is already present on the `Notification` row (see §9 Data Model). The destination is MOD-006's `UserProfileScreen` (the other-user profile overlay, AC-064), subject to the actor's privacy setting (AC-063). This supersedes the prior AC-058 behavior of navigating to the liked video's route detail screen. No changes to MOD-003 or MOD-005 are required."""
replacements.append((old_ac058, new_ac058))

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit("Expected exactly 1 match, found %d for:\n%s" % (count, old[:80]))
    text = text.replace(old, new)

# 5. Append AC-171, AC-172, AC-173 after the MOD-007 push idempotency implementation note
anchor = """> **Implementation note (MOD-007 push idempotency)**: The notification/push fan-out Edge Function must be invoked by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never triggered from the client. The function must be idempotent: a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` guarantees a second trigger fire (double-tap / client retry) cannot create a duplicate notification row or a duplicate push. This is a requirement for the MOD-007 spec."""

new_acs = """**AC-171** (new, Rev 32): The system shall present a bell icon in the top-right of the `ProfileScreen` header (the MOD-001 Profile tab surface). Tapping the bell shall push a new `NotificationInboxScreen` (owned by MOD-007) that lists the current user's in-app notifications, most recent first. The `NotificationInboxScreen` and its contents are owned by MOD-007; the bell entry point is placed in MOD-001's ProfileScreen header and wired to navigate to MOD-007's inbox screen.

**AC-172** (new, Rev 32): When `NotificationInboxScreen` mounts, the system shall mark all of the current user's unread notifications as read in a single batch update — all `Notification` rows where `recipient_user_id` equals the current user and `is_read = false` are set to `is_read = true`. Tapping an individual notification row shall not separately change that row's read state; the batch mark-read on inbox mount is the sole read-state transition in Phase 1.

**AC-173** (new, Rev 32): The bell icon in the ProfileScreen header (AC-171) shall display an unread-count badge when the current user has one or more unread notifications (`Notification` rows where `recipient_user_id` equals the current user and `is_read = false`). The badge value shall equal the number of unread rows. The badge shall disappear when the inbox is opened and the batch mark-read (AC-172) completes.

"""

if text.count(anchor) != 1:
    raise SystemExit("anchor not found exactly once")
text = text.replace(anchor, new_acs + anchor)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("prd.md updated successfully")
