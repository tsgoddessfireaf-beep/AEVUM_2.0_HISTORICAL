// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, FIREBASE_ENABLED } from '../lib/firebase.js';
import { useAuthState } from '../hooks/useAuthState.js';

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

export default function RequireAuth({ children }) {
  const { user, loading, isGoogle } = useAuthState();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Firebase not configured — allow through so local dev works without auth
  if (!FIREBASE_ENABLED) return children;

  // Auth state still resolving
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-copper-400/40 text-3xl font-serif animate-pulse select-none">✦</div>
      </div>
    );
  }

  // Signed in with Google — allow through
  if (isGoogle) return children;

  // Not signed in — show wall
  async function handleSignIn() {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.error) setError(result.error);
    // On success, auth state change re-renders this component with isGoogle=true
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-copper-400 text-4xl mb-4 font-serif select-none">✦</div>
          <h1 className="text-2xl font-serif text-bone mb-2 tracking-wide">Aevum</h1>
          <p className="text-silver/70 text-sm">Sign in to cast a reading</p>
        </div>

        <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-8 backdrop-blur-sm">
          <p className="text-silver text-sm leading-relaxed mb-6 text-center">
            An account keeps your reading history across devices and lets you return to any chart later.
          </p>
          <button
            onClick={handleSignIn}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-50
                       disabled:opacity-50 text-gray-700 font-medium text-sm px-4 py-3 rounded-xl
                       shadow-sm border border-gray-300 transition-colors"
          >
            <GoogleLogo />
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
          {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
        </div>

        <div className="text-center mt-6 space-x-4">
          <button
            onClick={() => navigate('/')}
            className="text-silver/40 hover:text-silver text-xs transition-colors"
          >
            ← Back to Aevum
          </button>
          <a href="/privacy" className="text-silver/40 hover:text-silver text-xs transition-colors">
            Privacy Policy
          </a>
        </div>

      </div>
    </div>
  );
}
