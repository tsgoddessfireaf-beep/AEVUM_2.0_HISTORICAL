## 2026-06-29T07:30:50Z

You are a Worker Agent. Your mission is to implement the Firebase migration for the Aevum application based on the requirements and the Explorer's findings.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Tasks to Execute:

1. **Backend Migration (Cloud Functions - R1)**:
   - Refactor `server/index.js` to export a Firebase HTTPS function:
     ```javascript
     import { onRequest } from 'firebase-functions/v2/https';
     import { setGlobalOptions } from 'firebase-functions/v2';
     
     setGlobalOptions({
       region: 'us-central1',
       timeoutSeconds: 540,
       memory: '1GiB',
       minInstances: 1,
     });
     
     // ... (Express app setup) ...
     
     export const api = onRequest(app);
     ```
   - Update `functions/package.json` to include all server dependencies with their latest versions from `server/package.json`.
   - Ensure that the code in `functions/` is in sync with `server/`. To avoid version drift, you can replace the duplicate files in `functions/` (like `functions/index.js`, `functions/lib`, `functions/routes`) with symbolic links pointing to the corresponding files in `server/`, or set up a pre-deploy script in `firebase.json` to copy them, or update them. (Symlinks are preferred if they work cleanly with the Firebase CLI).
   - Refactor `server/lib/firebaseAdmin.js` (and the one in `functions/lib/firebaseAdmin.js` if they are not symlinked) to use Application Default Credentials (ADC):
     ```javascript
     import { initializeApp, getApps } from 'firebase-admin/app';
     import { getFirestore } from 'firebase-admin/firestore';
     import { getAuth } from 'firebase-admin/auth';
     
     let adminDb = null;
     let adminAuth = null;
     
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
     
     export const ADMIN_ENABLED = Boolean(adminDb && adminAuth);
     ```

2. **Frontend Migration & Rewrites (Firebase Hosting - R2)**:
   - Configure `firebase.json` with hosting rewrites for the `app` target:
     - Route `/api/**` to the Cloud Function `api`.
     - Route `/ephemeris/**` to Cloud Run (serviceId: `aevum-ephemeris`, region: `us-central1`).
     - Route `/**` to the SPA `index.html`.
     Here is the expected rewrite structure in `firebase.json`:
     ```json
     "rewrites": [
       {
         "source": "/api/**",
         "function": "api",
         "region": "us-central1"
       },
       {
         "source": "/ephemeris/**",
         "run": {
           "serviceId": "aevum-ephemeris",
           "region": "us-central1"
         }
       },
       {
         "source": "**",
         "destination": "/index.html"
       }
     ]
     ```

3. **Python Ephemeris Service (Cloud Run - R3)**:
   - Ensure `ephemeris-service/Dockerfile` is valid and successfully builds the FastAPI service with `pyswisseph` and the bundled `.se1` data files.
   - Run a local docker build to verify: `docker build -t aevum-ephemeris:latest ./ephemeris-service`.

4. **Storage & Database Integration (R4)**:
   - Update `uploadSlideAudio` in `client/src/lib/firebase.js` to upload audio blobs to the path:
     `users/{userId}/readings/{readingId}/slide-{slideIndex}.{ext}`
     Make sure to get the current authenticated user's ID.
   - Update `storage.rules` to secure this path:
     - Public read access (`allow read: if true;`) to allow clients to play shared readings.
     - Write access restricted to authenticated users matching the `userId` in the path, AND whose email is `tsgoddessfireaf@gmail.com`:
       ```javascript
       match /users/{userId}/readings/{readingId}/{file} {
         allow read: if true;
         allow write: if request.auth != null
                      && request.auth.uid == userId
                      && request.auth.token.email == 'tsgoddessfireaf@gmail.com';
       }
       ```
   - Move the astrology library text files from `library/shelves/` to the `library/` folder in Firebase Storage:
     - Update `storage.rules` to allow public read of the `library/` folder:
       ```javascript
       match /library/{file} {
         allow read: if true;
         allow write: if false;
       }
       ```
     - Refactor `client/src/components/dashboard/LibraryContext.jsx` to fetch these text files directly from Firebase Storage via `getDownloadURL` and `fetch`, rather than through the Express static API.
     - Remove the static route serving `/api/library` in `server/index.js` (and `functions/index.js` if they are not symlinked).

5. **Verification**:
   - Run the build: `npm run install:all && npm run build`.
   - Run `firebase emulators:start` to verify the local environment spins up successfully.
   - Verify that the React client communicates with the emulated Cloud Function API.
   - Run the unit/integration tests to ensure no regressions.
