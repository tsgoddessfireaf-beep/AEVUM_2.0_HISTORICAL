# Progress — 2026-06-29T07:30:50Z

Last visited: 2026-06-29T07:30:50Z

- [x] Backend Migration (Cloud Functions) <!-- id: 1 -->
  - [x] Refactor `server/index.js` to export Firebase HTTPS function `api` <!-- id: 2 -->
  - [x] Update `functions/package.json` with dependencies from `server/package.json` <!-- id: 3 -->
  - [x] Sync `functions/` code with `server/` (e.g. symlinks or copy script) <!-- id: 4 -->
  - [x] Refactor `server/lib/firebaseAdmin.js` to use ADC <!-- id: 5 -->
- [x] Frontend Migration & Rewrites (Firebase Hosting) <!-- id: 6 -->
  - [x] Configure `firebase.json` with rewrites for `api`, `ephemeris`, and SPA `index.html` <!-- id: 7 -->
- [x] Python Ephemeris Service (Cloud Run) <!-- id: 8 -->
  - [x] Validate `ephemeris-service/Dockerfile` <!-- id: 9 -->
  - [ ] Verify local docker build: `docker build -t aevum-ephemeris:latest ./ephemeris-service` (Command timed out, pending parent execution) <!-- id: 10 -->
- [x] Storage & Database Integration <!-- id: 11 -->
  - [x] Update `uploadSlideAudio` in `client/src/lib/firebase.js` to use dynamic path and auth user ID <!-- id: 12 -->
  - [x] Update `storage.rules` for readings path with email restriction and public read <!-- id: 13 -->
  - [x] Update `storage.rules` for library path and public read <!-- id: 14 -->
  - [x] Move astrology library text files from `library/shelves/` to storage `library/` folder <!-- id: 15 -->
  - [x] Refactor `client/src/components/dashboard/LibraryContext.jsx` to fetch from Firebase Storage <!-- id: 16 -->
  - [x] Remove static route serving `/api/library` in `server/index.js` <!-- id: 17 -->
- [ ] Verification <!-- id: 18 -->
  - [ ] Run `npm run install:all && npm run build` (Pending parent execution) <!-- id: 19 -->
  - [ ] Run `firebase emulators:start` and verify (Pending parent execution) <!-- id: 20 -->
  - [ ] Verify React client communicates with emulated Cloud Function API (Pending parent execution) <!-- id: 21 -->
  - [ ] Run unit/integration tests (Pending parent execution) <!-- id: 22 -->
