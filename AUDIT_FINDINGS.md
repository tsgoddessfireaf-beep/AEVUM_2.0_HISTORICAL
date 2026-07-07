# AEVUM-2.0 Error Area Audit — Findings & Proposed Repairs
**Date:** July 7, 2026 | **Mode:** Read-only audit — NO changes made yet
**Status:** AWAITING DOLORES APPROVAL before any repair

---

## Severity Legend
🔴 Critical — can break production or security | 🟠 High — will bite eventually | 🟡 Medium — hygiene/drift

---

## AREA 1: Ephemeris Service Initialization — ✅ MOSTLY SOLID

**Verified good:**
- Both `sepl_18.se1` and `semo_18.se1` present in `ephemeris-service/ephe/`
- `SE_EPHE_PATH` defaults correctly, re-asserted per request
- Startup provenance log reports actual ephemeris source (Swiss vs Moshier)
- Moshier fallback is detected and surfaced in `errors` + `chart_meta.ephemeris_source`

**Findings:**
| # | Sev | Finding | Proposed repair |
|---|-----|---------|-----------------|
| 1.1 | 🟡 | Comment in main.py (line 41) says `seas_18.se1` should also be in ephe/ — it isn't. Not needed (only classical planets + nodes calculated), but the comment misleads. | Edit comment to list only the two required files. |

---

## AREA 2: Environment Variables & Secrets — 🔴 MULTIPLE FINDINGS

**Env vars the code actually uses:**
- **Functions runtime:** ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, STRIPE_BOOKING_PRICE_ID, RESEND_API_KEY, EPHEMERIS_URL, PRACTITIONER_EMAILS, SENTRY_DSN, FIREBASE_SERVICE_ACCOUNT_JSON, JPL_RETRY_BASE_MS
- **Client build-time:** 6× VITE_FIREBASE_*, VITE_PRACTITIONER_EMAILS, VITE_SENTRY_DSN

**Findings:**
| # | Sev | Finding | Proposed repair |
|---|-----|---------|-----------------|
| 2.1 | 🔴 | **Practitioner gate fails OPEN.** `functions/routes/chat.js:23` — if `PRACTITIONER_EMAILS` is unset in production, `allowed.length` is 0 and the check is skipped: **any signed-in user can generate full readings/slides.** Only 3 secrets are bound via `defineSecret` (Anthropic + 2 Stripe); PRACTITIONER_EMAILS is not among them and `functions/.env` doesn't set it. | (a) Change gate to fail CLOSED (deny when list is empty), or (b) add `PRACTITIONER_EMAILS=tsgoddessfireaf@gmail.com` to `functions/.env` (non-secret, deployed with functions). Recommend BOTH. |
| 2.2 | 🔴 | **There is NO deploy step anywhere.** `ci.yml` only tests + builds; no `firebase deploy` workflow exists. Earlier assumption of "auto-deploy on green" was wrong — deploys are manual from your machine. | Either accept manual deploys (document it), or add a deploy job to ci.yml using a `FIREBASE_TOKEN`/service-account GitHub secret. Your call. |
| 2.3 | 🟠 | `functions/.env` is **tracked in git** (gitignore lists it, but it was committed before — gitignore doesn't untrack). Today it only holds EPHEMERIS_URL (harmless public URL), but any secret added later gets committed silently. | `git rm --cached functions/.env` (file stays on disk, leaves git). Add `functions/.env.example` documenting expected keys. |
| 2.4 | 🟠 | `RESEND_API_KEY` never configured for production (not in defineSecret, not in .env) → booking confirmation emails silently never send (code null-checks and skips). | Bind it: `firebase functions:secrets:set RESEND_API_KEY`, add to the `secrets:[...]` array in functions/index.js. |
| 2.5 | 🟠 | CI build injects only the 6 VITE_FIREBASE_* vars. `VITE_PRACTITIONER_EMAILS` and `VITE_SENTRY_DSN` missing → CI-built client has no practitioner panel and no error reporting. | Add both to the build env in ci.yml + as GitHub secrets. |
| 2.6 | 🟡 | STRIPE_PRICE_ID / STRIPE_BOOKING_PRICE_ID not bound to the function config anywhere visible. | Add to functions/.env (they're not secrets) once 2.3 is fixed. |

**How to check your GitHub secrets (for 2.2/2.5 and drafting-scribe):**
1. Open https://github.com/tsgoddessfireaf-beep/AEVUM_2.0_HISTORICAL/settings/secrets/actions
2. Compare the list against: `ANTHROPIC_API_KEY` (used by drafting-scribe.yml), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
3. Tell me which ones are missing — names only, never paste values.

---

## AREA 3: Firestore & Storage Rules — ✅ RULES MATCH CODE, ONE GAP

**Verified good:**
- Client uses exactly 3 collections (`users`, `readings`, `hora_reading_drafts`) — all covered by rules, deny-all catch-all present
- Storage upload path in code matches rules exactly; practitioner-only write enforced by email + email_verified
- Public reading share flow consistent with rules

**Findings:**
| # | Sev | Finding | Proposed repair |
|---|-----|---------|-----------------|
| 3.1 | 🟠 | `loadUserReadings` queries `where('userId'==) + orderBy('createdAt' desc)` → **requires a composite index**. Root `firestore.indexes.json` is EMPTY and firebase.json's firestore section doesn't reference it. If the index exists it was made by hand in the console — not codified. A fresh project/env would silently return an empty history (error is swallowed to `console.warn`). | Add the composite index to `firestore.indexes.json` and add `"indexes": "firestore.indexes.json"` to firebase.json. |
| 3.2 | 🟡 | storage.rules header comment says files live at `readings/{id}/...` — actual path is `users/{uid}/readings/{id}/...`. CLAUDE.md has the same stale path. | Fix both comments. |

---

## AREA 4: Python Version Consistency — 🟠 DRIFT CONFIRMED

**Findings:**
| # | Sev | Finding | Proposed repair |
|---|-----|---------|-----------------|
| 4.1 | 🟠 | Local `.venv` runs **Python 3.9.13** (past end-of-life Oct 2025); Dockerfile runs **3.11**. `install:all` uses bare `python` → whatever's first on PATH. Two environments, two interpreters. | Pin: change install:all to `py -3.13 -m venv .venv` (you have 3.13 installed) and bump Dockerfile to `python:3.13-slim`. Rebuild venv. |
| 4.2 | 🟠 | `tzdata==2024.2` pinned — timezone/DST rules frozen at late-2024. It's mid-2026: any jurisdiction that changed DST since then gives **wrong chart times** on Windows (where the pip tzdata is used). For horary, that's a wrong-house-cusps bug. | Bump to current tzdata release and add a note to refresh it periodically. |
| 4.3 | 🟡 | CI never tests the Python service at all — no lint, no import check, nothing. | Optional: add a tiny CI job that creates the venv and runs a smoke `POST /calculate` against a known chart. |

---

## AREA 5: Monorepo Dependencies — 🔴 ONE LANDMINE + DRIFT

**Findings:**
| # | Sev | Finding | Proposed repair |
|---|-----|---------|-----------------|
| 5.1 | 🔴 | **`scripts/sync-functions.js` is a destructive landmine.** It deletes `functions/lib`, `functions/routes`, `functions/index.js`, then recreates them as symlinks **from `server/` — a directory that no longer exists.** Anyone running it destroys the functions codebase (recoverable via git, but still). This is leftover from the old server/→functions migration. | Move script to a `to delete after Dolores Review/` folder (per your no-delete rule) and remove any npm script references. |
| 5.2 | 🟠 | Root `package.json` duplicates ALL of functions' runtime deps (anthropic, express, firebase-admin, firebase-functions, stripe, dotenv). Root's `main` even points at functions/index.js. Two copies = version drift and double `npm audit` surface. | Remove the duplicated runtime deps from root (keep only `concurrently`). Root is just an orchestrator. |
| 5.3 | 🟠 | `bibliotheca_astrologica_horaria/functions` uses **firebase-functions ^7.0.0** while main functions uses **^6.0.0** — two major versions deployed from one firebase.json. Also firebase-admin ^13.6.0 vs ^13.10.0. | Align both codebases on firebase-functions v6 (or test v7 and upgrade both). |
| 5.4 | 🟡 | No npm workspaces config — 4 separate lockfiles with no cross-package constraint. | Optional: adopt npm workspaces later. Not urgent. |

---

## PROPOSED REPAIR ORDER (once you approve)

1. **2.1** Practitioner gate fail-closed + set PRACTITIONER_EMAILS (security)
2. **5.1** Quarantine sync-functions.js landmine (data-loss prevention)
3. **3.1** Codify the readings composite index
4. **2.3** Untrack functions/.env + create .env.example
5. **2.4 / 2.5 / 2.6** Wire up missing secrets & CI build vars (needs your GitHub secrets check)
6. **4.1 / 4.2** Python 3.13 pin + tzdata refresh + venv rebuild
7. **5.2 / 5.3** Dependency dedup & version alignment
8. **1.1 / 3.2** Comment/doc fixes
9. **2.2** Decide: manual deploys documented, or add deploy workflow

Nothing has been changed yet. Reply with the numbers you approve (or "all"), and any you want done differently.
