// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore.js';
import { updateJournal, FIREBASE_ENABLED } from '../lib/firebase.js';

const OUTCOMES = [
  { value: 'pending',      label: 'Still waiting' },
  { value: 'happened',     label: 'It happened' },
  { value: 'didnt-happen', label: 'Didn’t happen' },
  { value: 'partial',      label: 'Partially' },
];

const EMPTY_JOURNAL = {
  notes: '',
  outcome: 'pending',
  accuracyRating: null,
  outcomeNotes: '',
};

/**
 * Collapsible panel for tracking the outcome and personal notes on a completed reading.
 * Debounces Firestore writes so changes are saved 800 ms after the user stops typing.
 */
export default function JournalPanel() {
  const { readingId, journal, setJournal } = useAppStore();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(journal || EMPTY_JOURNAL);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  // Sync local state if store changes (e.g. on initial load from persist)
  useEffect(() => {
    if (journal) setLocal(journal);
  }, [journal]);

  function patch(updates) {
    const next = { ...local, ...updates };
    setLocal(next);
    setJournal(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!readingId) return;
      setSaving(true);
      await updateJournal(readingId, next);
      setSaving(false);
    }, 800);
  }

  const ratingDisabled = local.outcome === 'pending';

  return (
    <div className="border border-teal-600/30 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left
                   bg-teal-900/40 hover:bg-teal-900/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-copper-400 text-sm">✦</span>
          <span className="text-silver text-xs uppercase tracking-widest">
            Journal &amp; Outcome
          </span>
          {local.outcome !== 'pending' && (
            <span className="text-silver/70 text-xs">
              {OUTCOMES.find(o => o.value === local.outcome)?.label}
              {local.accuracyRating ? ` · ${local.accuracyRating}/5` : ''}
            </span>
          )}
        </div>
        <span className="text-silver/70 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 py-5 bg-teal-900/30 border-t border-teal-600/30 space-y-5">
          {!FIREBASE_ENABLED && (
            <div className="text-amber-400/80 text-xs bg-teal-900/10 border border-amber-700/30 rounded-lg px-3 py-2">
              Database not configured — entries are kept locally only. Add Firebase keys to
              <code className="mx-1 text-amber-300">client/.env.local</code>
              to persist across sessions.
            </div>
          )}

          {/* Outcome */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-2">
              What happened?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => patch({ outcome: o.value })}
                  className={`text-sm py-2.5 px-3 rounded-xl border transition-colors text-left
                    ${local.outcome === o.value
                      ? 'border-copper-400/60 bg-copper-400/10 text-copper-300'
                      : 'border-teal-600 text-silver hover:border-teal-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accuracy rating */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-2">
              How accurate was the reading?
              {ratingDisabled && <span className="ml-2 text-silver/40 normal-case lowercase">(after outcome is known)</span>}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={ratingDisabled}
                  onClick={() => patch({ accuracyRating: n })}
                  className={`w-10 h-10 rounded-full text-base transition-all
                    ${local.accuracyRating === n
                      ? 'bg-copper-400 text-teal-900 font-bold'
                      : 'bg-teal-900/60 text-silver/70 hover:bg-teal-700/60'}
                    ${ratingDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* What actually happened */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-2">
              What actually happened?
            </label>
            <textarea
              value={local.outcomeNotes || ''}
              onChange={(e) => patch({ outcomeNotes: e.target.value })}
              rows={3}
              placeholder="Describe how things unfolded…"
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-3 text-bone
                         placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 resize-none
                         text-sm transition-colors"
            />
          </div>

          {/* Personal notes */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-2">
              Notes for myself
            </label>
            <textarea
              value={local.notes || ''}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="Reflections, follow-up questions to revisit, patterns you notice…"
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-3 text-bone
                         placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 resize-none
                         text-sm transition-colors"
            />
          </div>

          <div className="text-silver/40 text-xs text-right">
            {saving ? 'Saving…' : readingId ? 'Saved' : 'Not yet persisted'}
          </div>
        </div>
      )}
    </div>
  );
}
