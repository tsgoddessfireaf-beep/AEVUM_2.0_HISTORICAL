// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator.jsx';
import AccountButton from '../components/AccountButton.jsx';
import useAppStore from '../store/useAppStore.js';
import { useAuthState } from '../hooks/useAuthState.js';
import { loadDraft } from '../lib/firebase.js';

/**
 * Deterministically classifies a question as a 'condition' (character/motivation/why)
 * or 'perfection' (outcome/yes-no) question.
 * Condition questions don't have a planetary meeting to judge — they're answered by
 * reading the quesited significator's state directly.
 */
function detectQuestionType(q) {
  const s = q.trim().toLowerCase();
  return [
    /^why\b/,
    /^what (kind|type|sort) of (person|man|woman|individual|one)\b/,
    /^who (is|was|are|were)\b/,
    /^what does .{1,50} (want|mean|think|feel|plan|intend)\b/,
    /^what did .{1,50} (want|mean|think|feel|plan|intend)\b/,
    /^how does .{1,40} feel\b/,
    /^what is .{1,40} (like|character|nature|agenda)\b/,
    /^what (motivated|drives|drove)\b/,
    /^what (are|were) .{1,50}(intentions|motives|feelings|thoughts)\b/,
    /\b(intention|intentions|motive|motives)\b/,
  ].some((p) => p.test(s))
    ? 'condition'
    : 'perfection';
}

const HOW_IT_WORKS = [
  { step: 1, title: 'Record the Petition',    body: 'State your petition clearly and with absolute sincerity — traditional horary relies on the spiritual sincerity of the question.' },
  { step: 2, title: 'The Moment of Reception', body: 'The exact date, time, and place the astrologer receives the question is recorded. This forms the basis of the calculation.' },
  { step: 3, title: 'Map it to the Manual',   body: 'Consult historical rules to assign the querent and quesited elements of your question to their classical houses.' },
  { step: 4, title: 'Casting the Figure',     body: 'Cast the astronomical chart at 7-decimal-place precision, verify against NASA JPL, and simulate the traditional rule-based judgment.' },
];

/**
 * Step 1 — collects the horary question from the user.
 * Persists the trimmed question to the global store before navigating to DateTimePage.
 */
export default function IntakePage() {
  const navigate = useNavigate();
  const { question, setQuestion, resetAll, setQuestionType, clearForNewQuestion, hydrateFromDraft } = useAppStore();
  const { isGoogle } = useAuthState();
  const [localQuestion, setLocalQuestion] = useState(question);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('aevum-visited') && !question
  );
  const [showConditionWarning, setShowConditionWarning] = useState(false);

  // Recover an in-progress session from Firestore if localStorage came up empty
  // (cleared, glitched, or a different device) but the user has a saved draft.
  useEffect(() => {
    if (question || !isGoogle) return;
    (async () => {
      const draft = await loadDraft();
      if (draft?.question) {
        hydrateFromDraft(draft);
        setLocalQuestion(draft.question);
      }
    })();
  }, [isGoogle]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissOnboarding() {
    localStorage.setItem('aevum-visited', '1');
    setShowOnboarding(false);
  }

  function handleContinue() {
    const trimmed = localQuestion.trim();
    if (!trimmed) return;
    const qType = detectQuestionType(trimmed);
    if (qType === 'condition' && !showConditionWarning) {
      setShowConditionWarning(true);
      return;
    }
    clearForNewQuestion();
    setQuestion(trimmed);
    setQuestionType(qType);
    navigate('/datetime');
  }

  function handleProceedAsCondition() {
    const trimmed = localQuestion.trim();
    clearForNewQuestion();
    setQuestion(trimmed);
    setQuestionType('condition');
    navigate('/datetime');
  }

  function handleRephrase() {
    setShowConditionWarning(false);
  }

  function handleNew() {
    resetAll();
    setLocalQuestion('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-16">
      <div className="w-full max-w-xl">

        {/* Account button — top-right, unobtrusive */}
        <div className="flex justify-end mb-4">
          <AccountButton compact />
        </div>

        <StepIndicator current={1} />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-copper-400 text-4xl mb-4 font-serif">✦</div>
          <h1 className="text-3xl font-serif text-bone mb-2 tracking-wide">The Casebook</h1>
          <p className="text-silver/70 text-sm tracking-widest uppercase">Renaissance Horary Simulation</p>
        </div>

        {/* First-time onboarding */}
        {showOnboarding && (
          <div className="mb-8 space-y-4">
            <p className="text-center text-silver text-sm leading-relaxed px-2">
              The Casebook reconstructs the exact workflow a 17th-century astrologer followed. Approach this simulation with sincerity to cast a valid and radical chart.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HOW_IT_WORKS.map(({ step, title, body }) => (
                <div key={step}
                     className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-900 border border-teal-600
                                     text-silver/70 text-[10px] font-semibold flex items-center justify-center">
                      {step}
                    </span>
                    <span className="text-bone/90 text-sm font-medium">{title}</span>
                  </div>
                  <p className="text-silver/70 text-xs leading-relaxed pl-7">{body}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={dismissOnboarding}
                className="text-copper-400 hover:text-copper-300 text-sm transition-colors"
              >
                I understand — record my petition →
              </button>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-8 backdrop-blur-sm">
          <label className="block text-silver text-sm mb-3 tracking-wide">
            Formulate the Inquirer's Petition
          </label>
          <textarea
            value={localQuestion}
            onChange={(e) => { setLocalQuestion(e.target.value); if (showOnboarding) dismissOnboarding(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleContinue();
            }}
            aria-label="Your horary petition"
            placeholder="State your petition clearly and with absolute sincerity, just as a client would write in Lilly's ledger…"
            rows={4}
            className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-3 text-bone
                       placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 resize-none
                       text-base leading-relaxed transition-colors"
          />
          <p className="text-silver/40 text-xs mt-2">Press ⌘↵ or click Continue</p>

          {showConditionWarning ? (
            <div className="mt-6 border border-teal-600/30 rounded-xl p-5 bg-teal-900/40">
              <p className="text-bone/90 text-sm font-medium mb-3">
                Historical Horary distinguishes two types of inquiry.
              </p>
              <p className="text-silver text-xs leading-relaxed mb-2">
                **Perfection Case (Outcome):** Standard inquiries ask if a matter will be resolved (e.g. *"Will I get the job?"*). The simulation evaluates if the signifying planets form a perfect applying aspect.
              </p>
              <p className="text-silver text-xs leading-relaxed mb-4">
                **Condition Case (Character/Motive):** Your petition asks *why* something happened, or the *nature* of a person/object. The simulation does not track aspect perfection; instead, it evaluates the essential and accidental dignity of the quesited significator. The state of this planet is the answer, which historically was used to render a character analysis.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleProceedAsCondition}
                  className="w-full bg-copper-400 hover:bg-copper-300 text-teal-900 font-semibold
                             py-3 rounded-xl transition-all duration-200 text-sm"
                >
                  Initiate Character Analysis →
                </button>
                <button
                  onClick={handleRephrase}
                  className="w-full text-silver hover:text-bone/90 text-xs py-2
                             border border-teal-600 rounded-xl transition-colors"
                >
                  Rephrase Petition
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleContinue}
                disabled={!localQuestion.trim()}
                className="flex-1 bg-copper-400 hover:bg-copper-300 disabled:opacity-30 disabled:cursor-not-allowed
                           text-teal-900 font-semibold py-3 rounded-xl transition-all duration-200 text-sm"
              >
                Continue →
              </button>
              {question && (
                <button
                  onClick={handleNew}
                  className="px-4 text-silver/70 hover:text-bone/75 text-sm border border-teal-600
                             rounded-xl transition-colors"
                >
                  New Case
                </button>
              )}
            </div>
          )}
          {isGoogle && (
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/history')}
                className="text-silver/40 hover:text-silver text-xs transition-colors"
              >
                Past Cases →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-silver/20 text-xs mt-8 leading-relaxed max-w-sm mx-auto">
          Traditional horary casts a figure for the moment the petition is recorded, simulating 17th-century rules.
        </p>
      </div>
    </div>
  );
}
