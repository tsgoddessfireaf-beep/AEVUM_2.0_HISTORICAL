// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { loadUserProfile, FIREBASE_ENABLED } from '../lib/firebase.js';
import { useAuthState } from './useAuthState.js';

/**
 * Returns the current user's subscription plan from their Firestore profile.
 * Defaults to 'free' when Firebase is unavailable or the field is absent.
 *
 * @returns {{ plan: 'free'|'paid', isPaid: boolean, loading: boolean }}
 */
export function useSubscription() {
  const { user, isGoogle } = useAuthState();
  const [plan, setPlan]       = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGoogle || !FIREBASE_ENABLED) {
      setPlan('paid'); // Granted for beta test
      setLoading(false);
      return;
    }
    setLoading(true);
    loadUserProfile()
      .then((profile) => { setPlan('paid'); }) // Forced paid for beta
      .catch(() => { setPlan('paid'); })
      .finally(() => setLoading(false));
  }, [isGoogle, user?.uid]);

  return { plan, isPaid: plan === 'paid', loading };
}
