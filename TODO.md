# Aevum — TODO

Phases 1, 2, and 3 are complete. The horary engine is practitioner-grade, accounts are required, and Stripe monetization is live.

---

## Phase 4 — Production Infrastructure

- [ ] **CI/CD** *(DevOps)*
  GitHub Actions running the full test suite on every push. Failing tests block merges. Auto-deploy to production on main.

- [ ] **Error Monitoring** *(Reliability)*
  Sentry (or equivalent) for client + server exceptions. Alerts on API failures, ephemeris errors, Firebase write failures.

- [ ] **Rate Limiting & Cost Controls** *(Reliability)*
  Enforce reading quotas server-side. Graceful degradation when Gemini API is slow or unavailable.

- [ ] **Performance** *(UX)*
  Bundle audit, lazy-load heavy components, cache ephemeris responses for identical date/time/location requests.

- [ ] **Wire the real library into the analysis engine** *(Grounding quality)*
  `library/cards/*.jsonl` (Lilly, Bonatti, Culpeper, Dariot, Jacquinot, Ibn Ezra, Naibod, Alchabitius — each entry has a real `id`, `topics`, `condition_keys`) is not connected to the server at all. The live `/api/chat/analyze` endpoint only pulls from the small hardcoded `HISTORICAL_APHORISMS` set in `functions/lib/historicalTexts.js`. Needs: load the jsonl shelves server-side, match against chart conditions via `condition_keys`/`topics` (replacing or supplementing `matchHistoricalAphorisms`), inject matched cards into the analysis prompt, and return their real card IDs as structured citations (superseding the small-fix citation shape added for the hardcoded set).

---

## Completed ✓ — Phase 5 Launch Ready

- [x] **Mobile Layout Pass** — `py-6 sm:py-12` outer padding, `text-5xl sm:text-7xl` answer, `p-4 sm:p-7` cards, `grid-cols-1 sm:grid-cols-2` significations grids, `flex-wrap` footer buttons, `overflow-x-auto` aspects table
- [x] **First-Time User Onboarding** — already implemented in IntakePage (`aevum-visited` localStorage gate, 4-step explainer)
- [x] **Empty / Error States** — icon + actionable CTA on all error states; quota/plan errors show "View Plans" link; interview errors show retry; server errors are now friendly messages (Phase 4)
- [x] **PDF / Print Export** — already implemented: full `@media print` CSS in `index.css`, `handlePrint()` + `buildReadingFilename()` in ResultsPage

---

## Completed ✓ — Phase 4 Production Infrastructure

- [x] **CI/CD** — GitHub Actions runs client + server tests on every push/PR; build gate requires both; auto-deploy to Render on merge to main
- [x] **Error Monitoring** — Sentry initialized on both client (`@sentry/react`) and server (`@sentry/node`), gated on `SENTRY_DSN` / `VITE_SENTRY_DSN` env vars
- [x] **Rate Limiting** — `express-rate-limit` applied to `/api/chat` and `/api/ephemeris` at 30 req/15 min per IP
- [x] **Graceful Gemini degradation** — `friendlyApiError()` maps overload/rate-limit/timeout/connection errors to plain-English messages; unexpected errors captured to Sentry
- [x] **Performance** — lazy-loaded all pages except LandingPage; `react-vendor` + `firebase-vendor` chunk split; in-memory ephemeris cache (500-entry FIFO)

---

## Completed ✓ — Phase 2 Accounts & Reading History

- [x] Landing / marketing page at `/` — hero, how-it-works, traditions grid, pricing section
- [x] Required Google sign-in — anonymous auth removed; `RequireAuth` guard on all wizard routes
- [x] Reading history UI — `HistoryPage` browses and reopens past readings from Firestore

---

## Completed ✓ — Phase 3 Privacy, Compliance & Monetization

- [x] Privacy policy — plain-language page at `/privacy`
- [x] Data consent form — opt-in page at `/consent`, GDPR/CCPA compliant
- [x] Paid tier (Stripe) — `UpgradePage`, checkout/portal routes, `useSubscription` hook
- [x] Plan enforcement — free tier locked to Classic + 7 readings/month server-side; non-Classic traditions show Paid badge

---

## Completed ✓ — Phase 1 Horary Engine

- [x] Aspects — applying / separating, orbs, perfection
- [x] Essential dignities — all five levels plus detriment / fall
- [x] Reception — mutual and one-way
- [x] Combustion & Under the Sun's Beams
- [x] Void of Course Moon
- [x] Via Combusta explicit flag
- [x] Collection of light
- [x] Translation of light
- [x] Prohibition
- [x] Refranation
- [x] Strictures against judgment — early/late ASC, Saturn in 1st/7th (display + AI prompt)
- [x] Lot of Fortune — wheel glyph, data row, AI prompt
- [x] Part of Spirit — wheel glyph, AI prompt
- [x] North Node on wheel
- [x] Fixed stars — Regulus, Spica, Algol, Antares (display + AI prompt)
- [x] Hayz — calculated and injected into AI prompt
- [x] Almuten of Ascendant — calculated and injected into AI prompt
- [x] Sect identification — day/night chart, in-sect/out-of-sect planet lists in AI prompt
- [x] Out-of-sign aspects — flagged distinctly in display
- [x] Antiscia and contra-antiscia — calculated, displayed in Chart Notes, toggle in ChartCustomizeModal
- [x] Aspect lines in the wheel — conjunction / trine / sextile / square / opposition
- [x] Degree tick marks on wheel — 5° intervals on outer ring
- [x] Moon phase indicator — SVG phase shape in wheel hub
- [x] Planet tooltips — tap/click a planet glyph for sign, degree, house, speed
- [x] Timing estimate — orb → days/weeks/months by sign mode (display + AI prompt)
- [x] Moon's last / next aspect — explicit row in Chart Notes with time estimates
- [x] Pre-calculated findings in AI prompt — strictures, sect, hayz, almuten, Via Combusta, VOC, refranation, fixed stars
- [x] SharedReadingPage respects chartPrefs — public view honors display toggles
- [x] Transit overlay — custom-date transits in blue outer ring
- [x] Five interpretive traditions with tradition-specific AI prompts
- [x] House signification interview
- [x] Follow-up chat
- [x] Journal / outcome tracking
- [x] ChartCustomizeModal — per-element display toggles
- [x] Reading history (Firebase)
- [x] Sharing (public read-only link)
