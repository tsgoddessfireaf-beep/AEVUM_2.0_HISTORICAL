// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  loadUserProfile,
  saveUserConsent,
  updateUserPreferences,
  CURRENT_CONSENT_VERSION,
  FIREBASE_ENABLED,
} from '../lib/firebase.js';

const WHAT_IS_INCLUDED = [
  'Your horary question',
  'The chart cast for that moment',
  'The interpretation Aevum provided',
  'Follow-up questions you asked',
  'Accuracy ratings you leave in your journal',
];

const WHAT_IS_NOT_INCLUDED = [
  'Your name',
  'Email or contact information',
  'IP address or device identifiers',
  'Any data you have not personally entered',
];

/** Formats a Firestore Timestamp or ms-epoch number as a readable date string. */
function formatTimestamp(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Standalone data-consent and privacy preferences page.
 *
 * First-time view: explains what data would be used and asks for opt-in.
 * Returning view: shows current preference with a live toggle and the date/version of consent.
 * Complies with GDPR/CCPA — opt-in only, informed, specific, revocable at any time.
 */
export default function ConsentPage() {
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [profile, setProfile]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [savedKey, setSavedKey] = useState(null); // which pref just saved, for the flash

  useEffect(() => {
    if (!FIREBASE_ENABLED) { setLoading(false); return; }
    loadUserProfile().then((p) => { setProfile(p); setLoading(false); });
  }, []);

  function flash(key) {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  async function handleFirstConsent(allow) {
    setSaving(true);
    await saveUserConsent({ allow_training_data: allow });
    setProfile((p) => ({
      ...(p ?? {}),
      consent_timestamp: { toDate: () => new Date() },
      consent_version:   CURRENT_CONSENT_VERSION,
      preferences_json:  { ...p?.preferences_json, allow_training_data: allow },
    }));
    setSaving(false);
    flash('allow_training_data');
  }

  async function handleToggle(key, value) {
    setSaving(true);
    await updateUserPreferences({ [key]: value });
    setProfile((p) => ({
      ...(p ?? {}),
      preferences_json: { ...p?.preferences_json, [key]: value },
    }));
    setSaving(false);
    flash(key);
  }

  const hasAnswered    = Boolean(profile?.consent_timestamp);
  const allowTraining  = profile?.preferences_json?.allow_training_data ?? false;
  const versionMismatch =
    hasAnswered && profile?.consent_version !== CURRENT_CONSENT_VERSION;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-silver/70 text-sm">
        Loading…
      </div>
    );
  }

  // ── Firebase disabled ────────────────────────────────────────────────────
  if (!FIREBASE_ENABLED) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <p className="text-silver text-sm">
            Data preferences require Firebase. Add your{' '}
            <code className="text-copper-400">VITE_FIREBASE_*</code> keys to enable them.
          </p>
          <button onClick={() => navigate(-1)} className="mt-6 text-silver/70 hover:text-bone/75 text-sm transition-colors">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Shared layout wrapper ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-copper-400 text-3xl mb-4 font-serif">✦</div>
          <h1 className="text-2xl font-serif text-bone tracking-wide">Your Data & Privacy</h1>
          <p className="text-silver/70 text-sm mt-2">
            You are always in control of your information.
          </p>
        </div>

        {/* Version-mismatch notice */}
        {versionMismatch && (
          <div className="mb-6 bg-teal-900/20 border border-amber-700/40 rounded-2xl px-5 py-4 text-sm text-amber-300">
            Our data practices have been updated since you last reviewed this.
            Please review and confirm your preference below.
          </div>
        )}

        {/* ── RETURNING USER — settings view ─────────────────────────── */}
        {hasAnswered && !versionMismatch ? (
          <div className="space-y-4">

            <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-6 backdrop-blur-sm">
              <p className="text-silver/70 text-xs uppercase tracking-widest mb-4">
                Data Preferences
              </p>

              <ToggleRow
                label="Allow my readings to improve Aevum"
                description="Anonymous data only — never your name or contact info."
                checked={allowTraining}
                saving={saving}
                justSaved={savedKey === 'allow_training_data'}
                onChange={(v) => handleToggle('allow_training_data', v)}
              />
            </div>

            <div className="bg-teal-900/40 border border-teal-600/30 rounded-2xl px-5 py-4 text-xs text-silver/40 space-y-1">
              <p>Preference recorded on {formatTimestamp(profile.consent_timestamp)}</p>
              <p>Consent version {profile.consent_version}</p>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="w-full mt-2 py-3 border border-teal-600 text-silver/70 hover:text-bone/75
                         rounded-xl text-sm transition-colors"
            >
              ← Back
            </button>
          </div>

        ) : (
          // ── FIRST-TIME (or version mismatch) — full consent form ──────
          <div className="space-y-5">

            <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-6 backdrop-blur-sm space-y-5">
              <p className="text-bone/75 text-sm leading-relaxed">
                Would you like to allow your readings to be used to improve Aevum over time?
                This is entirely optional. Your data would be used anonymously to refine
                interpretations — <span className="text-bone/90 font-medium">never your name or contact information</span>.
                You can change this at any time.
              </p>

              {/* What's included */}
              <div>
                <p className="text-copper-400 text-xs uppercase tracking-widest mb-3">What would be included</p>
                <ul className="space-y-2">
                  {WHAT_IS_INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-silver">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What's NOT included */}
              <div>
                <p className="text-copper-400 text-xs uppercase tracking-widest mb-3">What is never included</p>
                <ul className="space-y-2">
                  {WHAT_IS_NOT_INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-silver">
                      <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-silver/40 text-xs border-t border-teal-600/40 pt-4">
                Your choice is recorded with a timestamp and the version of this policy in effect today
                (v{CURRENT_CONSENT_VERSION}). You can revoke consent at any time from this page.
                Read the full{' '}
                <Link to="/privacy" className="text-silver/70 hover:text-silver underline underline-offset-2 transition-colors">
                  Privacy Policy
                </Link>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleFirstConsent(true)}
                disabled={saving}
                className="w-full py-3.5 bg-copper-400 hover:bg-copper-300 disabled:opacity-40
                           text-teal-900 font-semibold rounded-xl text-sm transition-all"
              >
                {saving ? 'Saving…' : 'Yes, help improve Aevum'}
              </button>
              <button
                onClick={() => handleFirstConsent(false)}
                disabled={saving}
                className="w-full py-3 border border-teal-600 text-silver hover:text-bone/90
                           disabled:opacity-40 rounded-xl text-sm transition-colors"
              >
                No thanks, keep my data private
              </button>
            </div>

            {savedKey && (
              <p className="text-center text-emerald-400 text-xs">Preference saved.</p>
            )}

            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 text-silver/40 hover:text-silver text-xs transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────────

/**
 * An accessible toggle row for a single boolean preference.
 * @param {{ label: string, description: string, checked: boolean, saving: boolean, justSaved: boolean, onChange: (v: boolean) => void }} props
 */
function ToggleRow({ label, description, checked, saving, justSaved, onChange }) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label htmlFor={id} className="text-bone/90 text-sm font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-silver/70 text-xs mt-0.5">{description}</p>
        {justSaved && (
          <p className="text-emerald-400 text-xs mt-1">Saved.</p>
        )}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={saving}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
                    focus-visible:ring-2 focus-visible:ring-copper-400/60 disabled:opacity-50
                    ${checked ? 'bg-copper-400' : 'bg-teal-700'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                      transition-transform duration-200
                      ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
