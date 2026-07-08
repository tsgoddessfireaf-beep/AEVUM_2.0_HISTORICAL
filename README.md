# Aevum

A traditional **horary astrology** web application for Aeonic Arts. Ask a sincere question, capture the exact moment, and receive a structured reading following William Lilly's classical method — complete with the traditional square ("diamond") chart, dignities, aspects, and Arabic Parts.

## What it does

1. **Question** — state a sincere question; the app detects whether it's an outcome question (perfection) or a character/motivation question (condition) and routes accordingly
2. **Moment** — capture the exact date, time, and place (with one-click geolocation); precision here is the chart. As soon as the moment is confirmed the chart calculation begins in the background, so it's ready by the time the interview finishes
3. **Significations** — a brief AI interview maps the people and things in your question to their houses
4. **Radicality** — before any judgment, a gate page runs William Lilly's radicality check (`getStrictures`): if the chart is fit to judge it offers **Continue to Final Judgement**; if strictures are present (early/late Ascendant, Saturn in the 1st/7th) it explains why and steers you to ask again later
5. **Reading** — the chart is cast at 7-decimal-place precision, cross-verified against NASA JPL, then Claude analyzes it using traditional rulerships, dignities, and aspects; verdict is YES / NO / MAYBE / WAIT / CHARACTER READ. While it works, a progress bar with rotating astrologer phrases fills in (no animation, target < 20s)
6. **History** — past readings save to Firestore and are accessible from any device (Google sign-in required)
7. **Booking** — Stripe-powered session booking with Resend confirmation email
8. **Client Package** *(practitioner-only)* — generates an 8-slide teaching deck per reading (`ReadingPackagePanel` / `SlideDeck`), with per-slide practitioner voice narration, delivered to the client via a shareable link (`SharedReadingPage`)

## Stack

| Layer | Technology |
|---|---|
| Client (app) | React 18 + Vite + Zustand + Tailwind CSS — Firebase Hosting target `app` |
| Marketing site | Static HTML/CSS in `site/` — Firebase Hosting target `landing` (site `flutter-ai-playground-f880c`), deployed by the same root pipeline as the app |
| Server | Node 22, Express wrapped in a Firebase Cloud Functions (gen2) `onRequest` export (`api`) |
| AI | Anthropic Claude — `claude-haiku-4-5-20251001` (house-signification interview, thinking budget), `claude-sonnet-4-6` (chart analysis, adaptive thinking / high effort). Both IDs verified current as of Jul 2026 |
| Ephemeris | Python 3.13 + FastAPI, containerized on **Google Cloud Run** (`ephemeris-service`). Uses **pyswisseph** (Swiss Ephemeris) — 7 decimal place precision (~0.00036 arcseconds) |
| Cross-verification | NASA JPL Horizons DE441 — queried at exact Julian Day Number via `TLIST` mode; threshold 0.0001° |
| Persistence | Firebase Firestore (`readings`, `users`, `hora_reading_drafts`, `library_cards`) |
| Library search | `bibliotheca_astrologica_horaria/` — separate Genkit Cloud Functions codebase, Vertex AI embeddings + Firestore vector retriever over the manuscript corpus in `library/` |
| Payments | Stripe Checkout |
| Email | Resend |
| Error monitoring | Sentry (`@sentry/react` client, `@sentry/node` server), gated on `SENTRY_DSN` / `VITE_SENTRY_DSN` |
| Glyphs | AstroScript font (Jason Davies), Unicode fallback |

> **Hosting layout.** The root `firebase.json` defines **both** hosting targets — `landing` (`public: site/`) and `app` (`public: client/dist`) — and the root `.firebaserc` maps them (`landing` → site `flutter-ai-playground-f880c`, `app` → site `aevum-app`). A single `firebase deploy --only hosting` from the repo root therefore ships the marketing site and the app together; that's what CI does. The `site/` subfolder also contains its own `.firebaserc` and a `site/.github/workflows/firebase-hosting-pull-request.yml` — these are leftovers from a `firebase init hosting:github` run inside `site/` and only produce **PR preview channels**, not production deploys. `site/.firebaserc` says `flutter-ai-playground`, which is the same GCP project as `flutter-ai-playground-f880c` (Google shows a project *name* and a project *id*); it is not drift. The redundant `site/` workflow can be removed if you want to avoid confusion.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. **test-client** — Vitest, client package
2. **test-server** — Vitest, `functions/` package
3. **build** — production client build (gate: both test jobs must pass)
4. **deploy** *(main branch pushes only)* — rebuilds the client with production env vars, installs each functions codebase's dependencies, then `firebase deploy --only hosting,functions,firestore,storage`

**Deploy authentication** uses **Workload Identity Federation** — GitHub's OIDC token is exchanged for short-lived Google credentials scoped to this exact repo (`github-actions-pool` / `github-provider`, bound to `github-action-1272176989@flutter-ai-playground-f880c.iam.gserviceaccount.com`). There is no service-account key file anywhere, checked in or otherwise — key creation is blocked by GCP org policy on this project, which is why WIF is used instead of a stored secret.

**Service-account roles.** WIF only handles *authentication*; the deploy account also needs *authorization*. `github-action-1272176989@` is granted, at the project level, `roles/firebase.admin`, `roles/cloudfunctions.admin`, `roles/run.admin`, `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor`, `roles/serviceusage.serviceUsageConsumer`, and `roles/secretmanager.admin` (functions bind secrets via `defineSecret`), plus `roles/iam.serviceAccountUser` on **both** runtime service accounts it must act as — the App Engine SA (`…@appspot`) and the Compute Engine default SA (`…-compute@developer`), since gen2 functions run as the latter. Missing any of these makes `firebase deploy` fail partway with a 403 pointing at the specific permission.

**Functions dependencies must be installed before deploy.** Firebase analyzes each functions codebase's source at deploy time and needs `firebase-functions` present in its `node_modules`, so the deploy job runs `npm ci --prefix functions` and `npm install --prefix bibliotheca_astrologica_horaria/functions` before `firebase deploy`. Without this it fails with *"Couldn't find firebase-functions package in your source code."*

`bibliotheca_astrologica_horaria/` deploys as a second Functions codebase from the same `firebase deploy --only functions` call (see `firebase.json` → `functions[]`).

> The Cloud Run **ephemeris service is not part of `firebase deploy`** — it deploys separately with `gcloud run deploy` (see below). CI does not touch it.

## Ephemeris accuracy

Charts are computed by the Python sidecar using **Swiss Ephemeris** via `pyswisseph`, calling `swe.calc_ut()` directly against the JPL-derived `.se1` data files, which produces positions to 7 decimal places (~0.00036 arcseconds) — matching Solar Fire / AstroGold internal precision.

> **The data files are required for this precision.** The `1800–2400 CE` Swiss Ephemeris blocks — `sepl_18.se1` (planets) and `semo_18.se1` (Moon) — ship in `ephemeris-service/ephe/`. If they are missing, `pyswisseph` silently falls back to its built-in **Moshier** ephemeris (off by up to ~1.4″ on the Moon), so the service registers the data path on startup, reports the ephemeris actually used in `chart_meta.ephemeris_source`, and pushes a warning into the response `errors` array if it ever falls back. Override the file location with the `SE_EPHE_PATH` environment variable.

Time is converted to Universal Time with `swe.utc_to_jd()` (leap-second / UTC→UT1 correct), not by treating the UTC clock value as UT — the latter shortcut costs ~0.19″ of Moon motion.

Every chart is then cross-audited against **NASA JPL Horizons DE441** in real time. The comparison:

- Queries JPL at the exact Julian Day Number via `TLIST_TYPE=JD` — no step-size rounding
- JD precision: 9 decimal places (~0.0864ms, or ~0.0000004° for the Moon)
- Passes `QUANTITIES=31`: apparent geocentric ecliptic longitude (same reference frame as Swiss Ephemeris)
- **Threshold: 0.0001°** (0.36 arcseconds) — any planet exceeding this shows the amber "Audit warning" badge
- Typical verified max Δ for modern dates: < 0.0001° for Sun–Saturn
- Warnings and per-planet diffs are logged to the server console for diagnosis

The "Dual-Source Verified" badge (green) confirms all checked planets pass. The "Audit warning" badge (amber) means at least one planet diverges — worth reviewing before using the chart for a reading.

`tzdata` is floor-pinned (`>=2025.1`) rather than exact-pinned, so `pip install --upgrade tzdata` should be run periodically — a stale timezone database silently produces wrong chart times for any zone whose DST rules changed since the pin.

### Why discrepancies can still occur

| Cause | Typical magnitude |
|---|---|
| Different ephemeris files (DE431 vs DE441) | < 0.0001° at modern dates |
| JPL network failure (planet not queried) | badge trips; warnings logged |
| Apparent vs geometric coordinate difference | ~0.006° (aberration) — normally absorbed |

## Run locally

```bash
npm run install:all
# creates ephemeris-service/.venv (Python 3.13), installs Python deps,
# and npm deps in client and functions

# Start the Firebase Emulators (Functions, Firestore, Auth, Storage, Hosting)
firebase emulators:start

# Ephemeris service (separate terminal)
npm run dev:ephemeris
# or: cd ephemeris-service && uvicorn main:app --port 8000 --reload

# Client dev server (separate terminal)
npm run dev:client

# ...or run ephemeris + client together:
npm run dev
```

## Build & Deploy for production

Normally this happens automatically via CI/CD on push to `main` (see above). To deploy manually:

```bash
# Frontend + backend + Firestore/Storage rules & indexes
firebase deploy --only hosting,functions,firestore,storage

# Ephemeris Service (Cloud Run) — not part of the Firebase deploy
cd ephemeris-service
gcloud run deploy ephemeris-service --source . --region us-central1 --platform managed
```

> **Container build note.** `pyswisseph` ships no prebuilt wheel for Python 3.13, so pip compiles its C extension (`libswe`) from source at image-build time. The `Dockerfile` installs `build-essential` before `pip install` and purges it in the same layer afterward — without a compiler the Cloud Run build fails with *"command 'gcc' failed: No such file or directory."* The compiled extension links only against `libc`/`libm`, so the runtime image stays slim.

## Environment

`functions/.env` (non-secret config, committed — Firebase gen2 loads `.env` files from the functions source directory):
```
EPHEMERIS_URL=https://<cloud-run-url>/calculate
PRACTITIONER_EMAILS=you@example.com          # comma-separated; gate FAILS CLOSED if empty
STRIPE_PRICE_ID=price_...                     # optional
STRIPE_BOOKING_PRICE_ID=price_...             # optional
```

**Secrets** (never in `.env` — managed via Firebase Secret Manager, bound in `functions/index.js`):
```
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set RESEND_API_KEY
```

`client/.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_PRACTITIONER_EMAILS=you@example.com      # must match PRACTITIONER_EMAILS above
VITE_SENTRY_DSN=...                            # optional
```

**Security:** all secret keys (Anthropic, Stripe secret, Resend, Stripe webhook) live in Firebase Secret Manager — never in `functions/.env`, client code, or `client/.env.local`. The practitioner-only endpoints (`/api/chat/analyze`, `/api/chat/follow-up`, `/api/chat/slides`) fail closed: if `PRACTITIONER_EMAILS` is unset in production, every request is rejected rather than allowed through.

## Architecture

```
client/src/App.jsx                           — routes; pings /api/ephemeris/warmup on load to wake Cloud Run
client/src/pages/IntakePage.jsx              — question intake + detectQuestionType()
client/src/pages/DateTimePage.jsx            — moment capture + geocoding; prefetches the chart on Continue
client/src/pages/HouseSignificationPage.jsx  — SSE interview (haiku)
client/src/pages/RadicalityPage.jsx          — radicality gate (/radicality) — getStrictures → judge or ask-again
client/src/pages/DashboardPage.jsx           — active dashboard, reading display, paywall/practitioner gate
client/src/pages/HistoryPage.jsx             — Firestore reading history
client/src/pages/UpgradePage.jsx             — Stripe paid tier checkout/portal
client/src/pages/SharedReadingPage.jsx       — public read-only reading link + Client Package deck
client/src/components/ChartDisplay.jsx       — planet table + dual-source badge
client/src/components/SquareChart.jsx        — SVG horary square ("diamond") chart — the only chart display in use
client/src/components/LoadingProgress.jsx    — static progress bar + rotating astrologer phrases (reading wait)
client/src/components/Astrolabe.jsx          — SVG chart-wheel renderer, used in the print-only report view (skipAnimation)
client/src/components/ReadingPackagePanel.jsx — practitioner-only: generate the 8-slide Client Package
client/src/components/SlideDeck.jsx          — slide renderer + narration studio (MediaRecorder → Storage)
client/src/store/useAppStore.js              — Zustand store
client/src/lib/warnings.js                   — getChartWarnings (VOC, combustion…) + getStrictures (radicality)
client/src/lib/analysis.js                   — parseSections / answerStyle / formatInline

functions/routes/chat.js                     — /api/chat/house-signification, /analyze, /follow-up, /slides (SSE)
functions/routes/ephemeris.js                — /api/ephemeris → Cloud Run sidecar + JPL cross-audit; warmup ping
functions/routes/booking.js                  — Stripe Checkout session + webhook handler
functions/routes/stripe.js                   — subscription checkout/portal routes

ephemeris-service/                           — Python FastAPI + pyswisseph (Swiss Ephemeris)
ephemeris-service/ephe/                      — bundled Swiss Ephemeris data files (sepl_18.se1, semo_18.se1)

bibliotheca_astrologica_horaria/             — Genkit flow (2nd Functions codebase): embeds & retrieves
                                                library manuscripts (Vertex AI + Firestore vector search)
library/                                     — the manuscript corpus (Lilly, Bonatti, Culpeper, Dariot,
                                                Jacquinot, Ibn Ezra, Naibod, Alchabitius) + ingestion scripts

site/                                        — static marketing site (Hosting target `landing`, deployed by root CI)
```

## Question types

| Type | Detection | Analysis method |
|---|---|---|
| **Perfection** | default (outcome/yes-no) | Watches two significators — do their planets meet? Verdict: YES / NO / MAYBE / WAIT |
| **Condition** | `why`, `what kind of person`, `what does X want`, `what motivated`, intention/motive patterns | Reads quesited significator's dignity, house, and aspects directly. Verdict: CHARACTER READ |

At intake, a teachable moment panel intercepts condition questions and explains the difference before proceeding.

## Firestore rules & indexes

See `firestore.rules` and `firestore.indexes.json` (both deploy via CI, or manually with `firebase deploy --only firestore`). The `readings` collection query (`userId` == + `createdAt` desc, used by reading history) requires the composite index codified there — without it, a fresh Firebase project would silently return empty history.

## Astrology font

`AstroScript` by Jason Davies lives in `client/public/fonts/`. Edit `GLYPH_MODE` in `client/src/lib/glyphs.js` to switch between `'astroscript'` (default), `'unicode'`, or `'astronomicon'`.
