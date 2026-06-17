// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { getIdToken } from './firebase.js';

async function authHeaders() {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function redirectToCheckout() {
  const res = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || 'Failed to start checkout.');
  }
  const { url } = await res.json();
  window.location.href = url;
}

// Public booking checkout — no auth required. Question is sent to the server which
// creates a one-time Stripe session. Keys never touch the browser.
export async function redirectToBookingCheckout(question) {
  const res = await fetch('/api/booking/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || 'Failed to start booking.');
  }
  const { url } = await res.json();
  window.location.href = url;
}

export async function redirectToPortal() {
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || 'Failed to open billing portal.');
  }
  const { url } = await res.json();
  window.location.href = url;
}
