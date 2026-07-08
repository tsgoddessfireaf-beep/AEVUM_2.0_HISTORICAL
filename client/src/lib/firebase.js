// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Firebase init + Firestore helpers for the Aevum readings database.
//
// SETUP (one-time):
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Add a Web App, copy the config values
//   3. Enable Firestore (test mode is fine for personal use)
//   4. Enable Anonymous Authentication and Google in Auth → Sign-in methods
//   5. Update Firestore Rules to use request.auth.uid (see firestore.rules)
//   6. Paste the config into client/.env.local (see .env.local.example)
//   7. Add app.aeonicarts.com to Auth → Settings → Authorized domains
//
// ON APP LOAD:
//   Call initAuth() to subscribe to auth state. Google sign-in is required
//   before any reading can be cast — anonymous access is not supported.
//
// If env vars are missing, every helper becomes a no-op that logs a warning.
// The app keeps working — readings just aren't persisted.

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, updateDoc, setDoc,
  arrayUnion, serverTimestamp, getDoc,
  query, where, orderBy, getDocs, connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getAuth, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  signInWithCredential, signOut, connectAuthEmulator,
} from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, connectStorageEmulator } from 'firebase/storage';

const config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const FIREBASE_ENABLED = Boolean(config.apiKey && config.projectId);

let db = null;
let auth = null;
let storage = null;

if (FIREBASE_ENABLED) {
  try {
    const app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    if (config.storageBucket) storage = getStorage(app);


  } catch (err) {
    console.warn('[firebase] init failed:', err.message);
  }
} else {
  console.info('[firebase] disabled — set VITE_FIREBASE_* env vars in client/.env.local to enable persistence');
}

/**
 * Initialises Firebase auth. No-ops if auth isn't available.
 * Call once on app mount to ensure the auth state listener is active.
 */
export function initAuth() {
  // Auth state is managed via onAuthChange / useAuthState.
  // Nothing to do here — Firebase restores the persisted session automatically.
}

/**
 * Returns a fresh Firebase ID token for the current user, suitable for
 * the Authorization: Bearer header on API requests.
 * @returns {Promise<string|null>}
 */
export async function getIdToken() {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Returns the uid of the currently signed-in user (anonymous or Google).
 * @returns {string|null} The uid, or null if no user is authenticated.
 */
export function getCurrentUserId() {
  if (!auth || !auth.currentUser) {
    console.warn('[firebase] user not authenticated');
    return null;
  }
  return auth.currentUser.uid;
}

/**
 * Subscribes to Firebase auth state changes.
 * @param {(user: import('firebase/auth').User|null) => void} callback
 * @returns {() => void} Unsubscribe function.
 */
export function onAuthChange(callback) {
  if (!auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}

/**
 * Upgrades the current anonymous session to a Google account.
 * If the user is anonymous, links the anonymous uid to Google so all existing
 * Firestore readings are preserved under the same uid.
 * If the Google account already has its own Firebase uid, signs in as that
 * account instead (the prior anonymous readings are left behind).
 *
 * @returns {Promise<{ user?: Object, wasLinked?: boolean, cancelled?: boolean, error?: string }>}
 */
export async function signInWithGoogle() {
  if (!auth) return { error: 'auth not initialized' };
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user };
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') {
      return { cancelled: true };
    }
    if (err.code === 'auth/credential-already-in-use') {
      try {
        const credential = GoogleAuthProvider.credentialFromError(err);
        const result = await signInWithCredential(auth, credential);
        return { user: result.user };
      } catch (inner) {
        return { error: inner.message };
      }
    }
    return { error: err.message };
  }
}

/**
 * Signs out the current user. The RequireAuth guard will show the sign-in
 * wall on the next protected route render.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[firebase] signOutUser failed:', err.message);
  }
}

const READINGS = 'readings';
const USERS    = 'users';
const DRAFTS   = 'hora_reading_drafts';

/** Bump this whenever the consent text changes — stored alongside each user's agreement. */
export const CURRENT_CONSENT_VERSION = '1.0';

/**
 * Persists a new reading document to Firestore under the current user's uid.
 * @param {Object} payload - Reading data to store (question, ephemeris, analysis, etc.).
 * @returns {Promise<string|null>} The new document id, or null on failure.
 */
export async function saveReading(payload) {
  if (!db) return null;
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('[firebase] cannot save — user not authenticated');
    return null;
  }
  try {
    const ref = await addDoc(collection(db, READINGS), {
      userId,
      createdAt: serverTimestamp(),
      followUpMessages: [],
      journal: null,
      ...payload,
    });
    return ref.id;
  } catch (err) {
    console.warn('[firebase] saveReading failed:', err.message);
    return null;
  }
}

/**
 * Appends a single follow-up chat turn to an existing reading's message array.
 * @param {string} readingId - Firestore document id of the reading.
 * @param {{role: string, content: string}} turn - The message to append.
 * @returns {Promise<void>}
 */
export async function appendFollowUp(readingId, turn) {
  if (!db || !readingId) return;
  try {
    await updateDoc(doc(db, READINGS, readingId), {
      followUpMessages: arrayUnion({ ...turn, ts: Date.now() }),
    });
  } catch (err) {
    console.warn('[firebase] appendFollowUp failed:', err.message);
  }
}

/**
 * Overwrites the journal entry on an existing reading.
 * @param {string} readingId - Firestore document id of the reading.
 * @param {{notes: string, outcome: string, accuracyRating: number, outcomeNotes: string}} journal
 * @returns {Promise<void>}
 */
export async function updateJournal(readingId, journal) {
  if (!db || !readingId) return;
  try {
    await updateDoc(doc(db, READINGS, readingId), {
      journal: { ...journal, updatedAt: Date.now() },
    });
  } catch (err) {
    console.warn('[firebase] updateJournal failed:', err.message);
  }
}

/**
 * Fetches all readings for the current user, newest first.
 * @returns {Promise<Array<Object>>} Array of reading documents with their ids, or [] on failure.
 */
export async function loadUserReadings() {
  if (!db) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  try {
    const q = query(
      collection(db, READINGS),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[firebase] loadUserReadings failed:', err.message);
    return [];
  }
}

// ─── In-progress reading draft (replaces localStorage as source of truth) ────
//
// One document per user, id = uid, in the `hora_reading_drafts` collection. Saved on every
// wizard step transition (question, date/time, interview messages, house
// significations) so a session can never be silently corrupted or lost in
// browser storage the way the old localStorage-only session was.

/**
 * Overwrites the current user's draft document with the given fields (merged).
 * No-ops silently if Firebase isn't configured or the user isn't signed in —
 * callers should treat this as best-effort and keep local state as the
 * immediate source of truth for rendering.
 * @param {Object} fields - Any subset of the draft shape to merge in.
 * @returns {Promise<void>}
 */
export async function saveDraft(fields) {
  if (!db) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await setDoc(
      doc(db, DRAFTS, userId),
      { ...fields, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn('[firebase] saveDraft failed:', err.message);
  }
}

/**
 * Fetches the current user's in-progress draft, if any.
 * @returns {Promise<Object|null>}
 */
export async function loadDraft() {
  if (!db) return null;
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, DRAFTS, userId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('[firebase] loadDraft failed:', err.message);
    return null;
  }
}

/**
 * Clears the current user's draft — called when starting a new question or
 * once a reading completes and is saved to the `readings` collection.
 * @returns {Promise<void>}
 */
export async function clearDraft() {
  if (!db) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await setDoc(doc(db, DRAFTS, userId), {
      question: '', questionType: null, interviewMessages: [],
      houseSignifications: null, ephemerisData: null, analysis: '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[firebase] clearDraft failed:', err.message);
  }
}

// ─── User profile (consent + preferences) ────────────────────────────────────

/**
 * Fetches the current user's profile document from the `users` collection.
 * The document id is the user's uid.
 * @returns {Promise<Object|null>} Profile data, or null if not found / unavailable.
 */
export async function loadUserProfile() {
  if (!db) return null;
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, USERS, userId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('[firebase] loadUserProfile failed:', err.message);
    return null;
  }
}

/**
 * Creates or updates the user's consent record.
 * Sets `consent_timestamp` to now, `consent_version` to CURRENT_CONSENT_VERSION,
 * and stores the provided preferences map in `preferences_json`.
 *
 * @param {{ allow_training_data?: boolean, [key: string]: boolean }} preferences
 * @returns {Promise<void>}
 */
export async function saveUserConsent(preferences = {}) {
  if (!db) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    await setDoc(
      doc(db, USERS, userId),
      {
        consent_timestamp: serverTimestamp(),
        consent_version:   CURRENT_CONSENT_VERSION,
        preferences_json:  preferences,
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[firebase] saveUserConsent failed:', err.message);
  }
}

/**
 * Merges updated preference flags into `preferences_json` without touching consent fields.
 * @param {{ [key: string]: boolean }} updates - Keys to set or overwrite.
 * @returns {Promise<void>}
 */
export async function updateUserPreferences(updates = {}) {
  if (!db) return;
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    // Dot-notation keys let Firestore merge individual preference flags
    const dotted = Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [`preferences_json.${k}`, v]),
    );
    await updateDoc(doc(db, USERS, userId), dotted);
  } catch (err) {
    console.warn('[firebase] updateUserPreferences failed:', err.message);
  }
}

/**
 * Returns true if the current user has an active consent record on file.
 * @returns {Promise<boolean>}
 */
export async function hasConsented() {
  const profile = await loadUserProfile();
  return Boolean(profile?.consent_timestamp);
}

// ─── Readings ─────────────────────────────────────────────────────────────────

/**
 * Marks a reading as publicly shareable by setting isPublic = true.
 * After this call the document is readable by anyone with the reading id.
 * @param {string} readingId
 * @returns {Promise<boolean>} true on success.
 */
export async function shareReading(readingId) {
  if (!db || !readingId) return false;
  try {
    await updateDoc(doc(db, READINGS, readingId), { isPublic: true });
    return true;
  } catch (err) {
    console.warn('[firebase] shareReading failed:', err.message);
    return false;
  }
}

/**
 * Fetches a reading that has been marked public — no auth required.
 * Returns null if the document doesn't exist or is not public.
 * @param {string} readingId
 * @returns {Promise<Object|null>}
 */
export async function loadPublicReading(readingId) {
  if (!db || !readingId) return null;
  try {
    const snap = await getDoc(doc(db, READINGS, readingId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.isPublic) return null;
    return { id: snap.id, ...data };
  } catch (err) {
    console.warn('[firebase] loadPublicReading failed:', err.message);
    return null;
  }
}

// ─── Reading package (teaching slides + voice narration) ─────────────────────

/**
 * Uploads one slide's voice narration to Firebase Storage and returns a
 * playable download URL. Recordings live at users/{userId}/readings/{readingId}/slide-{n}.{ext}.
 * @param {string} readingId
 * @param {number} slideIndex - 0-based slide position.
 * @param {Blob} blob - Audio blob from MediaRecorder.
 * @returns {Promise<string|null>} Download URL, or null on failure.
 */
export async function uploadSlideAudio(readingId, slideIndex, blob) {
  if (!storage || !readingId || !blob) return null;
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('[firebase] uploadSlideAudio failed: user not authenticated');
    return null;
  }
  const ext = blob.type.includes('mp4') ? 'm4a'
            : blob.type.includes('ogg') ? 'ogg'
            : 'webm';
  try {
    const path = `users/${userId}/readings/${readingId}/slide-${slideIndex}.${ext}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, blob, { contentType: blob.type || 'audio/webm' });
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.warn('[firebase] uploadSlideAudio failed:', err.message);
    return null;
  }
}

/**
 * Fetches an astrology library text file directly from Firebase Storage.
 * @param {string} filename
 * @returns {Promise<string>}
 */
export async function fetchLibraryText(filename) {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }
  const fileRef = storageRef(storage, `library/${filename}`);
  const url = await getDownloadURL(fileRef);
  const res = await fetch(url);
  return await res.text();
}

/**
 * Merges reading-package fields (packageSlides, packageAudio, …) into an
 * existing reading document.
 * @param {string} readingId
 * @param {Object} fields - e.g. { packageSlides: [...] } or { ['packageAudio.3']: url }
 * @returns {Promise<boolean>} true on success.
 */
export async function saveReadingPackage(readingId, fields) {
  if (!db || !readingId) return false;
  try {
    await updateDoc(doc(db, READINGS, readingId), {
      ...fields,
      packageUpdatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('[firebase] saveReadingPackage failed:', err.message);
    return false;
  }
}

/**
 * Fetches a single reading document from Firestore by id.
 * @param {string} readingId - Firestore document id of the reading.
 * @returns {Promise<Object|null>} The reading data with its id, or null if not found.
 */
export async function loadReading(readingId) {
  if (!db || !readingId) return null;
  try {
    const snap = await getDoc(doc(db, READINGS, readingId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[firebase] loadReading failed:', err.message);
    return null;
  }
}
