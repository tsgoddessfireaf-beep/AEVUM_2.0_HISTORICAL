// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useEffect, useRef, useState } from 'react';

// Static progress bar + rotating astrologer phrases — replaces the old
// animated Astrolabe loading screen per Dolores's directive: no animations
// on the loading page, entertain with text instead, keep the whole wait
// under ~20 seconds.
//
// The bar is a simulated ease-out curve (there's no real "percent done" signal
// from the server — the actual work is an ephemeris fetch + a streamed Claude
// response). It climbs to ~94% over TARGET_MS, then holds there until the
// parent unmounts this component (i.e. the real answer has arrived), at which
// point the parent's own UI takes over. It never claims 100% before the
// content is actually ready.
const TARGET_MS = 18000; // stays under Dolores's 20s target
const HOLD_AT = 94;

const PHRASES = [
  'Erecting the figure for this exact moment…',
  'Casting the houses by Regiomontanus…',
  'Weighing each planet\'s essential dignity…',
  'Watching for applying and separating aspects…',
  'Checking whether the Moon is void of course…',
  'Cross-verifying against NASA JPL Horizons…',
  'Reading the testimony of the significators…',
  'Consulting William Lilly\'s judgment rules…',
  'Checking the chart for radicality…',
  'Aligning the ephemeris to the second…',
];

export default function LoadingProgress({ label = 'Preparing your reading…' }) {
  const [pct, setPct] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const t = Math.min(elapsed / TARGET_MS, 1);
      // Ease-out: fast at first, slows as it approaches HOLD_AT
      const eased = 1 - Math.pow(1 - t, 2);
      setPct(Math.min(HOLD_AT, Math.round(eased * HOLD_AT)));
    }, 150);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 2400);
    return () => clearInterval(rotate);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center font-sans text-bone px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-silver text-sm tracking-wide mb-6">{label}</p>

        <div className="w-full h-1.5 rounded-full bg-teal-900/60 overflow-hidden mb-4 border border-teal-700/40">
          <div
            className="h-full rounded-full bg-copper-400 transition-all duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-copper-400/70 text-xs tracking-widest mb-8">{pct}%</p>

        <p className="text-silver/60 text-xs italic min-h-[2.5em] transition-opacity duration-300">
          {PHRASES[phraseIdx]}
        </p>
      </div>
    </div>
  );
}
