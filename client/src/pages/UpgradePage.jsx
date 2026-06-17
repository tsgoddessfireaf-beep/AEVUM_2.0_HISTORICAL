// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { redirectToBookingCheckout } from '../lib/stripe.js';
import useAppStore from '../store/useAppStore.js';

export default function UpgradePage() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const isSuccess         = params.get('booking') === '1' || window.location.pathname.endsWith('/success');
  const sessionId         = params.get('session_id') || '';
  const { question }      = useAppStore();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Fire confirm endpoint once to trigger the Resend email
  useEffect(() => {
    if (!isSuccess || !sessionId || confirmed) return;
    setConfirmed(true);
    fetch('/api/booking/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch((err) => console.warn('[booking] confirm error:', err.message));
  }, [isSuccess, sessionId, confirmed]);

  async function handleBooking() {
    if (!question?.trim()) {
      navigate('/ask');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await redirectToBookingCheckout(question);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-copper-400 text-3xl mb-4 font-serif select-none">✦</div>
          {isSuccess ? (
            <>
              <h1 className="text-2xl font-serif text-bone tracking-wide mb-2">Case study review scheduled.</h1>
              <p className="text-silver text-sm">Your astronomical figure is being calculated and logged. A confirmation has been sent to your email.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-serif text-bone tracking-wide mb-2">Commission a Custom Case-Review</h1>
              <p className="text-silver/70 text-sm">A formal case review conducted by traditional practitioner Dolores Puckett. Fulfilling the simulation with detailed slides, custom stricture checks, and recorded audio explanation.</p>
            </>
          )}
        </div>

        {isSuccess ? (
          <div className="text-center space-y-4">
            <div className="bg-teal-900/30 border border-copper-400/30 rounded-2xl px-6 py-5 text-sm text-copper-300">
              Your review is scheduled. Dolores will compile your written case report and record the 9-slide presentation walkthrough within 72 hours.
            </div>
            <button
              onClick={() => navigate('/ask')}
              className="bg-copper-400 hover:bg-copper-300 text-teal-900 font-semibold px-8 py-3 rounded-xl text-sm transition-all"
            >
              Enter another petition →
            </button>
          </div>
        ) : (
          <>
            <div className="bg-teal-700/80 border border-copper-400/60 rounded-2xl p-6 backdrop-blur-sm ring-1 ring-copper-400/20 mb-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-copper-400 font-medium">Custom Case Study — Founder Rate</p>
                  <p className="text-3xl font-serif text-bone mt-1">$88 <span className="text-base text-silver/70 font-sans">one-time fee</span></p>
                </div>
                <span className="text-[10px] text-copper-400 border border-copper-400/40 rounded-full px-2 py-0.5 tracking-wider uppercase">First 22 only</span>
              </div>
              <ul className="space-y-1.5 mb-5">
                {[
                  'Formal rule-based case study report — strictures, dignities, aspects, receptions',
                  '9-slide presentation deck detailing the planetary mathematics & bibliography',
                  '72-hour turnaround from petition submission',
                  'Delivered directly to your email',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-silver">
                    <span className="text-copper-400/70 mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleBooking}
                disabled={busy}
                className="w-full py-3 bg-copper-400 hover:bg-copper-300 disabled:opacity-50
                           text-teal-900 font-semibold rounded-xl text-sm transition-all"
              >
                {busy ? 'Loading…' : question?.trim() ? 'Commission Case Review — $88' : 'Formulate your petition first →'}
              </button>
              {question?.trim() && (
                <p className="text-silver/40 text-xs text-center mt-2 truncate px-2">
                  "{question.trim()}"
                </p>
              )}
              <div className="mt-4 border-t border-teal-600/30 pt-4 text-[11px] text-silver/40 leading-relaxed space-y-1 text-center">
                <p><strong>Educational Simulation Notice:</strong> This review is an analysis of historical 17th-century horary judgment rules applied to your custom chart data. It is for research, educational, and entertainment purposes only.</p>
              </div>
            </div>

            {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
          </>
        )}

      </div>
    </div>
  );
}
