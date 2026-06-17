// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { onAuthChange } from '../lib/firebase.js';

/**
 * Subscribes to Firebase auth state and returns the current user object.
 *
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   loading: boolean,
 *   isAnonymous: boolean,
 *   isGoogle: boolean,
 * }}
 */
export function useAuthState() {
  // undefined = still resolving; null = signed out; User = authenticated
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u ?? null));
    return unsub;
  }, []);

  return {
    user:        user ?? null,
    loading:     user === undefined,
    isAnonymous: Boolean(user?.isAnonymous),
    isGoogle:    Boolean(user && !user.isAnonymous),
  };
}
