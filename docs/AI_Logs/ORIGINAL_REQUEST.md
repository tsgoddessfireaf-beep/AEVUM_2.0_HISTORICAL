# Original User Request

## 2026-06-29T07:27:25Z

# Teamwork Project Prompt

Migrate the Aevum application (Express backend, Python ephemeris service, and React client) to Firebase Cloud Infrastructure on the `flutter-ai-playground-f880c` project.

Working directory: `C:\Users\tsgod\.gemini\antigravity\worktrees\AEVUM-2.0\fix-broken-build-process`
Integrity mode: development

## Requirements

### R1. Backend Migration (Cloud Functions)
Migrate the Express server to Firebase Cloud Functions.
- Refactor `server/index.js` to export a Firebase HTTPS function (`functions.https.onRequest(app)`).
- Move server dependencies into a `functions/package.json`.
- Authenticate `firebase-admin` using `application-default` (local credentials) rather than a service account key, since key creation is disabled by organizational policy.

### R2. Frontend Migration (Firebase Hosting)
Deploy the React + Vite client to Firebase Hosting.
- Set up `firebase.json` with hosting rewrites to route `/api/**` to the Cloud Function, `/ephemeris/**` to Cloud Run, and `/**` to the SPA `index.html`.

### R3. Python Ephemeris Service (Cloud Run)
Containerize the Python FastAPI service for deployment to Google Cloud Run.
- Create a `Dockerfile` for the `ephemeris-service` to ensure raw Python/C binaries (Swiss Ephemeris) run reliably.

### R4. Storage and Database Integration
Integrate Firebase Storage and ensure Firestore compatibility.
- Ensure audio blobs (SlideDeck) upload to Firebase Storage, structured as `users/{userId}/readings/{readingId}`.
- Ensure the server can read the astrology library from Firestore if it is not already doing so.

## Acceptance Criteria

### Backend & Frontend
- [ ] Running `firebase emulators:start` successfully spins up the local environment.
- [ ] The React client successfully communicates with the emulated Cloud Function API.

### Ephemeris Service
- [ ] The `ephemeris-service` contains a valid `Dockerfile` that successfully builds locally (`docker build .`).

### Storage
- [ ] Audio files save to the correct Firebase Storage path (`users/{userId}/readings/{readingId}`) and can be retrieved via signed URLs.
