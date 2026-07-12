// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Base URL for the Aevum API (the `api` Cloud Function).
//
// In production the browser calls the Cloud Function's DIRECT URL instead of
// the relative /api path. Relative /api routes through Firebase Hosting's
// rewrite, which buffers responses and hard-caps them at ~60s — that truncates
// the long Server-Sent-Events judgment stream, so the reading never renders.
// Hitting the function directly (540s timeout, kept warm) streams reliably.
// CORS on the function already allows the app's origins.
//
// The function is named `api` and its Express app also mounts every route
// under /api, so the base ends in /api and request paths keep their /api
// prefix (base + /api/chat/analyze -> .../api/api/chat/analyze, which the app
// resolves to /api/chat/analyze). Empty base in dev falls back to the Vite proxy.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return BASE ? `${BASE}${p}` : p;
}
