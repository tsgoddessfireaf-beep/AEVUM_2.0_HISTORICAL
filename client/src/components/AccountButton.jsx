// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState } from 'react';
import { signInWithGoogle, signOutUser } from '../lib/firebase.js';
import { useAuthState } from '../hooks/useAuthState.js';
import useAppStore from '../store/useAppStore.js';

/** Google "G" logo — meets Google's branding requirements for sign-in buttons. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/**
 * Displays authentication state and lets the user sign in with Google or sign out.
 *
 * Anonymous users see a "Sign in with Google" button.
 * Google users see their avatar (or initial) and a sign-out option.
 *
 * @param {{ compact?: boolean }} props
 *   compact — renders a smaller inline variant (no explanatory text)
 */
export default function AccountButton({ compact = false }) {
  const { user, loading, isGoogle } = useAuthState();
  const { resetAll } = useAppStore();

  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.error) setError(result.error);
    // wasLinked=true → same uid, history already visible
    // wasLinked=false → switched to Google uid, HistoryPage will reload
  }

  async function handleSignOut() {
    setMenuOpen(false);
    setBusy(true);
    resetAll();
    await signOutUser();
    setBusy(false);
  }

  if (loading) return null;

  // ── Signed in with Google ──────────────────────────────────────────────
  if (isGoogle) {
    const name   = user.displayName ?? 'Account';
    const photo  = user.photoURL;
    const initial = name.charAt(0).toUpperCase();

    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-teal-600 px-3 py-1.5
                     hover:border-silver/40 transition-colors disabled:opacity-50"
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          {photo
            ? <img src={photo} alt={name} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
            : <span className="w-6 h-6 rounded-full bg-copper-400 text-teal-900 text-xs
                               font-semibold flex items-center justify-center">{initial}</span>
          }
          {!compact && (
            <span className="text-bone/75 text-xs max-w-[120px] truncate">{name}</span>
          )}
          <span className="text-silver/40 text-xs">▾</span>
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-20 bg-teal-900 border border-teal-600
                            rounded-xl shadow-xl py-1 min-w-[160px]">
              <div className="px-4 py-2 border-b border-teal-900">
                <p className="text-bone/90 text-xs font-medium truncate">{name}</p>
                <p className="text-silver/70 text-[10px] truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                disabled={busy}
                className="w-full text-left px-4 py-2.5 text-silver hover:text-bone/90
                           hover:bg-teal-900 text-xs transition-colors disabled:opacity-50"
              >
                {busy ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Anonymous — show sign-in button ───────────────────────────────────
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="flex items-center gap-2.5 bg-white hover:bg-gray-50 disabled:opacity-50
                   text-gray-700 font-medium text-sm px-4 py-2 rounded-xl shadow-sm
                   border border-gray-300 transition-colors"
      >
        <GoogleLogo />
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {!compact && (
        <p className="text-silver/40 text-[10px]">Sync your readings across devices</p>
      )}
      {error && (
        <p className="text-red-400 text-xs mt-0.5">{error}</p>
      )}
    </div>
  );
}
