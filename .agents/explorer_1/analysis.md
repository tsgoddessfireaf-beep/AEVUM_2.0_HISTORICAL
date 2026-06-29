# Aevum Firebase Migration Audit Report

**Author**: Explorer Agent
**Date**: 2026-06-29
**Milestone**: Firebase Migration Preparation

---

## Executive Summary
This report presents a comprehensive audit of the Aevum application codebase to prepare for its migration to Firebase. We analyzed the existing Firebase configurations, the Express server, the React client, the Python ephemeris service, and the astrology library. 

Key recommendations include:
1. **Consolidating the Backend**: Eliminate the duplicate code in the `functions/` directory by configuring `firebase.json` to deploy directly from the `server/` directory.
2. **Path Correction for Audio Uploads**: Update the client-side Firebase Storage upload path to organize audio files under `users/{userId}/readings/{readingId}/` and secure them via updated storage rules.
3. **Decoupling the Astrology Library**: Move the large astrology library text files (up to 1.3MB) from local static hosting to Firebase Storage, allowing the client to fetch them directly and reducing Cloud Function overhead.
4. **Deploying Ephemeris to Cloud Run**: The Python `ephemeris-service` is fully containerized and ready for Cloud Run, ensuring high-precision astronomical calculations are maintained.

---

## 1. Existing Firebase Configuration
We analyzed the following files in the root directory:
* `firebase.json`
* `firestore.rules`
* `storage.rules`
* `.firebaserc`

### Findings & Analysis

#### A. `firebase.json`
* **Hosting**: Configures two targets:
  1. `landing`: Serves the `site/` folder.
  2. `app`: Serves the `client/dist/` folder. It rewrites all `/api/**` traffic to the `api` Cloud Function in `us-central1` and rewrites all other traffic to `/index.html` (supporting SPA routing).
* **Functions**: Configures two codebases:
  1. `default`: Pointing to the `functions/` directory, using `nodejs22`.
  2. `bibliotheca_astrologica_horaria`: Pointing to `bibliotheca_astrologica_horaria/functions/`, using `nodejs22`.
* **Gaps**: The `functions/` directory contains a duplicate copy of the server code, leading to version drift and build complexity.

#### B. `firestore.rules`
* **`/users/{userId}`**: Allows read/write only if the authenticated user's UID matches the document ID (`request.auth.uid == userId`).
* **`/readings/{readingId}`**:
  * Public readings (`resource.data.isPublic == true`) are readable by anyone.
  * Owners can read, create, and update their own readings (`userId` field must match `request.auth.uid`).
  * Deletions are completely blocked from the client.
* **Gaps**: If the astrology library is moved to Firestore, there are no rules allowing public read access to a `library` collection. However, due to Firestore's 1MB document limit, we recommend Firebase Storage instead (see Section 6).

#### C. `storage.rules`
* **`/readings/{readingId}/{file}`**:
  * Allows public read access (`allow read: if true`).
  * Restricts write access to authenticated users with the specific practitioner email: `tsgoddessfireaf@gmail.com`.
* **Gaps**: This path does not organize files by user. The user requested moving these to `users/{userId}/readings/{readingId}/{file}`. The rules must be updated to match.

#### D. `.firebaserc`
* Sets the default project to `flutter-ai-playground-f880c`.
* Maps hosting targets: `landing` (`flutter-ai-playground-f880c`) and `app` (`aevum-app`).

---

## 2. The `functions` Directory
The `functions/` directory currently contains a complete, duplicate copy of the Express server:
* **Entrypoint (`functions/index.js`)**: Wraps the Express app using `onRequest` from `firebase-functions/v2/https`.
* **Subdirectories**: Contains `lib/` (with `firebaseAdmin.js`, `historicalTexts.js`) and `routes/` (with `chat.js`, `ephemeris.js`, `stripe.js`, `booking.js`).
* **Package File (`functions/package.json`)**: List of dependencies. However, the versions are severely outdated compared to `server/package.json` (e.g., `@anthropic-ai/sdk` is `^0.39.0` in functions vs `^0.102.0` in server).
* **Environment (`functions/.env`)**: Sets `EPHEMERIS_URL=https://aevum-ephemeris-neq6yx5zbq-uc.a.run.app/calculate`.

**Assessment**: The `functions/` directory is redundant and suffers from version drift. We should eliminate this duplication.

---

## 3. Express Server Refactoring
We analyzed `server/index.js` and `server/package.json` to determine how to adapt them for Firebase.

### Recommended Refactoring Steps

#### A. Consolidate Codebase in `firebase.json`
Instead of maintaining a separate `functions/` directory, configure Firebase to deploy directly from the `server/` directory:
```json
"functions": [
  {
    "source": "server",
    "codebase": "default",
    "runtime": "nodejs22"
  }
]
```

#### B. Update `server/package.json`
Add `firebase-functions` to the dependencies (keeping the latest versions from `server/package.json`):
```json
"dependencies": {
  ...
  "firebase-admin": "^13.10.0",
  "firebase-functions": "^6.0.0",
  ...
}
```

#### C. Export the HTTPS Cloud Function in `server/index.js`
Modify `server/index.js` to export the Firebase v2 HTTPS trigger:
```javascript
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '1GiB',
  minInstances: 1, // Keeps one instance warm to avoid cold-start calibration delay
});

// ... (Express app setup, middleware, and routes) ...

// Export the Cloud Function
export const api = onRequest(app);
```
Since `server/index.js` already guards local execution using `isMain` (checking if run via `node index.js`), this export will not interfere with local development.

#### D. Use Application Default Credentials (ADC)
Refactor `server/lib/firebaseAdmin.js` to initialize without requiring the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable. This allows the SDK to automatically use local credentials during development and the default service account in production:
```javascript
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminDb   = null;
let adminAuth = null;

try {
  if (!getApps().length) {
    initializeApp(); // Initializes with Application Default Credentials (ADC)
  }
  adminDb   = getFirestore();
  adminAuth = getAuth();
  console.info('[firebase-admin] initialized with application default credentials');
} catch (e) {
  console.warn('[firebase-admin] init failed:', e.message);
}

export const ADMIN_ENABLED = Boolean(adminDb && adminAuth);
```

---

## 4. React Client & Firebase Storage Integration
We analyzed `client/src/components/SlideDeck.jsx` and `client/src/lib/firebase.js`.

### Findings
* `SlideDeck.jsx` records audio blobs and invokes the `onSaveAudio` callback:
  ```javascript
  const url = await onSaveAudio(idx, takeBlobRef.current);
  ```
* In `client/src/components/ReadingPackagePanel.jsx`, `handleSaveAudio` calls `uploadSlideAudio` from `firebase.js`:
  ```javascript
  const url = await uploadSlideAudio(readingId, slideIndex, blob);
  ```
* In `client/src/lib/firebase.js`, `uploadSlideAudio` currently uploads to:
  ```javascript
  const path = `readings/${readingId}/slide-${slideIndex}.${ext}`;
  ```

### Required Changes

1. **Update `uploadSlideAudio` in `client/src/lib/firebase.js`**:
   Retrieve the current user's ID and structure the path under the user's directory:
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

2. **Update `storage.rules`**:
   Modify the rules to align with the new path and enforce ownership:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /users/{userId}/readings/{readingId}/{file} {
         allow read: if true; // Public read is required for shared client playback
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

---

## 5. Python Ephemeris Service Containerization
We audited the `ephemeris-service/` directory.

### Findings & Packaging
* **Dockerfile**: A lightweight, multi-stage-ready `Dockerfile` exists:
  * Uses `python:3.11-slim`.
  * Installs dependencies from `requirements.txt`.
  * Sets the environment variable `ENV SE_EPHE_PATH=/app/ephe`.
  * Exposes port `8080` and starts `uvicorn main:app` on host `0.0.0.0`.
* **Libraries (`requirements.txt`)**:
  * `fastapi==0.115.6`
  * `uvicorn[standard]==0.34.0`
  * `pydantic==2.10.4`
  * `pyswisseph==2.10.3.2` (pyswisseph binds directly to the C Swiss Ephemeris library)
  * `geopy==2.4.1`
  * `tzdata==2024.2`
* **Swiss Ephemeris Data**:
  * The high-precision ephemeris files (`semo_18.se1` and `sepl_18.se1`) are committed under `ephemeris-service/ephe/`.
  * The Dockerfile copies the entire directory (`COPY . .`), which packages the `ephe/` folder directly into the container at `/app/ephe`.
  * The environment variable `SE_EPHE_PATH=/app/ephe` ensures `pyswisseph` reads the local high-precision files on startup, preventing fallback to low-precision Moshier calculations.

**Conclusion**: The Python service is fully prepared for Cloud Run deployment. No changes are required.

---

## 6. Astrology Library Storage
We investigated how the astrology library is read and served.

### Findings
* **Current State**: 
  * The server serves the library text files statically from the local filesystem:
    ```javascript
    app.use('/api/library', express.static(join(__dirname, '../library/shelves')));
    ```
  * The React client (`client/src/components/dashboard/LibraryContext.jsx`) fetches the text files statically:
    ```javascript
    const fetchPromises = ASTROLOGERS.map(a => fetch(`/api/library/${a.file}`).then(res => res.text()));
    ```
  * **The files are not read from Firestore.**
* **The Problem**: 
  * In a Cloud Function environment, files outside the function's source directory (like `../library/shelves`) are not uploaded. Serving them statically via `express.static` will fail with a `404 Not Found` error.
  * Some files are large (e.g., `lilly-modern.txt` is 1.3MB, and `naibod-cards.jsonl` is 2.8MB). Firestore has a **1MB document size limit**, making it impossible to store whole texts in single Firestore documents.

### Recommended Solution: Firebase Storage
Rather than using Firestore or bundling 15MB of text files in the Cloud Function, we recommend hosting the library files in a public folder in **Firebase Storage**:

1. **Upload the files**: Upload the contents of `library/shelves/` to a folder named `library/` in the Firebase Storage bucket.
2. **Update the Client (`LibraryContext.jsx`)**:
   Instead of calling the Express API `/api/library/filename`, the client can fetch the files directly from Firebase Storage.
   ```javascript
   import { getStorage, ref, getDownloadURL } from 'firebase/storage';
   
   // In the useEffect hook:
   const storage = getStorage();
   const fetchPromises = ASTROLOGERS.map(async (a) => {
     const fileRef = ref(storage, `library/${a.file}`);
     const url = await getDownloadURL(fileRef);
     const res = await fetch(url);
     return res.text();
   });
   const results = await Promise.all(fetchPromises);
   ```
3. **Storage Rules**: Add a rule to allow public read access to the `library/` folder:
   ```javascript
   match /library/{file} {
     allow read: if true;
     allow write: if false; // Read-only for clients
   }
   ```
   
This approach completely decouples the static library from the Express server, saves Cloud Function memory/bandwidth, and avoids Firestore document size limitations.
