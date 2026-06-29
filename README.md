# Aevum

A traditional **horary astrology** web application for Aeonic Arts. Ask a sincere question, capture the exact moment, and receive a structured reading following William Lilly's classical method — complete with a full chart wheel, dignities, aspects, and Arabic Parts.

## What it does

1. **Question** — state a sincere question; the app detects whether it's an outcome question (perfection) or a character/motivation question (condition) and routes accordingly
2. **Moment** — capture the exact date, time, and place (with one-click geolocation); precision here is the chart
3. **Significations** — a brief AI interview maps the people and things in your question to their houses
4. **Reading** — the chart is cast at 7-decimal-place precision, cross-verified against NASA JPL, then Claude analyzes it using traditional rulerships, dignities, and aspects; verdict is YES / NO / MAYBE / WAIT / CHARACTER READ
5. **History** — past readings save to Firestore and are accessible from any device (requires Google sign-in)
6. **Booking** — Stripe-powered session booking with Resend confirmation email

## Stack

| Layer | Technology |
|---|---|
| Client | React 18 + Vite + Zustand + Tailwind CSS (Firebase Hosting) |
| Server | Node 22+ Firebase Cloud Functions (`api`) |
| AI | Anthropic Claude — `claude-haiku-4-5-20251001` (interview), `claude-sonnet-4-6` (analysis) |
| Ephemeris | Python FastAPI containerized on **Google Cloud Run** (`ephemeris-service`). Uses **pyswisseph** (Swiss Ephemeris) — 7 decimal place precision (~0.00036 arcseconds) |
| Cross-verification | NASA JPL Horizons DE441 — queried at exact Julian Day Number via `TLIST` mode; threshold 0.0001° |
| Persistence | Firebase Firestore (`readings` and `library_cards`) |
| Payments | Stripe Checkout |
| Email | Resend |
| Glyphs | AstroScript font (Jason Davies), Unicode fallback |

## Ephemeris accuracy

Charts are computed by the local Python sidecar using **Swiss Ephemeris** via `pyswisseph`, calling `swe.calc_ut()` directly against the JPL-derived `.se1` data files, which produces positions to 7 decimal places (~0.00036 arcseconds) — matching Solar Fire / AstroGold internal precision.

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

### Why discrepancies can still occur

| Cause | Typical magnitude |
|---|---|
| Different ephemeris files (DE431 vs DE441) | < 0.0001° at modern dates |
| JPL network failure (planet not queried) | badge trips; warnings logged |
| Apparent vs geometric coordinate difference | ~0.006° (aberration) — normally absorbed |

## Run locally

```bash
npm run install:all
# creates ephemeris-service/.venv, installs Python deps, and npm deps in client and functions

# Start the Firebase Emulators (includes Functions, Firestore, Hosting, etc.)
firebase emulators:start
# Also ensure the Ephemeris service is running locally if testing chart generation
cd ephemeris-service && fastapi dev main.py
```

## Build & Deploy for production

```bash
# Frontend
cd client && npm run build
firebase deploy --only hosting

# Backend (Cloud Functions)
firebase deploy --only functions:api

# Ephemeris Service (Cloud Run)
cd ephemeris-service
gcloud run deploy ephemeris-service --source . --platform managed --allow-unauthenticated
```

## Environment

`server/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BOOKING_PRICE_ID=price_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=bookings@yourdomain.com
EPHEMERIS_URL=http://localhost:8000/calculate   # optional override
```

`client/.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Security:** all secret keys (Anthropic, Stripe secret, Resend, Stripe webhook) must stay in `server/.env` — never in client code or `client/.env`.

## Architecture

```
client/src/pages/IntakePage.jsx     — question intake + detectQuestionType()
client/src/pages/DateTimePage.jsx   — moment capture + geocoding
client/src/pages/HouseSignificationPage.jsx  — SSE interview (haiku)
client/src/pages/DashboardPage.jsx  — active dashboard with Astrolabe animation and readings
client/src/components/ChartDisplay.jsx       — planet table + dual-source badge
client/src/components/SquareChart.jsx        — SVG horary square chart
client/src/components/Astrolabe.jsx          — Animated SVG astrolabe while waiting for the AI
client/src/store/useAppStore.js     — Zustand store
client/src/lib/analysis.js          — parseSections / answerStyle / formatInline

functions/routes/chat.js            — /api/chat/house-signification + /api/chat/analyze (SSE)
functions/routes/ephemeris.js       — /api/ephemeris → Cloud Run sidecar + JPL cross-audit
functions/routes/booking.js         — Stripe Checkout session + webhook handler
ephemeris-service/                  — Python FastAPI + pyswisseph (Swiss Ephemeris)
ephemeris-service/ephe/             — bundled Swiss Ephemeris data files (sepl_18.se1, semo_18.se1)
bibliotheca_astrologica_horaria/    — Genkit flow for embedding library manuscripts using Vertex AI
```

## Question types

| Type | Detection | Analysis method |
|---|---|---|
| **Perfection** | default (outcome/yes-no) | Watches two significators — do their planets meet? Verdict: YES / NO / MAYBE / WAIT |
| **Condition** | `why`, `what kind of person`, `what does X want`, `what motivated`, intention/motive patterns | Reads quesited significator's dignity, house, and aspects directly. Verdict: CHARACTER READ |

At intake, a teachable moment panel intercepts condition questions and explains the difference before proceeding.

## Firestore rules

See `firestore.rules`. Deploy via Firebase Console → Firestore → Rules, or `firebase deploy --only firestore:rules`.

## Astrology font

`AstroScript` by Jason Davies lives in `client/public/fonts/`. Edit `GLYPH_MODE` in `client/src/lib/glyphs.js` to switch between `'astroscript'` (default), `'unicode'`, or `'astronomicon'`.
