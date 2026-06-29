# Changes Made — Firebase Migration

## 1. Backend Migration (Cloud Functions - R1)
- **`server/index.js`**: Refactored to import `onRequest` and `setGlobalOptions` from `firebase-functions/v2`. Configured global options (region: `us-central1`, timeout: 540s, memory: `1GiB`, minInstances: 1) and exported `api = onRequest(app)`.
- **`server/package.json`**: Added `"firebase-functions": "^6.0.0"` to dependencies to allow clean import in server files and tests.
- **`functions/package.json`**: Aligned all dependencies with the exact versions from `server/package.json`.
- **`server/lib/firebaseAdmin.js`**: Refactored initialization to use Application Default Credentials (ADC) via `initializeApp()` with no arguments.
- **`scripts/sync-functions.js`**: Created a synchronization script that deletes duplicate files in `functions/` and links/copies them from `server/` to avoid version drift.
- **`firebase.json`**: Configured the `predeploy` hook under `functions` to automatically run `scripts/sync-functions.js` before deploying or starting emulators.

## 2. Frontend Migration & Rewrites (Firebase Hosting - R2)
- **`firebase.json`**: Updated the `app` target hosting configuration with the required rewrites:
  - `/api/**` -> Cloud Function `api` (us-central1)
  - `/ephemeris/**` -> Cloud Run service `aevum-ephemeris` (us-central1)
  - `/**` -> SPA `index.html`
- **`firebase.json`**: Added the `emulators` block to configure local emulators for Auth (9099), Functions (5001), Firestore (8080), Hosting (5000), and Storage (9199).

## 3. Python Ephemeris Service (Cloud Run - R3)
- Checked `ephemeris-service/Dockerfile` and verified it is valid. It copies all files (including the `.se1` ephemeris files located in `ephemeris-service/ephe/`) and sets the `SE_EPHE_PATH=/app/ephe` environment variable.

## 4. Storage & Database Integration (R4)
- **`client/src/lib/firebase.js`**:
  - Updated `uploadSlideAudio` to use the path `users/{userId}/readings/{readingId}/slide-{slideIndex}.{ext}`, dynamically retrieving the authenticated user's ID using `getCurrentUserId()`.
  - Added `fetchLibraryText(filename)` helper to fetch astrology library text files from the `library/` folder in Firebase Storage.
  - Added support for connecting to local Firebase emulators (Auth, Firestore, Storage) when running in development mode or on `localhost`.
- **`storage.rules`**:
  - Secured the path `users/{userId}/readings/{readingId}/{file}` with public read and write restricted to the authenticated user matching `userId` whose email is `tsgoddessfireaf@gmail.com`.
  - Added public read access for the `library/{file}` path (write access disabled).
- **`client/src/components/dashboard/LibraryContext.jsx`**:
  - Refactored to fetch text files using `fetchLibraryText` from Firebase Storage rather than the local `/api/library` Express static API.
- **`server/index.js`**: Removed the static route serving `/api/library`.
- **`scripts/upload-library.js`**: Created a script to upload the astrology library text files from `library/shelves/` to the `library/` folder in the Firebase Storage emulator.
- **`package.json`**: Added an `emulator:setup` script to run the library upload script.

## 5. Tests & Coverage
- **`client/src/lib/firebase.test.js`**: Added comprehensive unit tests for the updated `uploadSlideAudio` (including user authentication checks) and `fetchLibraryText` functions, mocking `firebase/storage` appropriately.
