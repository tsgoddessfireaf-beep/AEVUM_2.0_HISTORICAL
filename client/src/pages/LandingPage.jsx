// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountButton from '../components/AccountButton.jsx';
import { TRADITIONS } from '../lib/traditions.js';

const STEPS = [
  {
    n: '1',
    title: 'Record the Petition',
    body: 'Formulate your question with absolute sincerity. Traditional horary is based on the spiritual sincerity of the petition.',
  },
  {
    n: '2',
    title: 'The Moment of Reception',
    body: 'In classical horary, the chart is cast for the exact moment the astrologer receives the question. We calculate the coordinates and clock parameters.',
  },
  {
    n: '3',
    title: 'Consult the Manual',
    body: 'Assign the querent and quesited to their traditional houses, consulting the rules of William Lilly’s Christian Astrology (1647).',
  },
  {
    n: '4',
    title: 'Casting the Figure',
    body: 'Casts the figure at 7-decimal-place precision using Swiss Ephemeris, cross-audits against NASA JPL, and simulates the traditional judgment.',
  },
];

const TRADITION_DISPLAY = {
  classic:  { tagline: 'THE BALANCED EDGE',         body: 'A seamless fusion of traditional horary. Merging planetary power, essential dignities, and the urgent testimony of the Moon for a clear, objective verdict.' },
  lilly:    { tagline: 'THE ENGLISH MASTER',         body: 'Author of Christian Astrology. Direct, uncompromising, and razor-sharp. Utilizing secret antiscia, strict planetary strengths, and Lilly\'s legendary aphoristic voice.' },
  bonatti:  { tagline: 'THE SCHOLASTIC INQUISITOR',  body: 'Author of Liber Astronomiae. Deeply methodical Latin judgment. Weaponizing the grueling 146 Considerations Before Judgment to expose flaws in the inquiry before a word is spoken.' },
  arabic:   { tagline: 'THE CHRONICLERS OF FATE',    body: 'The golden-age synthesis of Māshā\'allāh and Abū Ma\'shar. Where cosmic sect is absolute law, Arabic Lots dictate hidden fortunes, and the stars reveal a fate-ordained decree.' },
  dorotheus:{ tagline: 'THE ANCIENT KEEPER',         body: 'Author of Carmen Astrologicum — the oldest surviving horary lineage. Stripping away modern noise to read the cosmos through primal elemental reasoning and the lords of triplicity.' },
};

const ENGINE_SECTIONS = [
  { name: 'The Gates of Radicality',  body: 'Interrogating the fitness of the moment before judgment begins: checking for premature inquiries, expired hours, or the silent obstruction of Saturn in the angles.' },
  { name: 'The Fivefold Dignities',   body: 'Sifting planetary strength through the strict, essential hierarchy of old — measuring power by Domicile, Exaltation, Triplicity, Term, and Face.' },
  { name: 'The Geometry of Time',     body: 'Tracking the precise orbs of applying and separating aspects, navigating the paths of prohibition, refranation, and the seamless translation of light.' },
  { name: 'Solar Containment',        body: 'Isolating the critical thresholds of the Sun: from the blinding obliteration of Combustion to the absolute, protected heart of Cazimi.' },
  { name: 'The Perilous Paths',       body: 'Mapping the erratic steps of the Void of Course Moon and calculating transit through the burning degrees of the Via Combusta.' },
  { name: 'The Deep Sky & Shadow',    body: 'Weaving hidden threads into the verdict through the parallel degrees of Antiscia, the calculation of the Arabic Lots, and precision conjunctions to the crucial fixed stars.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [calibrated, setCalibrated] = useState(false);

  useEffect(() => {
    let active = true;
    // Force-enable after 45s regardless — prevents permanent block on cold starts
    const giveUpTimer = setTimeout(() => { if (active) setCalibrated(true); }, 45000);
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (active) {
          setCalibrated(data.calibrated);
          if (!data.calibrated) {
            setTimeout(checkHealth, 3000);
          }
        }
      } catch (err) {
        if (active) {
          setCalibrated(false);
          setTimeout(checkHealth, 5000);
        }
      }
    }
    checkHealth();
    return () => { active = false; clearTimeout(giveUpTimer); };
  }, []);

  return (
    <div className="min-h-screen">

      {/* Nav strip */}
      <div className="flex justify-between items-center px-6 py-4 max-w-4xl mx-auto">
        <span className="text-silver text-xs tracking-widest uppercase">The Astrologer's Casebook — Renaissance Horary Simulation</span>
        <AccountButton compact />
      </div>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-20">
        <h1 className="text-6xl sm:text-8xl font-serif text-copper-400 tracking-widest mb-6 leading-none">
          AEVUM
        </h1>
        <p className="text-silver text-base leading-relaxed max-w-lg mb-8 font-serif italic">
          Resurrecting the craft of the Renaissance astrologer. Cast high-precision astronomical figures using Swiss Ephemeris calculations, audit against NASA JPL data, and simulate traditional horary judgments.
        </p>
        {!calibrated && (
          <p className="text-amber-400 text-xs mb-6 max-w-xs animate-pulse leading-relaxed">
            🔭 Calibrating ephemeris tables & auditing JPL connections (cold start can take up to 2 minutes)...
          </p>
        )}
        <button
          onClick={() => navigate('/ask')}
          disabled={!calibrated}
          className="bg-copper-400 hover:bg-copper-300 disabled:opacity-40 disabled:cursor-not-allowed text-teal-900 font-semibold
                     px-8 py-3.5 rounded-xl text-sm transition-all duration-200
                     shadow-lg shadow-teal-900/30 hover:shadow-teal-900/50"
        >
          {calibrated ? 'Open the Casebook →' : 'Warming up Engine…'}
        </button>
      </section>

      {/* ── Steps ── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="bg-teal-700/80 border border-teal-600/50 rounded-2xl px-6 py-5 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-6 h-6 rounded-full bg-teal-900 border border-teal-600
                                 text-silver/70 text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {n}
                </span>
                <span className="text-bone/90 text-sm font-medium">{title}</span>
              </div>
              <p className="text-silver/70 text-xs leading-relaxed pl-9">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interpretive Traditions ── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <p className="text-copper-400 text-xs uppercase tracking-widest text-center mb-2">
          Interpretive Traditions
        </p>
        <p className="text-silver/70 text-xs text-center mb-8 max-w-md mx-auto">
          Each tradition models the celestial sphere using its own strict historical rules of judgment. Classic is included with every reading — named-author traditions unlock with a subscription.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRADITIONS.map((t) => {
            const display = TRADITION_DISPLAY[t.id] || {};
            return (
              <div key={t.id}
                   className="bg-teal-700/80 border border-teal-600/50 rounded-2xl px-5 py-5 backdrop-blur-sm">
                <p className="text-bone/90 text-sm font-medium mb-0.5">{t.name}</p>
                <p className="text-copper-400/60 text-[10px] uppercase tracking-widest mb-2">{t.era}</p>
                {display.tagline && (
                  <p className="text-copper-400 text-[10px] uppercase tracking-widest font-semibold mb-3">{display.tagline}</p>
                )}
                <p className="text-silver/70 text-xs leading-relaxed">{display.body || t.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── The Architecture of Judgment ── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <p className="text-copper-400 text-xs uppercase tracking-widest text-center mb-2">
          The Architecture of Judgment
        </p>
        <p className="text-silver/70 text-xs text-center mb-8 max-w-lg mx-auto uppercase tracking-wide">
          The stars offer no compromise. The engine distills the moment to ancient zodiacal law.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ENGINE_SECTIONS.map(({ name, body }) => (
            <div key={name} className="bg-teal-700/80 border border-teal-600/50 rounded-2xl px-5 py-5 backdrop-blur-sm">
              <p className="text-bone/90 text-xs font-semibold uppercase tracking-wide mb-2">{name}</p>
              <p className="text-silver/70 text-xs leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── Bottom CTA ── */}
      <section className="flex flex-col items-center text-center px-6 pb-24">
        <div className="text-copper-400/40 text-3xl mb-6 font-serif select-none">✦</div>
        <h2 className="text-2xl font-serif text-bone/90 mb-3 uppercase tracking-widest">The Threshold of Inquiry</h2>
        <p className="text-silver/70 text-sm mb-8 max-w-sm leading-relaxed">
          The figure is cast for the exact moment the petition is entered into the casebook. Approach the reconstruction with sincerity to ensure the calculations are radical.
        </p>
        <button
          onClick={() => navigate('/ask')}
          disabled={!calibrated}
          className="bg-copper-400 hover:bg-copper-300 disabled:opacity-40 disabled:cursor-not-allowed text-teal-900 font-semibold
                     px-8 py-3.5 rounded-xl text-sm transition-all duration-200"
        >
          {calibrated ? 'Initialize Simulation →' : 'Warming up Engine…'}
        </button>
      </section>

    </div>
  );
}
