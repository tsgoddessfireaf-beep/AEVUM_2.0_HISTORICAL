# Project: Aevum Firebase Migration
# Scope: Global Migration to Firebase Cloud Infrastructure

## Architecture
- **Backend**: Express.js server migrated to Firebase Cloud Functions (`functions.https.onRequest(app)`). Serves API endpoints under `/api/**` (chat/house-signification, chat/analyze, chat/slides, booking/create-session, booking/confirm).
- **Frontend**: React + Vite client deployed to Firebase Hosting. Rewrites in `firebase.json` route `/api/**` to Cloud Functions, `/ephemeris/**` to Cloud Run, and all other routes to the SPA `index.html`.
- **Python Ephemeris Service**: FastAPI sidecar containerized with a Dockerfile for Google Cloud Run, exposed on `/ephemeris/**`.
- **Storage**: Audio blobs from SlideDeck recorded by the practitioner uploaded to Firebase Storage under `users/{userId}/readings/{readingId}/slide-{n}.{ext}`.
- **Database**: Firestore is used for storing reading documents (question, chart data, analysis, significations) and the astrology library.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Detailed Planning | Analyze existing codebase, list of dependencies, current Firebase configuration, and draft detailed implementation tasks. | None | IN_PROGRESS |
| 2 | Python Ephemeris Service (R3) | Containerize the FastAPI service with a Dockerfile, ensuring Swiss Ephemeris binaries run. | None | PLANNED |
| 3 | Backend Migration (R1) | Refactor server to export a Cloud Function, move dependencies, use application-default credentials. | M1 | PLANNED |
| 4 | Storage & Database (R4) | Implement Firebase Storage upload path/signed URLs and Firestore library reading. | M3 | PLANNED |
| 5 | Frontend Migration (R2) | Deploy React client to Firebase Hosting with rewrites. | M3 | PLANNED |
| 6 | E2E Integration & Verification | Run Firebase emulators, verify client-server communication, test audio uploads and ephemeris calls. | M2, M3, M4, M5 | PLANNED |

## Interface Contracts
### Client ↔ Cloud Functions (Backend)
- `/api/chat/house-signification` [POST] - SSE stream
- `/api/chat/analyze` [POST] - SSE stream
- `/api/chat/slides` [POST] - JSON
- `/api/booking/create-session` [POST] - JSON
- `/api/booking/confirm` [POST] - JSON

### Client/Backend ↔ Ephemeris (Cloud Run)
- `/ephemeris/calculate` [POST] - JSON (Forwarded by Hosting or direct). Note: originally it was `/api/ephemeris` proxying to `localhost:8000/calculate`. Under Firebase, we want to route `/ephemeris/**` to Cloud Run. We need to check how the client calls it, or how the backend proxies it.

## Code Layout
- `client/` - React Vite SPA
- `server/` - Express API
- `ephemeris-service/` - Python FastAPI sidecar
- `functions/` - Firebase Cloud Functions directory
- `firebase.json` - Firebase Configuration
- `.firebaserc` - Firebase Project Configuration
