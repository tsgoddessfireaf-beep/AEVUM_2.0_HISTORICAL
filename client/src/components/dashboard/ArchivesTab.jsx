import { useEffect, useState } from 'react';
import { loadUserReadings, updateJournal, FIREBASE_ENABLED } from '../../lib/firebase.js';
import useAppStore from '../../store/useAppStore.js';
import { useAuthState } from '../../hooks/useAuthState.js';

const ANSWER_COLORS = {
  YES:   'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
  NO:    'bg-red-900/60 text-red-300 border-red-700/50',
  MAYBE: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
  WAIT:  'bg-blue-900/60    text-blue-300    border-blue-700/50',
  'CHARACTER READ': 'bg-violet-900/60 text-violet-300 border-violet-700/50',
};

function extractAnswer(fullAnalysis) {
  if (!fullAnalysis) return null;
  const m = fullAnalysis.match(/\b(CHARACTER READ|YES|NO|MAYBE|WAIT)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function formatDate(createdAt) {
  if (!createdAt) return '';
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ArchivesTab() {
  const { loadFromReading } = useAppStore();
  const { isGoogle } = useAuthState();

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [notesValue, setNotesValue] = useState('');

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

  const handleSaveNotes = async (readingId) => {
    const reading = readings.find(r => r.id === readingId);
    if (!reading) return;
    const currentJournal = reading.journal || {};
    const updatedJournal = { ...currentJournal, notes: notesValue };
    
    // Update local state optimistically
    setReadings(prev => prev.map(r => r.id === readingId ? { ...r, journal: updatedJournal } : r));
    setEditingNotesId(null);

    // Save to firebase
    await updateJournal(readingId, updatedJournal);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-serif text-bone tracking-wide">Archives</h2>
        <p className="text-silver/70 text-sm mt-1">Your past readings and case notes.</p>
      </div>

      {!isGoogle && FIREBASE_ENABLED && (
        <div className="mb-6 bg-teal-700/70 border border-teal-600/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-silver/70 text-sm leading-relaxed">
            Sign in with Google to sync your readings across devices.
          </p>
        </div>
      )}

      {loading && <div className="text-center py-20 text-silver/70 text-sm">Loading your archives…</div>}
      {error && <div className="text-center py-20 text-silver/70 text-sm">{error}</div>}

      {!loading && !error && readings.length === 0 && (
        <div className="text-center py-20">
          <div className="text-copper-400 text-3xl mb-4">✦</div>
          <p className="text-silver text-sm">No readings yet.</p>
        </div>
      )}

      {!loading && !error && readings.length > 0 && (
        <ul className="flex flex-col gap-6">
          {readings.map((reading) => {
            const answer = extractAnswer(reading.fullAnalysis);
            const answerStyle = answer ? ANSWER_COLORS[answer] : null;
            const isEditing = editingNotesId === reading.id;
            
            return (
              <li key={reading.id} className="bg-teal-900/60 border border-teal-800/50 rounded-2xl overflow-hidden shadow-sm">
                {/* Header / Clickable area to load reading */}
                <div 
                  className="p-6 cursor-pointer hover:bg-teal-800/40 transition-colors border-b border-teal-800/30"
                  onClick={() => loadFromReading(reading)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-bone text-base font-serif italic leading-relaxed flex-1">
                      "{reading.question}"
                    </p>
                    {answerStyle && (
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border ${answerStyle}`}>
                        {answer}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-silver/50 text-xs tracking-wider">
                    <span>{formatDate(reading.createdAt)}</span>
                    {reading.dateTime?.location && (
                      <span className="truncate">{reading.dateTime.location}</span>
                    )}
                  </div>
                </div>

                {/* Notes area */}
                <div className="p-6 bg-teal-950/30">
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        className="w-full bg-teal-900/50 border border-teal-700/50 rounded-xl p-4 text-sm text-bone focus:outline-none focus:border-copper-400/50 resize-none"
                        rows={4}
                        placeholder="Add your case notes, reflections, or outcomes..."
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setEditingNotesId(null)}
                          className="text-silver/60 hover:text-silver text-xs px-4 py-2"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSaveNotes(reading.id)}
                          className="bg-teal-800 hover:bg-teal-700 text-bone text-xs font-medium px-4 py-2 rounded-lg transition-colors border border-teal-700"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="group cursor-text"
                      onClick={() => {
                        setEditingNotesId(reading.id);
                        setNotesValue(reading.journal?.notes || '');
                      }}
                    >
                      {reading.journal?.notes ? (
                        <div className="text-sm text-silver/80 whitespace-pre-wrap leading-relaxed">
                          {reading.journal.notes}
                        </div>
                      ) : (
                        <div className="text-sm text-silver/30 italic group-hover:text-silver/50 transition-colors">
                          Click to add case notes...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
