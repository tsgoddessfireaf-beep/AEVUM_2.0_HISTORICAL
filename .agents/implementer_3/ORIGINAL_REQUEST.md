## 2026-06-29T07:49:41Z
You are a Worker Agent (Worker 3). Your mission is to finalize the Firebase migration and perform the final E2E verification.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Tasks to Execute:

1. **Update Root `package.json`**:
   - Refactor the `"install:all"` script in the root `package.json` to also install dependencies in the `functions/` and `bibliotheca_astrologica_horaria/functions/` directories:
     ```json
     "install:all": "npm install && cd server && npm install && cd ../client && npm install && cd ../functions && npm install && cd ../bibliotheca_astrologica_horaria/functions && npm install && cd ../../ephemeris-service && python -m venv .venv && node ../scripts/install-python-deps.js"
     ```

2. **Verify Installation and Build**:
   - Run `npm run install:all` to install all dependencies (including the functions directories).
   - Run the build: `npm run build`.

3. **Verify Tests**:
   - Run the server-side tests: `cd server && npm run test`.
   - Run the client-side tests: `cd client && npm run test`.
   Verify that all tests pass.

4. **Verify Emulators & E2E**:
   - Start the Firebase emulators in the background (or run them): `firebase emulators:start`.
   - Start the Python ephemeris sidecar in the background (using `npm run dev:ephemeris` or running it) so that the Cloud Function can perform the JPL calibration on startup.
   - Run the emulator setup to populate the Storage emulator: `npm run emulator:setup`.
   - Run the verification script: `node scripts/verify-emulators.js` (created by Challenger 1) to verify that the API, Firestore, and Storage work correctly.
   - Capture the output of the verification script and emulator startup logs.

Please write a detailed report `changes_3.md` and a `handoff.md` in your working directory (under `.agents/implementer_3/`) summarizing the changes made and the verification results (including command outputs).
When done, send a message to the orchestrator (conversation ID: 980d0fe0-5bf0-49de-a03d-3d83ee90bbd8).
