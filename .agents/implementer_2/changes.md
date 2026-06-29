# Changes Report — Firebase Migration & Security Fixes

This report summarizes the modifications made to resolve the critical issues identified in the Firebase migration review, the security vulnerabilities, and the non-hermetic test suites.

---

## 1. Firebase Admin Initialization (`server/lib/firebaseAdmin.js`)
- **Change**: Replaced the unconditional call to `initializeApp()` (which assumed ADC and crashed in non-GCP production environments like Render) with a hybrid initialization approach.
- **Details**:
  - Checks if `process.env.FIREBASE_SERVICE_ACCOUNT_JSON` is set.
  - If set, parses the JSON and initializes Firebase Admin using `cert(serviceAccount)`.
  - If not set, falls back to `initializeApp()` with no arguments (Application Default Credentials).
  - Uses `getApps().length` to guard against multiple initializations.
  - Sets `ADMIN_ENABLED` to `true` if initialization succeeds, and `false` if it catches an error.
  - Added clear logging for both service account initialization and ADC fallback, as well as warning logs on failure.

## 2. Unit Tests Alignment (`server/lib/firebaseAdmin.test.js`)
- **Change**: Updated the test suite to align with the new hybrid initialization flow.
- **Details**:
  - Replaced the old test `logs info when FIREBASE_SERVICE_ACCOUNT_JSON is missing` (which asserted `ADMIN_ENABLED` was `false`) with two new tests:
    1. `initializes with ADC when FIREBASE_SERVICE_ACCOUNT_JSON is missing and ADC succeeds`: Asserts `ADMIN_ENABLED` is `true` and verifies the ADC info log.
    2. `fails initialization when FIREBASE_SERVICE_ACCOUNT_JSON is missing and ADC throws`: Asserts `ADMIN_ENABLED` is `false` and verifies the warning log.
  - Updated the `beforeEach` in the `firebaseAdmin uninitialized` block to mock `initializeApp` to throw an error, ensuring that the module is correctly tested in its uninitialized state.

## 3. Sync Script Fixes (`scripts/sync-functions.js`)
- **Change**: Replaced the `fs.existsSync` check with a robust `try/catch` block wrapping `fs.lstatSync` to prevent crashes on broken symlinks, and added warnings for Windows static copy fallbacks.
- **Details**:
  - `fs.existsSync` follows symlinks and returns `false` if a symlink is broken, leading the script to attempt to create a symlink/copy over an existing broken symlink file, causing `EEXIST` crashes. By using `fs.lstatSync(dest)` inside a `try/catch` block, we detect and remove any existing file or symlink (even if broken).
  - Added a clear warning message in the console when `fs.symlinkSync` fails and the script falls back to copying a file/directory on Windows, advising the developer to rerun the script if they modify the source files.

## 4. Restore Genuine `/api/chat/analyze` Streaming (`server/routes/chat.js`)
- **Change**: Replaced the token-saving mock facade in `/api/chat/analyze` with the genuine Anthropic Sonnet streaming implementation.
- **Details**:
  - Instead of streaming a hardcoded mock response, the route now calls `getAnthropic().messages.create(...)` with `MODEL_SONNET`, the prepared `systemPrompt`, and `userContent`, with `stream: true`.
  - Streams the text delta chunks to the client via `sseWrite` and handles errors using `friendlyApiError(err)`. This also aligns with the expectation of `server/routes/chat.errors.test.js` where the route is tested against rate-limit errors from the Anthropic SDK.

## 5. Secure Firebase Storage Rules (`storage.rules`)
- **Change**: Updated the write condition in `storage.rules` to ensure the practitioner's email is verified.
- **Details**:
  - Added `&& request.auth.token.email_verified == true` to the write rule for the practitioner email (`tsgoddessfireaf@gmail.com`) to prevent potential spoofing/vulnerabilities.

## 6. Hermetic Client Tests (`client/src/lib/storageRules.test.js`)
- **Change**: Modified the client storage rules integration test to skip gracefully if the local Firebase Emulators are not running.
- **Details**:
  - Added a top-level check that attempts to fetch the Auth emulator at `http://127.0.0.1:9099`.
  - Uses the result to conditionally define the suite: if the emulator is not running, the suite is skipped (`describe.skip`), allowing `npm run test` to run hermetically in environments without active emulators.

## 7. Dynamic Emulator Hostname (`client/src/lib/firebase.js`)
- **Change**: Replaced hardcoded `'localhost'` with `window.location.hostname` when connecting to the Firebase Emulators in development.
- **Details**:
  - Dynamically resolves the host using `window.location.hostname` so that local testing on mobile devices or other network hosts works seamlessly.
