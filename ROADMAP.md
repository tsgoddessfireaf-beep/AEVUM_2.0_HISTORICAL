# Aevum — Product Roadmap

## Monetization & Access Model

| Tier | Readings | Traditions | Library |
|---|---|---|---|
| Free (account required) | 7 / month | Classic only | No |
| Paid | Unlimited | All 5 | Yes |
| Data opt-in (any tier) | Voluntary — earns a small reward, never gates access | | |

- No anonymous use — account required before the app is usable
- Traditions (Lilly, Bonatti, Arabic, Dorotheus) are the paid differentiator
- Data consent is genuinely voluntary, never tied to feature access (GDPR/CCPA safe)

---

## Phase 1 — Complete the Horary Engine
*Finish what's in TODO.md*

**P1 — First things a reader checks:**
- [ ] Strictures against judgment (early/late ASC, Saturn in 1st/7th)
- [ ] Aspect lines in the wheel ← **in progress**
- [ ] Timing estimate (orb → days/weeks/months)
- [ ] Moon's last / next aspect display

**P2 — Core mechanics completeness:**
- [ ] Refranation
- [ ] Via Combusta explicit flag
- [ ] Pre-calculated findings injected into AI prompt
- [ ] Fixed stars (Regulus, Spica, Algol)

**P3 — Depth of testimony:**
- [ ] Hayz, Almuten, Part of Spirit, Sect identification, Out-of-sign aspects

**P4 — Polish:**
- [ ] SharedReadingPage respects chartPrefs
- [ ] Antiscia, planet tooltips, degree ticks, moon phase indicator

**Outcome:** A practitioner-grade horary engine. Every major classical technique
is detected, displayed, and communicated to the AI.

---

## Phase 2 — Landing Page & Account Wall ✓
*Complete*

- [x] Landing / marketing page — explains Aevum, shows example reading, sign-up CTA
- [x] Required accounts — anonymous auth removed; Google sign-in required; 7-reading/month limit enforced server-side
- [x] Reading history UI — browse, search, reopen past readings from Firestore

**Outcome:** Every user has an identity. No anonymous state. Readings are always owned.

---

## Phase 3 — Privacy, Compliance & Monetization ✓
*Complete*

- [x] Privacy policy — plain-language page at /privacy
- [x] Data consent form — voluntary opt-in at /consent, GDPR/CCPA compliant
- [x] Paid tier (Stripe) — unlimited readings + all 5 traditions; tradition picker shows lock icon for free users; plan enforced server-side

**Outcome:** Legally sound. Revenue model is live.

---

## Phase 4 — Production Infrastructure

- [ ] CI/CD — GitHub Actions running full test suite on every push; auto-deploy on main
- [ ] Error monitoring — Sentry for client + server exceptions
- [ ] Rate limiting & cost controls — enforce reading quotas server-side; graceful degradation
- [ ] Performance — bundle audit, lazy-load heavy components, cache ephemeris responses

**Outcome:** The app doesn't go down or run up surprise bills.

---

## Phase 5 — Launch Ready

- [ ] Mobile layout pass — wheel, chart notes, and reading sections fully optimized
- [ ] First-time user onboarding — guided intro after sign-up
- [ ] Empty / error states — every failure has a friendly, actionable message
- [ ] PDF / print export — clean print stylesheet for practitioners

**Outcome:** A stranger can land, understand, sign up, cast a reading, and save it.

---

## Finish Line

| Milestone | Signal |
|---|---|
| Phase 1 | Every TODO.md item checked off; 111+ tests passing |
| Phase 2 | Anonymous access removed; account required; reading history works |
| Phase 3 | Privacy policy live; Stripe processing; traditions locked for free tier |
| Phase 4 | 30 days in production with no silent failures; costs predictable |
| Phase 5 | A stranger who knows nothing about horary can land, sign up, cast a reading, and save it |

---

## Completed ✓

**Phase 2 & 3**
- [x] Landing / marketing page at `/`
- [x] Required Google sign-in — `RequireAuth` guard, no anonymous access
- [x] Reading history UI — `HistoryPage` with Firestore browse + reopen
- [x] Privacy policy at `/privacy`
- [x] Data consent form at `/consent`
- [x] Stripe paid tier — checkout, portal, webhook, `useSubscription` hook
- [x] Plan enforcement — Classic-only + 7/month for free; non-Classic locked with Paid badge

**Phase 1 Horary Engine**
- [x] Aspects — applying / separating, orbs, perfection
- [x] Essential dignities — all five levels plus detriment / fall
- [x] Reception — mutual and one-way
- [x] Combustion & Under the Sun's Beams
- [x] Void of Course Moon
- [x] Collection of light
- [x] Translation of light
- [x] Prohibition
- [x] Lot of Fortune — wheel glyph, data row, AI prompt
- [x] North Node on wheel
- [x] Transit overlay — custom-date transits in blue outer ring
- [x] Five interpretive traditions with tradition-specific AI prompts
- [x] House signification interview
- [x] Follow-up chat
- [x] Journal / outcome tracking
- [x] ChartCustomizeModal — per-element display toggles
- [x] Reading history (Firebase)
- [x] Sharing (public read-only link)
