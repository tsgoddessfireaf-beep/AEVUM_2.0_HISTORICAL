# Sentinel Security Log

> **Status (2026-06-14):** Every vulnerability logged below has been remediated and the fix is live on `main`. This file is a historical audit trail — do NOT open new branches/PRs for these items; they are closed. Before filing any new finding, confirm against current `main` that the issue is not already fixed (see `AGENTS.md` for the required workflow).

## 2026-06-14 - Duplicate-Fix Branch Storm (process failure, not a vulnerability)
**Vulnerability:** None. This entry records a workflow failure. Automated runs opened ~36 branches re-fixing issues already merged to `main` (9× trust-proxy, 4× auth-bypass, ~15× test additions). Two duplicate `escapeHtml` definitions from separate branches were both merged into `server/routes/booking.js`, producing `SyntaxError: Identifier 'escapeHtml' has already been declared` that crashed the production server on startup.
**Learning:** Re-filing a fix that is already on `main` is not harmless — when two duplicates land, they can collide and break the build. The cost of a redundant PR is not zero.
**Prevention:** Before creating any branch, grep `main` for the symbol/config you intend to add (e.g. `escapeHtml`, `trust proxy`, `verifyIdToken`) and skip if already present. One issue → at most one open branch. Never redeclare an existing top-level identifier. See `AGENTS.md`.

## 2024-05-24 - Fail-Open Authorization Bypass
**Vulnerability:** The `/api/chat/analyze` endpoint checked for quota limits only if `decoded` was truthy, allowing requests with missing or invalid tokens to bypass quota limits completely.
**Learning:** Missing authentication checks or failing to handle null decoded tokens leads to a "fail-open" scenario, granting unauthenticated users unintended access.
**Prevention:** Always implement a "fail-closed" approach: explicitly reject requests with `401 Unauthorized` if the token is missing or invalid before proceeding to quota or permission checks.

## 2026-05-25 - DOMPurify Functional Regression
**Vulnerability:** Not a security vulnerability, but an attempted security fix using DOMPurify removed valid user input instead of safely escaping it.
**Learning:** When text input needs to be rendered, replacing manual escaping (e.g., `<` to `&lt;`) with DOMPurify can cause functional regressions by silently stripping tags like `<script>` or `<div>`, losing the original user input in chat interfaces.
**Prevention:** Retain explicit HTML escaping when the intent is to safely display text that may look like HTML, rather than completely stripping it.
## 2024-05-26 - Host Header Injection in Stripe URLs
**Vulnerability:** Direct usages of `req.headers.origin` were being used to construct sensitive URLs (`success_url`, `cancel_url`, `return_url`) in `server/routes/stripe.js`. An attacker could spoof the `Origin` header to redirect victims to malicious sites after successful Stripe checkouts.
**Learning:** Relying on user-controlled input like `req.headers.origin` for sensitive redirects creates an open redirect or host header injection vulnerability, especially in environments where the host header isn't strictly validated at the proxy level.
**Prevention:** Construct fully qualified URLs using known safe values, such as an environment variable (e.g., `process.env.CLIENT_URL`) or hardcode the expected frontend production URL depending on the `NODE_ENV`. Fallback to local URLs like `localhost:3000` is acceptable only in non-production environments.

## 2026-05-28 - Missing Authentication on Protected Anthropic Streaming Endpoint
**Vulnerability:** The `/api/chat/house-signification` SSE endpoint lacked the `ADMIN_ENABLED` / `verifyIdToken` check present in sibling endpoints like `/analyze`. Because the API key is tied to a paid Anthropic (Claude) service, the omission created an open unauthenticated proxy, exposing the application to abuse and unauthorized billing costs.
**Learning:** SSE endpoints are often added later or follow a different pattern than standard REST JSON routes, making them prone to skipped middleware or auth checks. Furthermore, ensuring that `req.headers.authorization?.replace('Bearer ', '')` fails securely when the header is missing requires the token verification logic to cleanly handle `undefined` inputs.
**Prevention:** Unify authentication logic in Express middleware rather than handling it inline in every route to prevent omission in new or streaming routes. Ensure helper functions like `verifyIdToken` gracefully handle undefined tokens. Always perform explicit fail-closed authorization checks on all LLM proxy routes.

## 2024-06-11 - Missing Express Security Headers and Proxy Trust
**Vulnerability:** The Express server did not disable the `X-Powered-By` header, potentially leaking technology stack details. Also, the IP rate limiter (`express-rate-limit`) lacked a `trust proxy` configuration in production, meaning requests passing through reverse proxies (like Render) would all share the same proxy IP, bypassing per-client rate limits and potentially causing a Denial of Service.
**Learning:** Security defaults in basic Express configurations are often insufficient for production. Reverse proxy environments require explicit `trust proxy` directives for middleware relying on client IPs to work correctly.
**Prevention:** Always use `app.disable('x-powered-by')` or security middleware like Helmet to hide stack details. Ensure `app.set('trust proxy', 1)` is explicitly configured when relying on IP-based tracking (like rate limiters) in production deployments behind a reverse proxy.
## 2024-06-13 - Resend HTML Injection / XSS
**Vulnerability:** The `/api/booking/confirm` route interpolated user-controlled input (`session.metadata?.question`) directly into an HTML email payload using template literals.
**Learning:** Trusting data coming from external webhooks or payment metadata as "safe" is dangerous. Attackers can inject malicious HTML or scripts into inputs that eventually render in admin panels or user emails.
**Prevention:** Always sanitize or safely escape user input before placing it into HTML contexts, even when using modern email delivery services like Resend.
