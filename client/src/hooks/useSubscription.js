// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { loadUserProfile, FIREBASE_ENABLED } from '../lib/firebase.js';
import { useAuthState } from './useAuthState.js';

/**
 * Returns the current user's subscription plan from their Firestore profile
 * (`users/{uid}.plan`, set by the Stripe webhook on successful subscription
 * checkout — see functions/routes/stripe.js `setUserPlan`).
 * Defaults to 'free' when signed out, Firebase is unavailable, or the field
 * is absent — i.e. fails closed, unpaid users do not get paid features.
 *
 * @returns {{ plan: 'free'|'paid', isPaid: boolean, loading: boolean }}
 */
export function useSubscription() {
  const { user, isGoogle } = useAuthState();
  const [plan, setPlan]       = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGoogle || !FIREBASE_ENABLED) {
      setPlan('free');
      setLoading(false);
      return;
    }
    setLoading(true);
    loadUserProfile()
      .then((profile) => { setPlan(profile?.plan === 'paid' ? 'paid' : 'free'); })
      .catch(() => { setPlan('free'); })
      .finally(() => setLoading(false));
  }, [isGoogle, user?.uid]);

  return { plan, isPaid: plan === 'paid', loading };
}
