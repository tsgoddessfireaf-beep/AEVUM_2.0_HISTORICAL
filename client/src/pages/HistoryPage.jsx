// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadUserReadings, FIREBASE_ENABLED } from '../lib/firebase.js';
import useAppStore from '../store/useAppStore.js';
import AccountButton from '../components/AccountButton.jsx';
import { useAuthState } from '../hooks/useAuthState.js';

const ANSWER_COLORS = {
  YES:   'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
  NO:    'bg-red-900/60 text-red-300 border-red-700/50',
  MAYBE: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
  WAIT:            'bg-blue-900/60    text-blue-300    border-blue-700/50',
  'CHARACTER READ': 'bg-violet-900/60 text-violet-300 border-violet-700/50',
};

/** Extracts a YES/NO/MAYBE/WAIT/CHARACTER READ verdict from the analysis text, if present. */
function extractAnswer(fullAnalysis) {
  if (!fullAnalysis) return null;
  const m = fullAnalysis.match(/\b(CHARACTER READ|YES|NO|MAYBE|WAIT)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Formats a Firestore Timestamp or ISO string as a readable date. */
function formatDate(createdAt) {
  if (!createdAt) return '';
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Displays the user's past readings as a scrollable card list.
 * Clicking a card loads the reading into the store and navigates to /results.
 */
export default function HistoryPage() {
  const navigate = useNavigate();
  const { loadFromReading } = useAppStore();

  const { isGoogle } = useAuthState();

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      setError('Reading history requires Firebase. Add your VITE_FIREBASE_* keys to enable it.');
      setLoading(false);
      return;
    }
    loadUserReadings()
      .then((list) => { setReadings(list); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  function handleOpen(reading) {
    loadFromReading(reading);
    navigate('/results');
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-serif text-bone tracking-wide">Past Readings</h1>
            <p className="text-silver/70 text-sm mt-1">Your horary chart history</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/consent')}
              className="text-silver/40 hover:text-silver text-xs transition-colors px-2 py-2"
              title="Data & Privacy settings"
            >
              ⚙
            </button>
            <button
              onClick={() => navigate('/ask')}
              className="text-silver/70 hover:text-bone/75 text-sm border border-teal-600
                         rounded-xl px-4 py-2 transition-colors"
            >
              ← New Reading
            </button>
            <AccountButton compact />
          </div>
        </div>

        {/* Anonymous notice — shown until they sign in with Google */}
        {!isGoogle && FIREBASE_ENABLED && (
          <div className="mb-6 bg-teal-700/70 border border-teal-600/40 rounded-2xl px-5 py-4
                          flex items-center justify-between gap-4">
            <p className="text-silver/70 text-sm leading-relaxed">
              Sign in with Google to sync your readings across devices.
            </p>
            <AccountButton />
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="text-center py-20 text-silver/70 text-sm">Loading your readings…</div>
        )}

        {error && (
          <div className="text-center py-20 text-silver/70 text-sm">{error}</div>
        )}

        {!loading && !error && readings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-copper-400 text-3xl mb-4">✦</div>
            <p className="text-silver text-sm">No readings yet.</p>
            <p className="text-silver/40 text-xs mt-2">Cast your first chart to see it here.</p>
          </div>
        )}

        {/* Reading cards */}
        {!loading && !error && readings.length > 0 && (
          <ul className="flex flex-col gap-4">
            {readings.map((reading) => {
              const answer = extractAnswer(reading.fullAnalysis);
              const answerStyle = answer ? ANSWER_COLORS[answer] : null;
              return (
                <li key={reading.id}>
                  <button
                    onClick={() => handleOpen(reading)}
                    className="w-full text-left bg-teal-700/80 border border-teal-600/50 rounded-2xl
                               p-6 backdrop-blur-sm hover:border-copper-400/40 hover:bg-teal-900/70
                               transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-bone text-sm leading-relaxed flex-1 group-hover:text-white transition-colors">
                        {reading.question}
                      </p>
                      {answerStyle && (
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border ${answerStyle}`}>
                          {answer}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-silver/40 text-xs">
                      <span>{formatDate(reading.createdAt)}</span>
                      {reading.dateTime?.location && (
                        <span className="truncate">{reading.dateTime.location}</span>
                      )}
                      {reading.journal?.accuracyRating && (
                        <span className="text-copper-400/70">
                          {'★'.repeat(reading.journal.accuracyRating)}{'☆'.repeat(5 - reading.journal.accuracyRating)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
