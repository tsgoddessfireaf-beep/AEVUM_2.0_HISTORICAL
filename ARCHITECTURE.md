# Aevum — Architecture Blueprint

**Owner:** Dolores Puckett / Aeonic Arts  
**Stack:** React + Vite · Firebase Functions · Python FastAPI · Firebase · Stripe · Resend  
**Hosted:** Firebase (Hosting & Functions)

---

## Overview

Aevum is a traditional horary astrology engine. A user submits a question, a chart is cast for the exact moment and place the question was asked, and Claude analyzes the chart using William Lilly's classical methods. The practitioner (Dolores) fulfills booked readings manually within 72 hours.

---

## Repository Structure

```
AEVUM/
├── client/                  React + Vite SPA (port 5173 in dev)
├── functions/               Firebase Cloud Functions (API backend)
├── ephemeris-service/       Python FastAPI sidecar (port 8000)
│   └── ephe/                Swiss Ephemeris .se1 data files (committed)
└── package.json             Root — runs ephemeris and client concurrently
```

---

## The Four-Step Wizard

```
/ask          → Question input (IntakePage)
/datetime     → Date, time, timezone, location (DateTimePage)
/significations → Claude interview: which house rules what (HouseSignificationPage)
/results      → Chart cast + paywall or full reading (ResultsPage)
```

All routes are public. No authentication required to reach the results page.  
State persists across page refreshes via Zustand + `localStorage` (`aevum-session` key).

---

## Data Flow

```
1. User submits question → stored in Zustand
2. User enters date/time/location → stored in Zustand
3. SSE stream → /api/chat/house-signification
   Claude interviews the user (≤3 questions)
   Returns <house_significations> JSON block when done
4. ResultsPage fires two requests in sequence:
   a. POST /api/ephemeris → Python sidecar → Swiss Ephemeris positions
   b. SSE stream → /api/chat/analyze → Claude horary judgment
5. Non-practitioner sees paywall (chart wheel + Book $88 CTA)
   Practitioner sees full reading (verdict, meaning, chart notes, what to do next)
```

---

## Ephemeris Sidecar

- **Language:** Python · FastAPI · pyswisseph
- **Endpoint:** `POST /calculate`
- **Precision:** 7 decimal places (~0.00036 arcseconds) — matches Solar Fire / AstroGold
- **Data files:** `ephemeris-service/ephe/sepl_18.se1`, `semo_18.se1` (committed to repo)
- **House system:** Regiomontanus by default (14 systems supported)
- **Cross-verification:** Node server adds NASA JPL Horizons check before returning to client
- **Key invariants:**
  - `swe.set_ephe_path()` called on startup — must point to the `.se1` files or Moon degrades ~1.4″
  - Time → JD uses `swe.utc_to_jd()` (leap-second correct), not `swe.julday()`

---

## Server Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ephemeris` | POST | Proxy to Python sidecar + JPL cross-verify |
| `/api/chat/house-signification` | POST | SSE — Claude interview, returns house JSON |
| `/api/chat/analyze` | POST | SSE — Claude horary analysis |
| `/api/chat/slides` | POST | JSON — generate 8 teaching slides (practitioner only) |
| `/api/booking/create-session` | POST | Create Stripe one-time checkout session |
| `/api/booking/confirm` | POST | Verify payment, send Resend confirmation email |

---

## Booking Flow (Public → Paid)

```
ResultsPage (non-practitioner)
  └── "Book your reading — $88" → /upgrade

UpgradePage
  └── handleBooking() → POST /api/booking/create-session
      └── Stripe Checkout (one-time, $88)
          └── Success URL: /upgrade/success?booking=1&session_id=...
              └── POST /api/booking/confirm
                  └── Resend email → customer confirmation
```

- **No subscription.** Single-use, one-time payment only.
- **Stripe keys:** server-side only (`STRIPE_SECRET_KEY`). No publishable key in client.
- **Price ID:** `STRIPE_BOOKING_PRICE_ID` in `functions/.env` or Firebase secrets.

---

## Practitioner Gate

```js
// client/src/lib/package.js
isPractitioner(user)  // checks VITE_PRACTITIONER_EMAILS env var
```

- Set `VITE_PRACTITIONER_EMAILS=tsgoddessfireaf@gmail.com` in production client environment variables
- Practitioners bypass the paywall and see the full reading
- Practitioners see the **Client Package** panel on ResultsPage → generate 8 teaching slides → record per-slide voice narration → share link delivers the narrated walkthrough to the client

---

## Reading Package (Practitioner-Only)

1. ResultsPage → **Generate teaching slides** → `POST /api/chat/slides`  
   Returns 8 structured slides: `{ kind, kicker, title, body[], teach, script }`
2. **Narration studio** (SlideDeck.jsx) → MediaRecorder records per slide  
   → uploads to Firebase Storage `readings/{id}/slide-{n}.{ext}`
3. **Share link** → `SharedReadingPage` renders deck with per-slide audio  
   → "▶ Play My Reading" auto-advances through all 8 narrated slides

---

## Claude API

- **Interview model:** `claude-haiku-4-5-20251001`. The interview phase uses standard streaming with no extended thinking budget to strictly minimize token consumption and speed up the user intake process.
- **Analysis model:** `claude-sonnet-4-6`.
- **House signification prompt:** conducts ≤3-question interview, emits `<house_significations>` JSON block
- **Analysis prompt:** applies Lilly's methods — significators, aspects, essential/accidental dignities, prohibitions, translations of light — writes a grounded 4–5 paragraph interpretation (no invented testimonies), structured output with `---HEADER---` sections parsed by `client/src/lib/analysis.js` using robust newline-agnostic regex.

---

## Client State (Zustand — `src/store/useAppStore.js`)

| Key | Description |
|---|---|
| `question` | Step 1 input |
| `dateTimeData` | `{ date, time, timezone, location, houseSystem, tradition }` |
| `interviewMessages` | Full Claude conversation history |
| `houseSignifications` | Parsed JSON: querent house, quesited house, label |
| `ephemerisData` | Raw sidecar response |
| `analysis` | Accumulated streaming analysis text |
| `readingId` | Firestore document ID after save |
| `chartPrefs` | User's chart display preferences |

All keys persisted to `localStorage` via Zustand `persist` middleware.

---

## Firebase

- **Auth:** Google sign-in (required to save readings to history)
- **Firestore:** Reading documents — question, chart data, analysis, significations. 
  - **Auto-Save:** User readings are automatically persisted to the `readings` collection upon completion, controlled by the `auto_save_history` preference toggle in the Data & Privacy settings (defaults to true).
- **Storage:** Practitioner voice narration blobs per slide (writes locked to the practitioner email)
- **Rules:** `firestore.rules`, `storage.rules` in repo root

---

## Environment Variables

### `functions/.env`
```
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=         # live: sk_live_...
STRIPE_BOOKING_PRICE_ID=   # live price ID for $88 product
RESEND_API_KEY=
```

### `client/.env.local`
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_PRACTITIONER_EMAILS=tsgoddessfireaf@gmail.com
```

---

## Firebase Deployment

- **Hosting:** Firebase Hosting (serves `client/dist`)
- **Functions:** Firebase Cloud Functions (serves `/api/**`)
- **Build & Deploy Command:** `npm run build && firebase deploy`

---

## Development

```bash
npm run install:all   # install all three packages
npm run dev           # starts ephemeris (:8000) and client (:5173)
npm run build         # production build (client only)
```

Vite dev server proxies `/api/*` → `https://us-central1-flutter-ai-playground-f880c.cloudfunctions.net/api`.

---

*Last updated: July 1, 2026*
