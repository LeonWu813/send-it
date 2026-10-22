# ProjectDay — Environment Setup Runbook

This runbook walks Leon through provisioning everything needed to run and build the ProjectDay iOS app (formerly "Send It"; renamed in PRD Rev 47) in development. Do these steps in order. When done, run the Setup Confirmation step at the bottom.

> **Rename (Rev 47).** The repository folder was renamed to `/Users/tsan/Desktop/MacBookPro/projectday` (step 11.8, confirmed 2026-10-21); the paths in steps 1–10 now use it. Steps 1–10 still mention the old Expo and PostHog project names where they record the original setup. Section 11 lists what you had to do again or newly for ProjectDay.

**Project shape**: React Native + Expo (TypeScript), iOS-only, Supabase hosted BaaS, PostHog analytics. There is **no self-hosted backend** and **no Docker** in this project — Supabase is a hosted service.

---

## 0. Prerequisite tool versions

Verified on this machine (2026-09-19):

| Tool | Installed | Required by PRD | Status |
|------|-----------|-----------------|--------|
| macOS | 26.5.2 | any recent | ✅ OK |
| Node.js | v20.20.2 (nvm) | 18 LTS or 20 LTS | ✅ OK — `.nvmrc` pinned to 20 |
| npm | 11.11.0 | any recent | ✅ OK |
| git | 2.51.0 | any recent | ✅ OK |
| Xcode (full IDE) | 26.6 (Build 17F113) | required for iOS builds | ✅ OK |
| CocoaPods | not installed | required for Expo prebuild | ⏳ Install in step 2 |
| EAS CLI | not installed | required for TestFlight | ⏳ Install in step 3 |
| Supabase CLI | not installed | required for migrations + Edge Functions | ⏳ Install in step 3 |

---

## 1. Node.js ✅ DONE

Node 20 LTS (v20.20.2) is installed via nvm and set as the project default. `.nvmrc` is pinned to `20` in the project root. No action needed.

To confirm in any new shell:
```bash
cd /Users/tsan/Desktop/MacBookPro/projectday
nvm use   # picks up .nvmrc automatically
node --version   # v20.20.2
```

---

## 2. Xcode (full IDE) + CocoaPods

Xcode 26.6 (Build 17F113) is installed and `xcode-select` points to Xcode.app. ✅

**One remaining step — install CocoaPods** (required when Expo prebuild generates the native iOS project):

```bash
sudo gem install cocoapods
pod --version
```

Then install the iOS Simulator runtime if not already present: **Xcode → Settings → Platforms → add iOS simulator**.

---

## 3. Global CLIs

```bash
# Expo CLI is now bundled with each app — install per-project (see step 5).
# But EAS CLI and Supabase CLI are global:

npm install -g eas-cli
brew install supabase/tap/supabase

eas --version
supabase --version
```

---

## 4. Apple Developer account — DEFERRED

**Decision (2026-09-19):** Defer until ready for physical device testing or TestFlight beta. The $99/year membership is not needed during simulator-based development.

**Join when you hit one of these triggers:**
- Want to test on a real iPhone
- Ready to invite beta testers via TestFlight
- Submitting to the App Store

When you do join:
1. Enroll at https://developer.apple.com/programs/ (US$99/year)
2. Note your Team ID (Settings → Membership)
3. Create an APNs Auth Key (Keys → +) — download the `.p8` once and store safely
4. Upload the `.p8` to Expo (see step 8)

---

## 5. Initialize the Expo project (Engineer will do this during MOD-001)

The Engineer will run this during MOD-001 scaffolding. Do **not** run it now unless you want a placeholder to verify tooling. If you do want to verify:

```bash
cd /Users/tsan/Desktop/MacBookPro/projectday
npx create-expo-app@latest . --template blank-typescript
```

(This will fail if the directory contains unexpected files; skip for now and let the Engineer scaffold cleanly in MOD-001.)

---

## 6. Create the Supabase project

1. Sign up / log in at https://app.supabase.com.
2. Create a new project. Region: **Northeast Asia (Tokyo)** — closer to Taiwan (~2,100 km vs Singapore's ~3,200 km), lower latency for your users.
3. Choose a strong DB password and store it in your password manager (you rarely need it — the anon and service_role keys are what the app and Edge Functions use).
4. Wait for the project to finish provisioning (~2 min).
5. From Settings → API, copy:
   - **Project URL** → paste into `.env` as `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** → paste into `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → keep in your password manager. Do **not** put in `.env`.

6. Link your local project to the Supabase project:

   ```bash
   cd /Users/tsan/Desktop/MacBookPro/projectday
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```

---

## 7. PostHog project

1. Sign up at https://app.posthog.com (free tier).
2. Create a new project called "Send It".
3. Copy the Project API Key → paste into `.env` as `EXPO_PUBLIC_POSTHOG_API_KEY`.
4. Confirm the region (US or EU) and set `EXPO_PUBLIC_POSTHOG_HOST` accordingly in `.env`.

---

## 8. Expo push credentials — PARTIALLY DEFERRED

APNs credential upload requires the Apple Developer account (step 4, deferred). Do the non-APNs parts now:

1. Sign up / log in at https://expo.dev
2. Create an Expo organization and a project called `send-it` *(superseded by step 11.4: a new Expo project for ProjectDay)*
3. Create an Expo access token (Account Settings → Access Tokens)
4. Store the access token as a Supabase secret:

   ```bash
   supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
   supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
   ```

**Defer until Apple Developer account is active:**
- `eas credentials` APNs `.p8` upload (iOS → Production → Push Notifications → Set up)

---

## 9. Copy .env.example → .env and fill in real values

```bash
cd /Users/tsan/Desktop/MacBookPro/projectday
cp .env.example .env
# open .env in your editor and paste the real values from steps 6 and 7.
```

Verify `.env` is git-ignored:

```bash
git check-ignore -v .env   # should print: .gitignore:5:.env    .env
```

---

## 10. Verify: install dependencies, run dev server, run build

These commands will only succeed **after** the Engineer has scaffolded the Expo app in MOD-001. Until then, running them will fail — that's expected. Once MOD-001 is in place:

```bash
# Install
npm install

# Dev server (opens Metro bundler; press "i" to launch iOS simulator)
npx expo start --ios

# Type-check
npx tsc --noEmit

# Lint (Engineer will configure ESLint in MOD-001)
npm run lint

# Test (Engineer will configure Jest / React Native Testing Library in MOD-001)
npm test

# Production build for TestFlight (requires steps 4 + 8 complete)
eas build --profile production --platform ios
```

---

## 11. Rename to ProjectDay (PRD Rev 47, AC-199 / AC-200) — steps only Leon can do

Added 2026-10-21 by Tech Lead (change review). These steps happen in your own accounts and dashboards, outside the repository. Do them **in the order of the "When" column**: some must happen before the Engineers' changes reach a build, some only after.

`<BUNDLE_ID>` and `<SLUG>` below mean the values you choose in the Tech Lead's question Q2 (recommended: `com.projectday.twbouldering` and `projectday`). Do not start 11.2 or 11.5 until you have answered Q2. A bundle ID cannot be changed once its App Store Connect record exists.

| Step | When |
|---|---|
| 11.1 Supabase redirect URL: add | **Before** any ProjectDay build is installed |
| 11.2 Supabase Apple provider Client ID | Before Apple Sign-In is tested on the new build |
| 11.3 Google consent screen name | Any time |
| 11.4 New Expo project | **Before** engineer-mod-home edits `app.json` (it needs the project ID) |
| 11.5 Apple Developer + App Store Connect | When the Apple Developer account is active (step 4) |
| 11.6 Devices | After the first ProjectDay build installs |
| 11.7 Deploy migration + Edge Functions | After the MOD-002 / MOD-007 / MOD-009 Engineers finish |
| 11.1b Supabase redirect URL: remove old | After a ProjectDay build signs in with Google |
| 11.8 Rename the repo folder | **Last**, after every Engineer change for AC-200 is committed and no agent is running |

### 11.1 Supabase Auth: redirect URL allow-list

Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**:

1. **Add** `projectday://**`.
2. **Keep** `send-it://**` for now. Debug builds of the current code still redirect to `send-it://`, so removing it first breaks Google sign-in in development before the code change lands.
3. **11.1b (later):** once a ProjectDay build completes Google sign-in, **remove** `send-it://**`.

If `projectday://**` is missing, Supabase silently redirects to the Site URL instead and Google sign-in never returns to the app.

### 11.2 Supabase Auth: Apple provider Client IDs

Supabase dashboard → **Authentication → Providers → Apple → Client IDs**: add `<BUNDLE_ID>`. Remove `com.sendit.twbouldering` once no "Send It" build is still in use. (Native Apple sign-in sends an ID token whose audience is the bundle ID, and Supabase rejects any audience that is not on this list.)

### 11.3 Google Cloud Console: OAuth consent screen

Google Cloud Console → **APIs & Services → OAuth consent screen** (Branding): change the app name from "Send It" to **ProjectDay**, and update the logo and home-page links if they mention the old name. The OAuth **client** does not change: the Google flow goes through Supabase's `/auth/v1/callback`, which does not depend on the bundle ID or the app scheme.

### 11.4 Expo: new project for the new slug

1. On https://expo.dev, create a new project named `<SLUG>` under your account or organization.
2. Copy its **Project ID** (a UUID such as `1a2b3c4d-…`; it is not a secret).
3. Give the Project ID to the coordinator for `engineer-mod-home`. It goes into `app.json` → `extra.eas.projectId`. The current value (`send-it-tw-bouldering-app`) is not a UUID, so `getExpoPushTokenAsync()` cannot work with it once APNs is set up.
4. Do **not** run `eas init` in the repo yourself. It rewrites `app.json`, which belongs to `engineer-mod-home`.
5. `EXPO_ACCESS_TOKEN` (Supabase secret, step 8) is account-level and does not change.

### 11.5 Apple Developer + App Store Connect (when the account is active)

1. developer.apple.com → **Identifiers → +** → App ID with bundle ID `<BUNDLE_ID>`. Enable the **Sign in with Apple** and **Push Notifications** capabilities.
2. The APNs `.p8` key (step 4) works for every app in your team. Run `eas credentials` (iOS → production → Push Notifications) for `<BUNDLE_ID>`.
3. App Store Connect → **Apps → + → New App**: platform iOS, name **ProjectDay**, bundle ID `<BUNDLE_ID>`, SKU of your choice. Set the **subtitle** to the 30-character-or-shorter text you choose in the Tech Lead's question Q1. The 46-character "Taiwan Climbing Route Tracker and Beta Sharing" will be rejected by App Store Connect.
4. Builds and TestFlight testers under any old "Send It" record do **not** move over. Testers must install ProjectDay as a new app. Leave or remove the old record as you like.

### 11.6 Devices and simulators

- ProjectDay installs as a **separate app** next to any "Send It" build. Delete the old app.
- You will be signed out once. The session is stored in the iOS keychain, which is tied to the bundle ID.
- Old push tokens in the database belong to the old app and will stop working. The app registers new ones on sign-in (AC-054). No action needed before launch.

### 11.7 Deploy the server-side parts

Code changes to Edge Functions and migrations take effect only after deployment. Once the Engineers for MOD-002, MOD-007 and MOD-009 have committed (and if they did not deploy themselves):

```bash
supabase db push                                   # applies the new mod_002 gym-notes UPDATE migration
supabase functions deploy notify-beta-video-like   # push title "ProjectDay"
supabase functions deploy report-digest            # email header; keep its existing schedule
supabase migration list                            # confirm the new migration shows as applied on remote
```

### 11.8 Rename the repository folder (last)

Do this only after every AC-200 Engineer change is committed and no Claude Code session or agent is running in this folder.

1. Quit Claude Code. `mv /Users/tsan/Desktop/MacBookPro/send-it /Users/tsan/Desktop/MacBookPro/projectday` *(done 2026-10-21; the old path is kept here only as the record of the move)*
2. Move Claude Code's project memory so it carries over: `mv ~/.claude/projects/-Users-tsan-Desktop-MacBookPro-send-it ~/.claude/projects/-Users-tsan-Desktop-MacBookPro-projectday` (the key is the absolute path with `/` replaced by `-`).
3. Reopen Claude Code in the new folder and run `claude --agent doc-sync "template refresh"`. This regenerates the 24 engineer/QA agents, which embed the old absolute path.
4. Run `cd ios && pod install`, then do one clean Xcode build (Product → Clean Build Folder). Pods and DerivedData cache absolute paths.
5. Run `claude --agent tech-lead "Setup is complete"` so the Tech Lead can update the paths in this file and run the AC-200(3) check.

---

## Setup Confirmation

Once all steps above complete successfully:

1. Re-invoke the Tech Lead agent with the message: **"Setup is complete."**
2. The Tech Lead will verify the environment and record confirmation in `status.md`.

**Do not invoke the PM agent until Tech Lead has recorded setup confirmation.**

### What Tech Lead will verify at confirmation

- `node --version` returns v20.x (or v18.x LTS).
- `xcodebuild -version` returns a valid Xcode version.
- `eas --version` and `supabase --version` both succeed.
- `.env` exists (`[ -f .env ]`) and is gitignored (`git check-ignore .env`). Tech Lead never opens, prints, greps, or otherwise reads `.env`.
- That `.env` holds real values for the required keys (not the `.env.example` placeholders) is **your** check. Tech Lead takes your word for it and does not inspect it.
- That the Supabase project is reachable is also **your** check: start the app with `npx expo start --ios` and confirm it loads data from Supabase. Tech Lead does not `curl` the Supabase URL or run any command that uses a value from `.env`.
