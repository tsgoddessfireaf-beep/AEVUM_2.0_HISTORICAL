# Aevum — Progress Report
*Generated 2026-05-21*

---

## Status

**Phases 1, 2, and 3: COMPLETE**

The horary engine is practitioner-grade. Accounts are required. Stripe monetization is live and enforced server-side.

| Metric | Value |
|---|---|
| Test files | 15 |
| Tests passing | 188 / 188 |
| Last commit | `e9ffddd` — Phase 3: Stripe paid tier, plan enforcement, upgrade UX |
| Phases complete | 1, 2, 3 |
| Phases remaining | 4 (infrastructure), 5 (launch polish) |

---

## Recent Commits

| Hash | Description |
|---|---|
| `e9ffddd` | Phase 3: Stripe paid tier, plan enforcement, upgrade UX |
| `48a50e9` | Require Google sign-in — remove anonymous auth |
| `46c1621` | Add landing / marketing page at / |
| `2bf3c20` | Complete Phase 1 horary engine: strictures, sect, antiscia, wheel polish |
| `5383e41` | P3 horary depth: sect/hayz, almuten, Part of Spirit, out-of-sign aspects |

---

## What's Complete

### Phase 1 — Horary Engine (all done)

**Chart mechanics — displayed in Chart Notes and wheel:**
- Aspects (applying/separating, orbs, perfection)
- Essential dignities (domicile, exaltation, triplicity, term, face, detriment, fall)
- Reception (mutual and one-way)
- Combustion and Under the Sun's Beams
- Void of Course Moon
- Via Combusta explicit flag (Moon 15° Libra – 15° Scorpio)
- Collection and translation of light
- Prohibition and refranation
- Strictures against judgment (early/late ASC, Saturn in 1st/7th)
- Fixed stars (Regulus, Spica, Algol, Antares — within 1°)
- Hayz, Almuten of Ascendant, Part of Spirit, Lot of Fortune
- Antiscia and contra-antiscia (1.5° default orb)
- Out-of-sign aspects (flagged distinctly)

**Wheel display:**
- Aspect lines, degree tick marks, moon phase indicator
- Planet tooltips (tap/click → sign, degree, house, daily speed)
- Transit overlay (custom-date transits in blue outer ring)
- North Node and Lot of Fortune glyphs

**AI prompt:**
- Pre-computed findings block injected directly — strictures, sect, hayz, almuten, Via Combusta, VOC, refranation, fixed stars, timing
- Five interpretive traditions: Classic, William Lilly, Guido Bonatti, Medieval Arabic, Dorotheus of Sidon

**Infrastructure:**
- Five-step reading wizard
- Firebase/Firestore reading persistence
- Public sharing (SharedReadingPage, honors all chartPrefs toggles)
- ChartCustomizeModal with per-element display toggles
- Journal / outcome tracking, reading history

### Phase 2 — Accounts & Reading History (all done)

- **Landing page** at `/` — hero, how-it-works, traditions grid, pricing section, sign-up CTA
- **Required Google sign-in** — `RequireAuth` guard wraps all wizard routes; anonymous auth fully removed
- **Reading history UI** — `HistoryPage` browses and reopens past readings from Firestore, with verdict badges and date display

### Phase 3 — Privacy, Compliance & Monetization (all done)

- **Privacy policy** — plain-language page at `/privacy`
- **Data consent form** — opt-in page at `/consent`, GDPR/CCPA compliant
- **Stripe paid tier** — `UpgradePage`, checkout session + billing portal routes, webhook, `useSubscription` hook
- **Plan enforcement** — free tier locked to Classic tradition + 7 readings/month, enforced server-side via Firebase token verification; non-Classic traditions show Paid badge in UI

---

## What's Next

### Phase 4 — Production Infrastructure

1. **CI/CD** — GitHub Actions: full test suite on every push, block merges on failure, auto-deploy to production on main.

2. **Error Monitoring** — Sentry (or equivalent) for client + server exceptions. Alerts on API failures, ephemeris errors, Firebase write failures.

3. **Rate Limiting & Cost Controls** — enforce reading quotas server-side. Graceful degradation when Claude API is slow or unavailable.

4. **Performance** — bundle audit, lazy-load heavy components, cache ephemeris responses for identical date/time/location.

### Phase 5 — Launch Ready

5. **Mobile Layout Pass** — wheel, chart notes, and reading sections optimized for small screens.

6. **First-Time User Onboarding** — brief guided intro after sign-up: what horary is, what makes a good question, what to expect.

7. **Empty / Error States** — every failure (no location, API down, bad date, quota hit) has a friendly, actionable message.

8. **PDF / Print Export** — clean print stylesheet or downloadable PDF for practitioners who file readings on paper.

---

## The Finish Line

| Milestone | Signal |
|---|---|
| Phase 1 ✓ | Every engine item in TODO.md checked off; 188 tests passing |
| Phase 2 ✓ | Anonymous access removed; account required; reading history works |
| Phase 3 ✓ | Privacy policy live; Stripe payments processing; traditions locked for free tier |
| Phase 4 | 30 days in production with no silent failures; costs predictable |
| Phase 5 | A stranger who knows nothing about horary can land, sign up, cast a reading, and save it |
