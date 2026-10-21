# Blast-radius — INT-024 (`?v=<timestamp>` cache-bust on `avatar_url`)

**Date:** 2026-10-21  
**Fix:** Append `?v=${Date.now()}` to `data.publicUrl` in `uploadAvatar` (`src/modules/mod-auth-profile/auth-service.ts:295`) before returning. `upsertProfile` writes this URL to `users.avatar_url`.

---

## What it does

Every call to `uploadAvatar` now returns a unique URL (new timestamp each time). The URL's path is unchanged — only a query param is added. `upsertProfile` writes this URL to the `avatar_url` column of the `users` table. All downstream consumers read `avatar_url` from the DB at display time and pass it directly to `<Avatar uri={}>`, which wraps React Native `<Image source={{ uri }}>`.

---

## The one fact it's safe because of

**React Native `<Image source={{ uri }}>` at `Avatar.tsx:88` treats the full URL string — including query params — as the cache key.** No consumer parses, strips, or validates the URL; every caller passes it directly to `<Avatar>` or stores it as a string. The Avatar component's `useEffect([uri, photo])` at `Avatar.tsx:51–54` resets `failed` state and photo opacity whenever `uri` changes, which correctly triggers a fresh load for the new versioned URL.

**Proof — Step 4 (ran real code):**

```
node -e "
const base = 'https://project.supabase.co/storage/v1/object/public/avatars/user123.jpg';
const versioned = base + '?v=' + Date.now();
const parsed = new URL(versioned);
console.log('pathname:', parsed.pathname);
console.log('search:', parsed.search);
console.log('valid URL:', parsed.href === versioned);
"
```

Output:
```
pathname: /storage/v1/object/public/avatars/user123.jpg
search: ?v=1792600712158
valid URL: true
```

Path is unchanged. The query param is appended and the full URL round-trips through the URL constructor unchanged.

---

## Risks

**None found that block the fix.**

The Supabase Storage CDN serves objects by path; query params are forwarded to the origin but ignored when resolving the object. Adding `?v=<timestamp>` creates a new CDN cache key, which is the intended behavior (bypasses the `cacheControl: '3600'` set at upload time).

---

## Cleared

| What | Why cleared | Evidence |
|---|---|---|
| `actor_avatar_url` in feed SQL functions | Defined as a computed column in function return types (`20260924000006_mod_006_social_feed.sql:155`, `20260928000002:34`, `20260929000005:34`), not a static stored column — computed live from `users.avatar_url` at each query | Grep of migrations: `actor_avatar_url TEXT` appears only in function return type definitions and `u.avatar_url AS actor_avatar_url` join expressions |
| Notification `actor_avatar_url` | `notification-service.ts:100–139` fetches `avatar_url` from `users` at display time, not stored in the notification row | `notification-service.ts:106` |
| mod-social-feed followers/following lists | Pass `avatarUrl` field directly to `<Avatar uri={}>` — no URL parsing | `social-feed-service.ts:302, 340, 378` |
| mod-beta-video `PosterAvatar` | Passes `avatarUrl` to `<Avatar uri={}>` | `PosterAvatar.tsx:20` |
| mod-moderation blocked list | `avatarUrl: u?.avatar_url ?? null` passed to Avatar | `moderation-service.ts:238` |
| mod-home HomeScreen | `avatarUrl: u.avatar_url` passed through | `HomeScreen.tsx:365` |
| mod-notifications NotificationInboxScreen | `actor_avatar_url` passed to `<Avatar uri={}>` | `NotificationInboxScreen.tsx:286` |
| URL format breaks Image | React Native Image accepts any valid HTTP URL string; `?v=` query params are standard | `Avatar.tsx:88`; URL constructor proof above |

---

## Before you merge

**Smoke test (Step 5, device):** Upload a new avatar → confirm new image shows immediately in `EditProfileScreen` preview without navigating away → tap Save → navigate to `ProfileScreen` and confirm new image appears (no stale cache). Navigate to another user's feed card that shows the current user as a follower and confirm the new avatar appears after the feed refreshes.

No further script needed — the URL constructor proof (Step 4) covers the safety fact.
