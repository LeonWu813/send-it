# Send It — Environment Setup Runbook

This runbook walks Leon through provisioning everything needed to run and build the Send It iOS app in development. Do these steps in order. When done, run the Setup Confirmation step at the bottom.

**Project shape**: React Native + Expo (TypeScript), iOS-only, Supabase hosted BaaS, PostHog analytics. There is **no self-hosted backend** and **no Docker** in this project — Supabase is a hosted service.

---

## 0. Prerequisite tool versions

Verified on this machine (2026-09-19):

| Tool | Installed | Required by PRD | Status |
|------|-----------|-----------------|--------|
| macOS | 26.5.2 | any recent | OK |
| Node.js | v24.14.1 | **18 LTS or 20 LTS** (Expo SDK 51+) | **Mismatch — see step 1** |
| npm | 11.11.0 | any recent | OK |
| git | 2.51.0 | any recent | OK |
| Xcode (full IDE) | not installed | required for iOS builds | **Missing — see step 2** |
| Expo CLI | not installed | required | Install in step 3 |
| EAS CLI | not installed | required for TestFlight | Install in step 3 |
| Supabase CLI | not installed | required for migrations + Edge Functions | Install in step 3 |

---

## 1. Node.js — install a supported LTS

Node 24 is newer than Expo SDK 51's officially supported range (Node 18 LTS or Node 20 LTS). React Native tooling and some Expo modules may fail or emit warnings on Node 24. Install Node 20 LTS and use it as the default for this project.

Recommended: install [`fnm`](https://github.com/Schniz/fnm) or `nvm` and pin the project to Node 20.

```bash
# fnm example
brew install fnm
fnm install 20
fnm use 20
node --version   # should print v20.x
```

Then, from the project root, create `.nvmrc`:

```bash
echo "20" > .nvmrc
```

(This will be picked up by both `nvm` and `fnm`.)

**Do not proceed until `node --version` returns a `v20.x` line inside this project directory.**

---

## 2. Xcode (full IDE) + Command Line Tools

Only the Command Line Tools are currently installed. Building a runnable iOS app (simulator or device) requires the full Xcode IDE from the Mac App Store.

1. Install **Xcode 15.4+** from the Mac App Store (~7 GB download).
2. Open Xcode once and accept the license.
3. Point the active developer directory at Xcode.app:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version   # should print Xcode 15.x
   ```

4. Install CocoaPods (required when Expo prebuild generates native iOS project):

   ```bash
   sudo gem install cocoapods
   pod --version
   ```

5. Install the iOS Simulator runtime from Xcode → Settings → Platforms if not present.

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

## 4. Apple Developer account

Required before you can push to TestFlight or use APNs.

1. Enroll at https://developer.apple.com/programs/ (US$99/year).
2. Note your Team ID (Settings → Membership).
3. Create an App ID and provisioning profile — EAS Build can do this automatically in step 9, so you don't need to do it manually now.
4. For APNs: create an **APNs Auth Key** (Keys → +). Download the `.p8` file — you can only download it once. You'll upload this to Expo in step 8.

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
2. Create a new project. Region: **Southeast Asia (Singapore)** — closest to Taiwan for lowest latency.
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

## 8. Expo push credentials

1. Sign up / log in at https://expo.dev.
2. Create an Expo organization and a project called `send-it`.
3. Upload your Apple APNs Auth Key (`.p8` from step 4):

   ```bash
   eas login
   eas credentials
   # follow prompts: iOS → Production → Push Notifications → Set up
   ```

4. Create an Expo access token (Account Settings → Access Tokens). This is used by the Edge Function to call Expo's push send API server-side.
5. Store the access token as a Supabase secret (do NOT put it in `.env`):

   ```bash
   supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

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
