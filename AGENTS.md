# AGENTS.md — Instructions for Automated Agents (Jules / Sentinel / CI bots)

This file governs how autonomous coding agents operate on the Aevum repository.
**Read this in full before opening any branch, PR, or commit.** Human-authored
guidance here overrides any default agent behavior.

---

## 1. Accurate stack parameters (do not reason from stale assumptions)

| Concern | Reality — use these, not guesses |
|---|---|
| LLM provider | **Anthropic (Claude)** via `@anthropic-ai/sdk`. Env var: `ANTHROPIC_API_KEY`. |
| Models | Interview: `claude-haiku-4-5-20251001`. Analysis: `claude-sonnet-4-6`. |
| NOT used | This app does **not** use Groq, Gemini, OpenAI, or any other LLM provider. Any reference to those is wrong — correct it. |
| Hosting | Firebase (Hosting & Functions). |
| Auth | Firebase Admin. Server-side checks gate on `ADMIN_ENABLED` (true when `FIREBASE_SERVICE_ACCOUNT_JSON` is set). |
| Payments | Stripe, **single-use $88 booking product only** — no subscriptions/quotas. |
| Ephemeris | Local Python sidecar using **pyswisseph** (Swiss Ephemeris). `flatlib` is **removed** — do not reintroduce it. |
| Email | Resend. User-controlled input in HTML emails must be escaped via the existing `escapeHtml` in `functions/routes/booking.js`. |

If you find code or a log that contradicts this table, the code/log is stale —
fix it to match reality, don't propagate the error.

## 2. Required workflow before opening a branch (prevents duplicate storms)

The 2026-06-14 incident: ~36 redundant branches were opened re-fixing issues
already on `main`; two duplicate `escapeHtml` definitions collided and crashed
production. Do not repeat this. Before creating ANY branch:

1. **Check if it's already fixed.** Grep `main` for the symbol, config, or route
   you intend to touch (e.g. `escapeHtml`, `trust proxy`, `verifyIdToken`,
   `x-powered-by`). If present and correct → **do nothing, do not open a branch.**
2. **One issue → at most one open branch.** Search existing open branches/PRs for
   the same fix before creating another. Never open a second branch for an issue
   that already has one.
3. **Never redeclare an existing top-level identifier** (function, const, import).
   Read the full target file first; add to it, don't blindly prepend a new copy.
4. **Verify the build before pushing.** `npm run install:all && npm run build`
   and a server boot (`node server/index.js`) must succeed. A change that fails
   to start the server must never be pushed.

## 3. Scope and behavior

- **Suggest-first.** Prefer leaving findings as review comments or entries in
  `.jules/sentinel.md` over auto-opening PRs. Open a branch only for a confirmed,
  not-yet-fixed, build-verified change.
- **No churn PRs.** Do not open branches that only add tests for already-covered
  code, restate an existing fix, or touch `package-lock.json` alone.
- **Stay in your lane.** Security/correctness fixes only. Do not refactor product
  features, change the LLM provider, alter pricing logic, or rewrite the ephemeris
  service without an explicit human request.
- **Log learnings, not noise.** Real findings go in `.jules/sentinel.md` with
  Vulnerability / Learning / Prevention. Mark items resolved once merged.

## 4. Project facts worth knowing

- Monorepo: `functions/` (Express, ESM), `client/` (React + Vite), `ephemeris-service/` (Python FastAPI).
- See `CLAUDE.md` and `ARCHITECTURE.md` for the full architecture and data flow.
- Tests: `functions/` uses vitest; client uses vitest + jsdom. CI gate is `.github/workflows/ci.yml`.
- Default branch is `main`; production deploys via Firebase Cloud Functions.

## 5. Premium UI & Design Guidelines

**CRITICAL RULE:** Do NOT use flat, basic, or generic utilitarian designs. All UI components must adhere to the established "premium magical" Aevum aesthetic.

- **Glassmorphism:** Use semi-transparent dark backgrounds (e.g., `bg-teal-950/40`), heavy blurring (`backdrop-blur-md`), and subtle translucent borders (`border-teal-800/30`) for containers and panels (use `.glass-panel` in index.css).
- **Typography:** 
  - ALWAYS use **Playfair Display** (`font-serif`) for headers, titles, and elegant text.
  - ALWAYS use **Inter** (`font-sans`) for highly legible body copy and UI elements.
  - Do NOT use Orbitron, Lato, or basic web-safe fonts unless explicitly requested.
- **Color Palette:** Rely heavily on the deep teal/obsidian backdrop, with glowing copper/gold (`#D17C49`, `text-copper-400`) for accents, borders, icons, and active states. Use `text-bone` or `text-silver` for readable text.
- **Lighting & Glow Effects:** Use drop shadows, SVG filters (`feGaussianBlur`, `feDropShadow`), and radial gradients to create luminous, magical glowing effects, especially for charts, active UI states, and the background environment.

## 6. Progress Tracking

**CRITICAL RULE:** For every action or task you are instructed to do, you MUST build and maintain a progress dashboard (e.g. a markdown artifact like `task.md` or `progress_dashboard.md`). You must provide feedback from the system on your progress towards completion at regular, frequent intervals (e.g. every ~15 seconds of execution) by updating this dashboard or logging progress, ensuring the user has real-time visibility into your execution status.
