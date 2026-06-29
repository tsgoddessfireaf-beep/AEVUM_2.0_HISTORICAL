# Handoff Report: Aevum Firebase Migration Plan

**Author**: Explorer Agent
**Date**: 2026-06-29
**Milestone**: Firebase Migration Preparation
**Type**: Soft Handoff (Transferred for implementation)

---

## 1. Observation
We observed the following files and configurations in the repository:
1. **Firebase Configuration (`firebase.json`)**:
   * Line 8-44: Configures hosting for `landing` (`site`) and `app` (`client/dist`), with `/api/**` rewritten to the `api` Cloud Function.
   * Line 45-56: Configures two Node.js 22 functions. The `default` function source is `"functions"`.
2. **Firebase Rules**:
   * `firestore.rules`: Secures `/users/{userId}` and `/readings/{readingId}` (blocking deletes).
   * `storage.rules`: Configures `/readings/{readingId}/{file}` allowing public reads, but limiting writes to the practitioner email `tsgoddessfireaf@gmail.com`.
3. **Redundant `functions` Directory**:
   * Under `functions/`, we found a complete duplicate of the `server/` directory's `lib/` and `routes/` code, but with outdated packages (e.g., `@anthropic-ai/sdk` at `^0.39.0` in `functions/package.json` vs `^0.102.0` in `server/package.json`).
4. **Express Server (`server/index.js` and `server/lib/firebaseAdmin.js`)**:
   * `server/index.js` currently serves the API and has an `isMain` block to run an Express HTTP listener locally.
   * `server/lib/firebaseAdmin.js` (lines 11-25) initializes `firebase-admin` using a service account parsed from `process.env.FIREBASE_SERVICE_ACCOUNT_JSON`.
5. **React Client Storage Upload (`client/src/lib/firebase.js`)**:
   * Line 375: `const path = \`readings/\${readingId}/slide-\${slideIndex}.\${ext}\`;`
6. **Python Ephemeris Service (`ephemeris-service/`)**:
   * Contains a working `Dockerfile` exposing port `8080`, setting `ENV SE_EPHE_PATH=/app/ephe`, and launching `uvicorn main:app`.
   * Has `requirements.txt` listing `pyswisseph==2.10.3.2`.
   * Has high-precision ephemeris data files (`semo_18.se1` and `sepl_18.se1`) committed in `ephe/`.
7. **Astrology Library (`server/index.js` & `client/src/components/dashboard/LibraryContext.jsx`)**:
   * `server/index.js` (line 75): `app.use('/api/library', express.static(join(__dirname, '../library/shelves')));`
   * `client/.../LibraryContext.jsx` (line 25): `const fetchPromises = ASTROLOGERS.map(a => fetch(\`/api/library/\${a.file}\`).then(res => res.text()));`
   * `library/shelves/` contains files such as `lilly-modern.txt` (1.3MB) and `naibod-cards.jsonl` (2.8MB).

---

## 2. Logic Chain
1. **Consolidation**: Since the `functions/` directory contains duplicate, outdated server code, configuring `firebase.json` to deploy directly from `server/` eliminates this redundancy while preserving local development capabilities via the `isMain` guard in `server/index.js`.
2. **Local Credentials**: Because the application will run inside Google Cloud/Firebase in production and via local emulators/CLI in development, initializing `firebase-admin` via `initializeApp()` (with no arguments) enables Application Default Credentials (ADC), removing the need for a manual `FIREBASE_SERVICE_ACCOUNT_JSON` variable.
3. **Audio Storage Path**: The user requested organizing audio files under `users/{userId}/readings/{readingId}`. Since `client/src/lib/firebase.js` can retrieve the authenticated user's ID via `getCurrentUserId()`, we can construct the new path there. The `storage.rules` must be updated to match the new path layout and restrict writes to the owner's UID and practitioner's email.
4. **Ephemeris Service**: The existing `Dockerfile` and `requirements.txt` correctly package `pyswisseph` and the `.se1` data files while setting the `SE_EPHE_PATH` environment variable. This setup is ready for Cloud Run without modifications.
5. **Astrology Library**: Since the `library/` folder is located outside the server directory, it will not be bundled in the Cloud Function deployment, causing static serving to fail. Firestore is unsuitable due to its 1MB document size limit (e.g. `lilly-modern.txt` is 1.3MB). Therefore, moving the library text files to a public folder in Firebase Storage and having the client fetch them directly is the most robust and cost-effective solution.

---

## 3. Caveats
* **Firebase Storage Bucket CORS**: The client will fetch the astrology library files directly from Firebase Storage via HTTP `fetch`. This requires configuring CORS on the Firebase Storage bucket (via a `cors.json` file uploaded using the `gsutil` or `gcloud` CLI) to allow GET requests from the application's hosting domains (e.g. localhost, `aevum-app.web.app`).
* **Firebase Functions Source**: Changing the functions source to `server` assumes the deployer will run `firebase deploy` from the root directory.

---

## 4. Conclusion
We recommend proceeding with a 6-step migration plan:
1. Update `firebase.json` to point the `default` function source to `"server"`.
2. Refactor `server/index.js` to export the Cloud Function, and update `server/package.json` to include `firebase-functions`.
3. Refactor `server/lib/firebaseAdmin.js` to use Application Default Credentials.
4. Update the audio upload path in `client/src/lib/firebase.js` and matching rules in `storage.rules`.
5. Upload the astrology library files to Firebase Storage and update `client/src/components/dashboard/LibraryContext.jsx` to fetch them directly.
6. Build and deploy the Python `ephemeris-service` to Cloud Run using the existing `Dockerfile`.

---

## 5. Remaining Work (Implementation Steps for the Worker)

### Task 1: Consolidate Express Server & Cloud Function
* Modify `firebase.json`:
  ```json
  "functions": [
    {
      "source": "server",
      "codebase": "default",
      "runtime": "nodejs22"
    }
  ]
  ```
* Add `firebase-functions` to `server/package.json` dependencies:
  ```json
  "firebase-functions": "^6.0.0"
  ```
* Refactor `server/index.js` to export the HTTPS trigger:
  ```javascript
  import { onRequest } from 'firebase-functions/v2/https';
  import { setGlobalOptions } from 'firebase-functions/v2';

  setGlobalOptions({
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GiB',
    minInstances: 1,
  });

  // ... (Express app configuration) ...

  export const api = onRequest(app);
  export default app;
  ```
* Delete the `functions/` directory.

### Task 2: Refactor `firebase-admin` Initialization
* Refactor `server/lib/firebaseAdmin.js` to use `initializeApp()` without arguments (ADC):
  ```javascript
  import { initializeApp, getApps } from 'firebase-admin/app';
  import { getFirestore } from 'firebase-admin/firestore';
  import { getAuth } from 'firebase-admin/auth';

  let adminDb   = null;
  let adminAuth = null;

  try {
    if (!getApps().length) {
      initializeApp();
    }
    adminDb   = getFirestore();
    adminAuth = getAuth();
    console.info('[firebase-admin] initialized with application default credentials');
  } catch (e) {
    console.warn('[firebase-admin] init failed:', e.message);
  }

  export const ADMIN_ENABLED = Boolean(adminDb && adminAuth);
  ```

### Task 3: Update Audio Upload Path & Rules
* Refactor `uploadSlideAudio` in `client/src/lib/firebase.js`:
  ```javascript
  export async function uploadSlideAudio(readingId, slideIndex, blob) {
    if (!storage || !readingId || !blob) return null;
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('[firebase] uploadSlideAudio failed: user not authenticated');
      return null;
    }
    const ext = blob.type.includes('mp4') ? 'm4a'
              : blob.type.includes('ogg') ? 'ogg'
              : 'webm';
    try {
      const path = `users/${userId}/readings/${readingId}/slide-${slideIndex}.${ext}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, blob, { contentType: blob.type || 'audio/webm' });
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.warn('[firebase] uploadSlideAudio failed:', err.message);
      return null;
    }
  }
  ```
* Update `storage.rules`:
  ```javascript
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /users/{userId}/readings/{readingId}/{file} {
        allow read: if true;
        allow write: if request.auth != null
                     && request.auth.uid == userId
                     && request.auth.token.email == 'tsgoddessfireaf@gmail.com';
      }
      match /{allPaths=**} {
        allow read, write: if false;
      }
    }
  }
  ```

### Task 4: Move Astrology Library to Firebase Storage
* Upload the text files inside `library/shelves/` to the `library/` folder in the Firebase Storage bucket.
* Update `storage.rules` to allow public read of the `library` folder:
  ```javascript
  match /library/{file} {
    allow read: if true;
    allow write: if false;
  }
  ```
* Refactor `client/src/components/dashboard/LibraryContext.jsx` to fetch directly from Storage:
  ```javascript
  import { getStorage, ref, getDownloadURL } from 'firebase/storage';
  
  // Inside useEffect:
  async function fetchLibrary() {
    setLoading(true);
    try {
      const storage = getStorage();
      const fetchPromises = ASTROLOGERS.map(async (a) => {
        const fileRef = ref(storage, `library/${a.file}`);
        const url = await getDownloadURL(fileRef);
        const res = await fetch(url);
        return res.text();
      });
      const results = await Promise.all(fetchPromises);
      
      const newTexts = {};
      ASTROLOGERS.forEach((a, i) => {
        newTexts[a.id] = results[i];
      });
      setTexts(newTexts);
    } catch (err) {
      console.error('Error fetching library texts:', err);
    } finally {
      setLoading(false);
    }
  }
  ```
* Remove the static route in `server/index.js`:
  ```javascript
  // Remove this line:
  // app.use('/api/library', express.static(join(__dirname, '../library/shelves')));
  ```

### Task 5: Deploy Python Ephemeris Service
* Build the Docker image from the `ephemeris-service` directory:
  ```bash
  docker build -t gcr.io/[PROJECT_ID]/aevum-ephemeris:latest ./ephemeris-service
  ```
* Push the image to Google Container Registry or Artifact Registry.
* Deploy to Cloud Run with CPU always allocated (or standard allocation) and scale to at least 1 instance (to match the warmup expectation):
  ```bash
  gcloud run deploy aevum-ephemeris --image gcr.io/[PROJECT_ID]/aevum-ephemeris:latest --platform managed --allow-unauthenticated
  ```

---

## 6. Verification Method
1. **Server build & start**:
   Run `npm run install:all` and then test starting the server locally using `node server/index.js` to ensure the `isMain` path works and the Cloud Function exports are clean.
2. **Local Firebase Emulator**:
   Run `firebase emulators:start` to verify that hosting, firestore, storage, and functions emulate correctly.
3. **Unit Tests**:
   Run `npm run test` in the `server/` directory to ensure `firebaseAdmin.test.js` passes or is updated to reflect the new ADC initialization.
4. **Audio upload check**:
   In practitioner mode, record a slide and verify in the Firebase Console that the file is uploaded to `users/[userId]/readings/[readingId]/slide-[index].[ext]`.
5. **Library fetch check**:
   Open the client dashboard, click on the Learning tab, select a slide, and verify that the historical quotes are successfully fetched from Firebase Storage and rendered.
