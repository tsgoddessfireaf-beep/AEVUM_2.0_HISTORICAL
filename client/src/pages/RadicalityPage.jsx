// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore.js';
import { getStrictures } from '../lib/warnings.js';
import LoadingProgress from '../components/LoadingProgress.jsx';

// Gate page inserted between the house-signification interview and the
// dashboard/reading. Once the chart is ready (normally already true here,
// since DateTimePage prefetches it the moment the moment/location are
// confirmed), this page renders William Lilly's radicality check
// (getStrictures — early/late Ascendant, Saturn in the 1st/7th) and asks the
// user to proceed or start over before any judgment or paywall is shown.
//
// Traditional horary practice: radicality strictures are a caution, not an
// automatic disqualification — a skilled astrologer may still judge a chart
// with strictures present, with appropriate care. This page reflects that:
// it always allows the user to continue, but never lets them miss the
// warning first.
//
// Practitioner override: when strictures are present, a hidden override
// button lets the practitioner proceed to judgment anyway. It renders only
// when localStorage 'aevum_practitioner' === '1' (or in Vite dev mode).
// Enable once per browser via DevTools console:
//   localStorage.setItem('aevum_practitioner', '1')
// Disable: localStorage.removeItem('aevum_practitioner')
export default function RadicalityPage() {
  const navigate = useNavigate();
  const { question, houseSignifications, ephemerisData, resetAll } = useAppStore();

  useEffect(() => {
    if (!question || !houseSignifications) {
      navigate('/ask');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ephemerisData) {
    // Chart isn't ready yet (prefetch from DateTimePage hasn't resolved, or
    // failed and DashboardPage's own fetch hasn't run yet). Show the same
    // progress bar / phrase UI used elsewhere rather than a blank screen.
    return <LoadingProgress label="Erecting the Moment of Reception…" />;
  }

  const strictures = getStrictures(ephemerisData);
  const fitToJudge = strictures.length === 0;

  // Practitioner-only: hidden from all normal users. True in local dev, or
  // when the per-browser practitioner flag has been set in localStorage.
  const isPractitioner =
    import.meta.env.DEV ||
    window.localStorage.getItem('aevum_practitioner') === '1';

  function handleAskNewQuestion() {
    resetAll();
    navigate('/ask');
  }

  function handleContinue() {
    navigate('/dashboard');
  }

  function handlePractitionerOverride() {
    // stricturesOverride travels in router state so the dashboard/report can
    // later annotate that this judgment was rendered under strictures by
    // practitioner override (Lilly noted strictures and judged with care).
    navigate('/dashboard', { state: { stricturesOverride: true } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans text-bone px-6 py-12">
      <div className="w-full max-w-lg">
        <p className="text-silver/60 text-xs uppercase tracking-widest text-center mb-2">
          Radicality Check
        </p>
        <h1 className="text-2xl font-serif text-bone text-center mb-8">
          "{question}"
        </h1>

        <div
          className={`rounded-2xl border p-6 mb-8 ${
            fitToJudge
              ? 'bg-teal-900/40 border-teal-600/40'
              : 'bg-red-900/20 border-red-800/40'
          }`}
        >
          <p className="text-lg font-serif mb-3 text-center">
            {fitToJudge ? '✦ Radical and Fit for Judgment' : '⚠ Strictures Against Judgment'}
          </p>

          {fitToJudge ? (
            <p className="text-silver/80 text-sm leading-relaxed text-center">
              The Ascendant is clear (between 3° and 27° of the sign), Saturn is not
              impeding the 1st or 7th houses. The chart speaks with clear, traditional
              authority — proceed to judgment.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-silver/80 text-sm leading-relaxed text-center">
                Traditional strictures are present. William Lilly cautions that a chart
                showing these conditions may not yet be ready to answer clearly — the
                matter may be premature, already decided, or the astrologer at risk of
                misjudging it.
              </p>
              <ul className="text-sm text-silver/90 space-y-2 pl-1">
                {strictures.map((s) => (
                  <li key={s.type} className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {fitToJudge ? (
          <button
            onClick={handleContinue}
            className="w-full py-4 bg-copper-500 hover:bg-copper-400 text-teal-950 font-semibold
                       rounded-xl text-sm tracking-wide transition-colors"
          >
            Continue to Final Judgement →
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-silver/60 text-xs text-center leading-relaxed">
              Ask your question again once more time has passed, or once the matter is
              clearer to you.
            </p>
            <button
              onClick={handleAskNewQuestion}
              className="w-full py-4 bg-teal-900 hover:bg-teal-700 border border-copper-400/30
                         text-bone rounded-xl text-sm tracking-wide transition-colors"
            >
              Ask a New Question Later
            </button>
            {isPractitioner && (
              <button
                onClick={handlePractitionerOverride}
                className="w-full py-3 bg-transparent hover:bg-red-900/20 border border-red-800/40
                           text-silver/70 hover:text-bone rounded-xl text-xs tracking-wide
                           transition-colors"
              >
                ⚖ Practitioner Override — Judge Under Strictures
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
