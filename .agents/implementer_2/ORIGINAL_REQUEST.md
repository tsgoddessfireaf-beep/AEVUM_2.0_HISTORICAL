## 2026-06-29T07:38:44Z
You are a Worker Agent (Worker 2). Your mission is to fix the critical issues identified in the Firebase migration review.

Please read the review report:
`C:\Users\tsgod\.gemini\antigravity\worktrees\AEVUM-2.0\fix-broken-build-process\.agents\reviewer_2\review_2.md`

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Tasks to Execute:

1. **Fix Firebase Admin Initialization (`server/lib/firebaseAdmin.js`)**:
   Implement a hybrid approach that preserves compatibility with the Render production environment (using `FIREBASE_SERVICE_ACCOUNT_JSON`) and supports local emulators/GCP environment (using Application Default Credentials):
   - Check if `process.env.FIREBASE_SERVICE_ACCOUNT_JSON` is set.
   - If set, parse the JSON and initialize using `cert(serviceAccount)`.
   - If NOT set, initialize using `initializeApp()` (with no arguments, which uses ADC).
   - Guard against multiple initializations using `getApps().length`.
   - Ensure `ADMIN_ENABLED` is set to `true` if initialization succeeds, and `false` if it fails.
   - Log appropriate messages (e.g., info when initialized with service account or ADC, warning on failure).

2. **Align Unit Tests (`server/lib/firebaseAdmin.test.js`)**:
   Ensure the unit tests in `server/lib/firebaseAdmin.test.js` pass successfully. Since we are using a hybrid approach:
   - When `FIREBASE_SERVICE_ACCOUNT_JSON` is missing, the code will now fall back to `initializeApp()` (ADC). In a test environment where ADC is not configured (or is mocked), it might throw or succeed. The tests should be updated to mock `initializeApp` and verify it behaves correctly under both cases.
   - Verify that all tests in `server/lib/firebaseAdmin.test.js` pass: `cd server && npm run test`.

3. **Fix Sync Script (`scripts/sync-functions.js`)**:
   - Fix the bug where the script crashes on broken symlinks. Replace `fs.existsSync(dest)` with `fs.lstatSync(dest)` inside a `try/catch` block to detect if the destination file or symlink exists (even if it is broken) and remove it before creating a new symlink/copy.
   - Add a clear console warning when the script falls back to copying a file instead of symlinking on Windows, advising the developer to rerun the script if they modify the source file.

4. **Verify**:
   - Run `node scripts/sync-functions.js` to ensure it runs without crashing (test with both existing and non-existing symlinks).
   - Run the tests in `server/` to make sure they pass: `cd server && npm run test`.
   - Run the build: `npm run install:all && npm run build`.

Please write a detailed report `changes.md` and a `handoff.md` in your working directory (under `.agents/implementer_2/`) summarizing the changes made and the verification results.
When done, send a message to the orchestrator (conversation ID: 980d0fe0-5bf0-49de-a03d-3d83ee90bbd8).

## 2026-06-29T07:39:33Z
**Context**: Additional critical fixes for Firebase migration (Auditor and Reviewer 1 findings).
**Content**: The Forensic Auditor and Reviewer 1 have completed their reviews and identified several critical issues that must be addressed immediately:

1. **Facade Implementation in /api/chat/analyze (INTEGRITY VIOLATION)**:
   - In `server/routes/chat.js` (lines 899–935), the `/api/chat/analyze` route is currently a facade that streams a hardcoded mock response and bypasses the Anthropic API.
   - You MUST restore the genuine implementation that calls `getAnthropic().messages.create(...)` using `MODEL_SONNET` and the prepared `systemPrompt` and `userContent`, and streams the text delta chunks to the client via `sseWrite` (similar to how `/house-signification` does it).
   - This will also fix the failing error test in `server/routes/chat.errors.test.js` which expects the route to handle rate-limit errors from the Anthropic SDK.

2. **Security Vulnerability in Storage Rules**:
   - In `storage.rules`, the write check for the practitioner's email `tsgoddessfireaf@gmail.com` must also verify that the email is verified:
     `request.auth.token.email_verified == true`.
   - Update the rule to:
     ```javascript
     allow write: if request.auth != null
                  && request.auth.uid == userId
                  && request.auth.token.email == 'tsgoddessfireaf@gmail.com'
                  && request.auth.token.email_verified == true;
     ```

3. **Non-Hermetic Client Tests**:
   - The test file `client/src/lib/storageRules.test.js` connects to the real local emulators, causing `npm run test` in `client/` to fail if the emulators are not running.
   - Move `storageRules.test.js` to an integration-specific test directory (e.g., `client/src/integration/`) and exclude it from the default unit test suite, or modify it to skip tests if the emulators are not reachable, so that `npm run test` can run hermetically without active emulators.

4. **Emulator Connection Failures on Non-Local Hostnames**:
   - In `client/src/lib/firebase.js`, dynamically determine the emulator host using `window.location.hostname` instead of hardcoding `'localhost'` (e.g. for testing on mobile devices/tablets on the same network).

**Action**: Please implement these fixes along with the previous tasks. Ensure all unit and integration tests pass successfully in both `server/` and `client/`. Report back when all fixes are complete.
