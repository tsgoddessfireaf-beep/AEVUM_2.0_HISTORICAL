// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Reading package helpers — the premium client deliverable for booked readings:
// 8 teaching slides generated from the completed reading, narrated in the
// practitioner's own recorded voice, delivered via the public share link.

import { getIdToken } from './firebase.js';

/**
 * Returns true when the signed-in user is the practitioner (may generate
 * slides and record narration). Configured via VITE_PRACTITIONER_EMAILS,
 * a comma-separated list of Google account emails.
 * @param {import('firebase/auth').User|null} user
 * @returns {boolean}
 */
export function isPractitioner(user) {
  if (import.meta.env.DEV) return true;
  if (!user?.email) return false;
  const allowed = (import.meta.env.VITE_PRACTITIONER_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}

/**
 * Calls the server to generate the 8-slide teaching deck for a completed reading.
 * @param {{ question: string, houseSignifications: Object, ephemerisData: Object,
 *           analysis: string, tradition?: string }} payload
 * @returns {Promise<Array<{kind: string, kicker: string, title: string,
 *           body: string[], teach: string, script: string}>>}
 * @throws {Error} with a user-friendly message on failure.
 */
export async function generateSlides(payload) {
  const idToken = await getIdToken();
  const res = await fetch('/api/chat/slides', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not generate slides. Please try again.');
  return data.slides;
}

/**
 * Picks the best supported MediaRecorder audio mime type for this browser.
 * Chrome/Firefox → webm/opus; Safari → mp4 (AAC).
 * @returns {string|undefined} mime type, or undefined to let the browser choose.
 */
export function pickAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find(t => MediaRecorder.isTypeSupported(t));
}
