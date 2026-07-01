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

## 2026-07-01T11:33:50Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

An automated secret-keeper that ensures no sensitive information (API keys, secrets, PII) is exposed. It will include a one-time audit script to scan and clean the current repository, and a pre-commit hook to prevent future secrets from being committed. Additionally, it will set up a "Grand Architect" mechanism to automatically keep the `ARCHITECTURE.md` file up to date after every push.

Working directory: c:\Users\tsgod\Projects\Coding\AEVUM-2.0
Integrity mode: development

## Requirements

### R1. One-time Audit Script
Provide a script that scans the entire repository for exposed secrets (e.g., API keys, tokens, passwords) and safely redacts or removes them.

### R2. Pre-commit Hook
Create a Git pre-commit hook that automatically scans files staged for commit and blocks the commit if any sensitive information is detected.

### R3. Grand Architect (Documentation Updater)
Create a mechanism (e.g., a GitHub Actions workflow or Git hook) that automatically updates the `ARCHITECTURE.md` file after every push. This ensures the architectural documentation stays in sync with the codebase so anyone can pick up the project and understand it.

## Acceptance Criteria

### Verification
- [ ] Running the audit script on a file containing a dummy secret (e.g., `TEST_API_KEY=12345secret`) successfully redacts or removes the secret.
- [ ] Attempting to commit a file with a dummy secret is blocked by the pre-commit hook.
- [ ] Attempting to commit a normal, safe file is allowed by the pre-commit hook.
- [ ] Pushing a dummy structural code change successfully triggers the Grand Architect updater.
- [ ] The `ARCHITECTURE.md` file is successfully updated or modified to reflect the dummy code change.
