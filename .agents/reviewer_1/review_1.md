# Firebase Migration Review Report — Reviewer 1

**Date**: 2026-06-29  
**Target Commit/Worktree**: `AEVUM-2.0/fix-broken-build-process`  
**Verdict**: **REQUEST_CHANGES** (due to broken test suites in both server and client)

---

## Part 1: Quality Review

### Review Summary
The Firebase migration successfully transitions the Aevum application from a monolithic Express backend serving static assets to a serverless architecture utilizing Firebase Cloud Functions (v2 HTTPS) and Firebase Storage. The routing and configuration changes are logically sound. However, the unit test suites on both the server and client have critical discrepancies that will fail in automated CI environments.

---

## Findings

### [Critical] Finding 1: Broken Firebase Admin Unit Tests (Server)
- **What**: The unit tests in `server/lib/firebaseAdmin.test.js` (and its duplicated copy in `functions/lib/firebaseAdmin.test.js`) are failing.
- **Where**: `server/lib/firebaseAdmin.test.js` (lines 55-75) and `functions/lib/firebaseAdmin.test.js` (lines 55-75).
- **Why**: In `server/lib/firebaseAdmin.js`, the initialization was refactored to use Application Default Credentials (ADC) via `initializeApp()` with no arguments. However, the tests still assert that `ADMIN_ENABLED` must be `false` when `FIREBASE_SERVICE_ACCOUNT_JSON` is missing or invalid, and they expect console warning logs that are no longer produced. Under the new implementation, the mocked `initializeApp()` succeeds unconditionally, causing `ADMIN_ENABLED` to be `true` and the assertions to fail.
- **Suggestion**: Update the test files to remove the `FIREBASE_SERVICE_ACCOUNT_JSON` checks and align the test assertions with the new ADC-based initialization logic.

### [Major] Finding 2: Non-Hermetic Storage Security Rules Test (Client)
- **What**: The client test suite contains a test file `client/src/lib/storageRules.test.js` that connects to the real local Firebase Auth and Storage emulators.
- **Where**: `client/src/lib/storageRules.test.js` (lines 37-38).
- **Why**: Running `npm run test` or `vitest run` in the `client/` directory will fail during `beforeAll` if the Firebase emulators are not already running on the local host. Unit tests should be hermetic and not depend on running external services.
- **Suggestion**: Either:
  1. Move `storageRules.test.js` to an integration-specific test directory (e.g., `client/src/integration/`) and exclude it from the default unit test suite run.
  2. Add a check in `storageRules.test.js` to skip the tests if the emulators are not reachable, or ensure the build/CI pipeline explicitly starts the emulators before running tests.

### [Minor] Finding 3: Sentry ESM Instrumentation Timing
- **What**: Sentry is imported and initialized in `server/index.js`, but due to ES Module (ESM) hoisting, other modules are imported before Sentry is initialized.
- **Where**: `server/index.js` (lines 18-25).
- **Why**: In ESM, all `import` statements are executed before the module body. Therefore, `express`, `cors`, `stripe`, etc., are imported before `Sentry.init()` is executed. Sentry requires initialization before importing instrumented modules to ensure auto-instrumentation works correctly.
- **Suggestion**: Move Sentry initialization to a separate file (e.g., `server/instrument.js`) and import it at the very top of `server/index.js` before any other imports, or use the Sentry node loader.

---

## Verified Claims

- **Cloud Functions routing** → verified via `firebase.json` and `server/index.js` analysis → **PASS**
  - All `/api/**` requests are correctly routed to the `api` HTTPS Cloud Function.
- **Library text decoupling** → verified via `client/src/components/dashboard/LibraryContext.jsx` and `client/src/lib/firebase.js` → **PASS**
  - Astrological texts are now fetched directly from Firebase Storage via `fetchLibraryText(filename)` instead of the Express backend.
- **Functions synchronization** → verified via `scripts/sync-functions.js` and `firebase.json` `predeploy` hook → **PASS**
  - Automatically syncs/links `lib/`, `routes/`, and `index.js` from `server/` to `functions/` before deployment or emulator startup.

---

## Coverage Gaps

- **Build execution and emulator E2E verification** — risk level: **MEDIUM**
  - **Reason not verified**: Local command execution (`npm run build`, `firebase emulators:start`) timed out waiting for user approval.
  - **Recommendation**: Ensure the orchestrator or a human operator runs the full build and E2E emulator checks to verify runtime behavior.

---

## Part 2: Adversarial Review (Critic)

### Challenge Summary
- **Overall risk assessment**: **MEDIUM**
- The primary security risk lies in the Firebase Storage security rules, which rely on a hardcoded email address check. If the authentication configuration is not locked down, this check can be bypassed. Additionally, local emulator connection logic has usability issues when testing on external or mobile devices.

---

## Challenges

### [High] Challenge 1: Hardcoded Email Bypass via Unverified Email Sign-up
- **Assumption challenged**: The storage rule assumes that only the legitimate owner of `tsgoddessfireaf@gmail.com` can write to the bucket because of the check `request.auth.token.email == 'tsgoddessfireaf@gmail.com'`.
- **Attack scenario**: If the Firebase project allows Email/Password authentication and does not enforce email verification, an attacker can register a new account with the email `tsgoddessfireaf@gmail.com` and any password. Firebase Auth will issue a valid ID token with `email: 'tsgoddessfireaf@gmail.com'`. The attacker can then write arbitrary files to `users/{attacker_uid}/readings/...`, bypassing the practitioner restriction.
- **Blast radius**: Unauthorized write access to the Firebase Storage bucket under user-specific paths, potentially leading to storage quota exhaustion or hosting malicious files.
- **Mitigation**:
  1. Add `request.auth.token.email_verified == true` to the write condition in `storage.rules`.
  2. Better yet, use custom user claims (e.g., `request.auth.token.role == 'practitioner'`) rather than hardcoded email strings to authorize writes.

### [Medium] Challenge 2: Emulator Connection Failures on Non-Local Hostnames
- **Assumption challenged**: The client assumes that the local emulators are always accessible via `localhost` or that the app is only tested on `localhost`.
- **Attack/Failure scenario**: If a developer accesses the Vite dev server from a mobile device or tablet on the same local network (e.g., `http://192.168.1.5:5173`) to test the premium UI, `import.meta.env.DEV` will be `true`, and the client will attempt to connect to the Firebase emulators at `localhost:8080`, `localhost:9099`, and `localhost:9199`. On the mobile device, `localhost` refers to the device itself, leading to connection failures.
- **Blast radius**: Inability to test the application or perform E2E checks on mobile devices/tablets during local development.
- **Mitigation**: Dynamically determine the emulator host using `window.location.hostname` instead of hardcoding `'localhost'`:
  ```javascript
  const host = window.location.hostname;
  connectFirestoreEmulator(db, host, 8080);
  connectAuthEmulator(auth, `http://${host}:9099`);
  connectStorageEmulator(storage, host, 9199);
  ```

---

## Stress Test Results

- **Run unit tests without emulators** → **FAIL** (Client test suite fails because `storageRules.test.js` requires active emulators).
- **Verify Firebase Admin tests with ADC** → **FAIL** (Server test suite fails because tests assert on old `FIREBASE_SERVICE_ACCOUNT_JSON` logic).
