# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (run once after cloning)
npm run install:all

# Development — runs ephemeris sidecar (port 8000), server (3001), client (5173)
npm run dev

# Production build (client only)
npm run build

# Production server (serves built client + API)
cd server && NODE_ENV=production npm start
```

The Vite dev server proxies `/api/*` to `http://localhost:3001`, so no CORS issues during development.

## Environment

Create `server/.env` (copy from `.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

## Architecture

**Monorepo** with three independent packages:
- `server/` — Express.js Node API (ESM, port 3001)
- `client/` — React + Vite SPA (port 5173 in dev)
- `ephemeris-service/` — Python FastAPI sidecar (port 8000) calling pyswisseph (Swiss Ephemeris) directly

In production, Express serves the Vite build from `client/dist/` and handles all routes.

### Data flow through the 4-step wizard

```
Step 1 (IntakePage)  →  stores question in Zustand
Step 2 (DateTimePage) →  stores { date, time, timezone, location }
Step 3 (HouseSignificationPage) →  SSE streaming chat with Claude to determine house significations
Step 4 (ResultsPage) →  (a) POST /api/ephemeris (proxy to local Python sidecar)
                         (b) SSE streaming Claude analysis of chart data
```

All wizard state is persisted to `localStorage` via Zustand `persist` middleware (`aevum-session` key), so users survive page refreshes without losing progress. Navigating back to Step 2 resets downstream interview/signification state.

### Server routes

| Route | Method | Purpose |
|---|---|---|
| `/api/chat/house-signification` | POST | Streaming SSE — Claude interview to determine house significations |
| `/api/chat/analyze` | POST | Streaming SSE — Claude chart analysis |
| `/api/chat/slides` | POST | JSON — generates the 8-slide client teaching deck from a completed reading. Practitioner-only when `PRACTITIONER_EMAILS` (server env, comma-separated) is set. |
| `/api/ephemeris` | POST | Proxy to local Python sidecar (`http://localhost:8000/calculate` by default; override via `EPHEMERIS_URL`). Adds NASA JPL Horizons cross-verification before returning. |

Both chat routes use SSE with `data: {"type":"text","text":"..."}` frames, terminated by `data: {"type":"done",...}`. The house-signification endpoint additionally parses `<house_significations>{...}</house_significations>` from Claude's output and returns the JSON in the `done` frame.

### Claude API usage

- **Models**: `claude-haiku-4-5` for the interview (with a 1500-token thinking budget for sharper house-indicator selection); `claude-sonnet-4-6` for the chart analysis (adaptive thinking, `effort: high`)
- **House signification system prompt**: instructs Claude to conduct a ≤3-question interview, then emit a `<house_significations>` JSON block signaling completion
- **Analysis system prompt**: instructs Claude to apply William Lilly's horary methods (significators, aspects, dignities, prohibitions), write a grounded 4–5 paragraph interpretation (no invented testimonies), and structure output with `## Header` sections

### Client state (Zustand store — `src/store/useAppStore.js`)

| Key | Type | Description |
|---|---|---|
| `question` | string | Step 1 input |
| `dateTimeData` | object | `{ date, time, timezone, location }` |
| `interviewMessages` | array | Full Claude conversation history (role/content pairs) |
| `houseSignifications` | object | Parsed JSON from Claude: `{ querent_house, quesited_house, quesited_label, ... }` |
| `ephemerisData` | object | Raw response from the ephemeris sidecar |
| `analysis` | string | Accumulated streaming analysis text |

### Reading package (booked-client deliverable)

Booked readings ($88 booking flow) are fulfilled by the practitioner inside the normal wizard, then upgraded into a premium package on the Results page:

1. The practitioner (signed in with an email listed in `VITE_PRACTITIONER_EMAILS`) sees the **Client Package** panel on ResultsPage → "Generate teaching slides" calls `/api/chat/slides`, which returns 8 structured slides (`kind/kicker/title/body[]/teach/script`) saved to the reading doc as `packageSlides`.
2. The **narration studio** in `SlideDeck.jsx` records the practitioner's voice per slide via MediaRecorder; blobs upload to Firebase Storage (`readings/{id}/slide-{n}.{ext}`, rules in `storage.rules`) and download URLs persist as `packageAudio.{index}`.
3. Sharing the reading (existing `isPublic` flow) gives the client a link where `SharedReadingPage` renders the deck with per-slide audio and a "Play my reading" auto-advancing narrated walkthrough.

### Ephemeris sidecar (`ephemeris-service/`)

Local Python FastAPI service that calls **pyswisseph** (Swiss Ephemeris) directly against the bundled `.se1` data files — no third-party network dependency. Returns planetary positions, house cusps, and angles at **7 decimal-place precision** (~0.00036 arcseconds), matching what Solar Fire / AstroGold deliver internally.

- **Endpoint**: `POST /calculate`
- **Request**: `{ date, time, timezone, location, latitude?, longitude?, house_system? }`. If `latitude`/`longitude` are omitted, the service geocodes `location` via Nominatim.
- **Response**: `chart_meta` (now includes `ephemeris_source` — the ephemeris actually used), `houses` (Regiomontanus by default), `planets` (Sun–Saturn with `sign`, `sign_degree`, `ecliptic_longitude`, `ecliptic_latitude`, `house`, `is_retrograde`, `daily_speed`, `declination`), `nodes.mean_north_node`, `lunar_phase`, `errors`.
- **House systems**: 14 supported via single-letter code (`R` = Regiomontanus default, `P` = Placidus, `K` = Koch, etc.)
- **Precision invariants** (don't regress these):
  - Data files `ephemeris-service/ephe/{sepl_18,semo_18}.se1` MUST be present and `swe.set_ephe_path()` called on startup, else `pyswisseph` silently degrades to the Moshier fallback (~1.4″ Moon error). The service reads the return flag, surfaces `chart_meta.ephemeris_source`, and appends a warning to `errors` on fallback. Override the path with `SE_EPHE_PATH`.
  - Time → JD uses `swe.utc_to_jd()` (leap-second correct UT), not `swe.julday()` on the UTC clock value.
  - `swe.houses()` cusp tuple is 0-indexed/12-long on pyswisseph ≥2.10 (was 1-indexed/13-long on the old flatlib-bundled build); the cusp extraction normalises both so house numbering stays correct.
- **Setup**: `npm run install:all` creates `ephemeris-service/.venv` and installs `requirements.txt` (which pins `pyswisseph`; `flatlib` is no longer a dependency). The `.se1` data files are committed to the repo under `ephemeris-service/ephe/`.

The Node `/api/ephemeris` route proxies to this sidecar and adds NASA JPL Horizons cross-verification before returning to the client.

### Markdown rendering

The Results page uses a minimal inline `renderMarkdown()` function (no library) that handles `## H2`, `**bold**`, `*italic*`, and paragraph breaks. Claude's analysis output is styled via the `.prose-astro` CSS class in `index.css`.
