# Handoff Report — Firebase Migration Review

This handoff report summarizes the findings of Reviewer 1 regarding the Firebase migration in the Aevum application.

---

## 1. Observation

- **Backend Initialization**: In `server/lib/firebaseAdmin.js` (lines 11-20), the Firebase Admin SDK is initialized using:
  ```javascript
  try {
    if (!getApps().length) {
      initializeApp(); // Application Default Credentials (ADC)
    }
    adminDb = getFirestore();
    adminAuth = getAuth();
    console.info('[firebase-admin] initialized with application default credentials');
  } catch (e) {
    console.warn('[firebase-admin] init failed:', e.message);
  }
  ```
  The previous check for `process.env.FIREBASE_SERVICE_ACCOUNT_JSON` has been removed.

- **Outdated Backend Tests**: In `server/lib/firebaseAdmin.test.js` (lines 55-75), the tests assert:
  ```javascript
  it('logs info when FIREBASE_SERVICE_ACCOUNT_JSON is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('disabled — set FIREBASE_SERVICE_ACCOUNT_JSON'));
    consoleSpy.mockRestore();
  });
  ```
  And in `functions/lib/firebaseAdmin.test.js` (lines 55-75), the exact same assertions are present.

- **Non-Hermetic Client Tests**: In `client/src/lib/storageRules.test.js` (lines 37-38), the tests connect to the real local emulators:
  ```javascript
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectStorageEmulator(storage, "localhost", 9199);
  ```
  There is no fallback or conditional check for when the emulators are not running.

- **Storage Security Rules**: In `storage.rules` (lines 14-19), the write access check is configured as:
  ```javascript
  match /users/{userId}/readings/{readingId}/{file} {
    allow read: if true;
    allow write: if request.auth != null
                 && request.auth.uid == userId
                 && request.auth.token.email == 'tsgoddessfireaf@gmail.com';
  }
  ```
  There is no check for `request.auth.token.email_verified == true`.

- **Command Execution Timeouts**: Running `node scripts/sync-functions.js` via `run_command` timed out waiting for user approval:
  ```
  Encountered error in step execution: Permission prompt for action 'command' on target 'node scripts/sync-functions.js' timed out waiting for user response.
  ```

---

## 2. Logic Chain

1. **Test Failures due to ADC Refactoring**:
   - In `server/lib/firebaseAdmin.js`, initialization is done via `initializeApp()` without requiring `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - The mock configuration in `server/lib/firebaseAdmin.test.js` does not throw an error during `initializeApp()`.
   - Therefore, the test `logs info when FIREBASE_SERVICE_ACCOUNT_JSON is missing` will execute `initializeApp()`, succeed, set `ADMIN_ENABLED` to `true`, and log `[firebase-admin] initialized with application default credentials`.
   - The test's assertion `expect(ADMIN_ENABLED).toBe(false)` and the check for `disabled — set FIREBASE_SERVICE_ACCOUNT_JSON` will fail.
   - **Conclusion**: The server-side test suite is currently broken.

2. **Test Failures due to Emulator Dependency**:
   - `client/src/lib/storageRules.test.js` connects directly to the local Firebase emulators.
   - If `npm run test` is executed in the `client/` directory without starting the emulators first, the connection will fail and the test suite will crash.
   - **Conclusion**: The client-side test suite is non-hermetic and will fail in environments without running emulators (such as standard CI pipelines).

3. **Email Bypass Vulnerability**:
   - The storage rules check `request.auth.token.email == 'tsgoddessfireaf@gmail.com'`.
   - If the Firebase project has the Email/Password provider enabled, any user can register an account with the email `tsgoddessfireaf@gmail.com`.
   - If the rules do not enforce `request.auth.token.email_verified == true`, the attacker's unverified token will satisfy the email check.
   - **Conclusion**: An attacker can gain unauthorized write access to the storage bucket.

---

## 3. Caveats

- **No Runtime Build/Test Execution**: Due to user permission timeouts on the `run_command` tool, the build and test suites could not be executed locally. The findings are based entirely on static code analysis, which is highly confident but has not been executed.
- **Port Availability**: It is assumed that the Firebase emulators are configured to run on standard ports (Auth: 9099, Storage: 9199, Firestore: 8080). If these ports are occupied, the emulators will fail to start.

---

## 4. Conclusion

The Firebase migration is structurally complete and correct in its core logic, but it is **not ready for deployment** because:
1. The server-side unit tests in `server/lib/firebaseAdmin.test.js` are broken due to the ADC refactoring.
2. The client-side unit tests in `client/src/lib/storageRules.test.js` are non-hermetic and require running emulators.
3. The storage security rules contain a potential email spoofing vulnerability.

A request for changes has been issued to resolve these three issues.

---

## 5. Verification Method

To independently verify these findings:
1. **Run the Server Tests**:
   ```bash
   cd server && npm run test
   ```
   Observe that `firebaseAdmin.test.js` fails on the `logs info when FIREBASE_SERVICE_ACCOUNT_JSON is missing` test.

2. **Run the Client Tests without Emulators**:
   ```bash
   cd client && npm run test
   ```
   Observe that `storageRules.test.js` fails because it cannot connect to the emulators.

3. **Inspect the Files**:
   - Check `server/lib/firebaseAdmin.test.js` lines 55-75 against the implementation in `server/lib/firebaseAdmin.js`.
   - Check `storage.rules` lines 14-19 for the email verification check.
