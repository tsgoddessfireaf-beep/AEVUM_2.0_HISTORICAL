// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminDb   = null;
let adminAuth = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    adminDb   = getFirestore();
    adminAuth = getAuth();
    console.info('[firebase-admin] initialized — server-side auth enabled');
  } catch (e) {
    console.warn('[firebase-admin] init failed:', e.message);
  }
} else {
  console.info('[firebase-admin] disabled — set FIREBASE_SERVICE_ACCOUNT_JSON to enable server-side auth and quota enforcement');
}

export const ADMIN_ENABLED = Boolean(adminDb && adminAuth);

export async function verifyIdToken(token) {
  if (!adminAuth || !token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function getUserPlan(uid) {
  if (!adminDb) return 'free';
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    return snap.data()?.plan ?? 'free';
  } catch {
    return 'free';
  }
}

export async function setUserPlan(uid, plan, extra = {}) {
  if (!adminDb) return;
  try {
    await adminDb.collection('users').doc(uid).set({ plan, ...extra }, { merge: true });
  } catch (e) {
    console.warn('[firebase-admin] setUserPlan failed:', e.message);
  }
}

export async function findUserByStripeCustomer(customerId) {
  if (!adminDb) return null;
  try {
    const snap = await adminDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
  } catch {
    return null;
  }
}

export async function getUserData(uid) {
  if (!adminDb) return null;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    return snap.data() ?? null;
  } catch {
    return null;
  }
}

export async function getMonthlyReadingCount(uid) {
  if (!adminDb) return 0;
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const snap = await adminDb.collection('readings')
      .where('userId', '==', uid)
      .where('createdAt', '>=', startOfMonth)
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}
