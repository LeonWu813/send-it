# Send It — Environment Setup Runbook

This runbook walks Leon through provisioning everything needed to run and build the Send It iOS app in development. Do these steps in order. When done, run the Setup Confirmation step at the bottom.

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
cd /Users/tsan/Desktop/MacBookPro/send-it
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
cd /Users/tsan/Desktop/MacBookPro/send-it
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
   cd /Users/tsan/Desktop/MacBookPro/send-it
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
2. Create an Expo organization and a project called `send-it`
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
cd /Users/tsan/Desktop/MacBookPro/send-it
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

## Setup Confirmation

Once all steps above complete successfully:

1. Re-invoke the Tech Lead agent with the message: **"Setup is complete."**
2. The Tech Lead will verify the environment and record confirmation in `status.md`.

**Do not invoke the PM agent until Tech Lead has recorded setup confirmation.**

### What Tech Lead will verify at confirmation

- `node --version` returns v20.x (or v18.x LTS).
- `xcodebuild -version` returns a valid Xcode version.
- `eas --version` and `supabase --version` both succeed.
- `.env` exists and is not tracked by git.
- `.env` contains non-placeholder values for the required keys.
- Supabase project is reachable (a lightweight `curl` to the Supabase URL returns HTTP 200/401).
