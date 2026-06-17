// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadPublicReading } from '../lib/firebase.js';
import WheelChart from '../components/WheelChart.jsx';
import SlideDeck from '../components/SlideDeck.jsx';
import { parseSections, formatInline, parseBullets, parseNumbered, answerStyle } from '../lib/analysis.js';
import { getChartWarnings, getStrictures } from '../lib/warnings.js';
import { getPlanetaryDignities, dignityColor, getAlmuten } from '../lib/dignity.js';
import { getAspects, getSignificators, getPerfectionAspects, getTranslationOfLight, getCollectionOfLight, getProhibition, getMoonTestimony, getRefranation } from '../lib/aspects.js';
import { getReceptions, receptionLabel } from '../lib/reception.js';
import { getTradition } from '../lib/traditions.js';
import { getLotOfFortune, getLotOfSpirit } from '../lib/lots.js';
import { getTiming, SIGN_MODES, MODE_UNITS } from '../lib/timing.js';
import { getFixedStarHits } from '../lib/fixedstars.js';
import { isDayChart, getHayz } from '../lib/sect.js';
import { getAntiscia } from '../lib/antiscia.js';
import useAppStore from '../store/useAppStore.js';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function SharedReadingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const chartPrefs = useAppStore(s => s.chartPrefs);

  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [transitDate, setTransitDate] = useState('');
  const [transitData, setTransitData] = useState(null);
  const [transitLoading, setTransitLoading] = useState(false);

  useEffect(() => {
    loadPublicReading(id).then((r) => {
      if (!r) setNotFound(true);
      else setReading(r);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-silver/70 text-sm">
        Loading reading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="text-copper-400 text-3xl font-serif">✦</div>
        <p className="text-bone/75 text-base">This reading is not available.</p>
        <p className="text-silver/40 text-sm">It may have been made private or the link may be incorrect.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 text-copper-400 hover:text-copper-300 text-sm transition-colors"
        >
          Cast your own reading →
        </button>
      </div>
    );
  }

  async function fetchTransits(date) {
    const loc = reading.dateTime?.location;
    if (!date || !loc) return;
    setTransitLoading(true);
    try {
      const res = await fetch('/api/ephemeris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time: '12:00:00',
          timezone: reading.dateTime?.timezone,
          location: loc,
          house_system: reading.dateTime?.houseSystem || 'Regiomontanus',
        }),
      });
      if (res.ok) setTransitData(await res.json());
    } finally {
      setTransitLoading(false);
    }
  }

  const strictures = getStrictures(reading.ephemerisSnapshot);
  const sections  = parseSections(reading.fullAnalysis);
  const style     = answerStyle(sections.answer);
  const date      = formatDate(reading.createdAt);
  const location  = reading.dateTime?.location;
  const warnings   = getChartWarnings(reading.ephemerisSnapshot);
  const dignities  = getPlanetaryDignities(reading.ephemerisSnapshot);
  const aspects    = getAspects(reading.ephemerisSnapshot);
  const { querentLord, quesitedLord } = getSignificators(reading.ephemerisSnapshot, reading.significations);
  const timing         = getTiming(aspects, querentLord, quesitedLord, reading.ephemerisSnapshot);
  const moonTestimony  = getMoonTestimony(aspects, reading.ephemerisSnapshot);
  const refranation    = getRefranation(aspects, querentLord, quesitedLord, reading.ephemerisSnapshot);
  const fixedStarHits  = getFixedStarHits(reading.ephemerisSnapshot);
  const antiscia       = getAntiscia(reading.ephemerisSnapshot);
  const snap           = reading.ephemerisSnapshot;
  const dayChart       = isDayChart(snap);
  const hayzMap        = Object.fromEntries(getHayz(snap).map(h => [h.planet, h]));
  const ascLonSnap     = parseFloat(snap?.houses?.ascendant) || 0;
  const SIGNS_SHARED   = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const ascSignSnap    = SIGNS_SHARED[Math.floor(((ascLonSnap % 360) + 360) % 360 / 30)];
  const ascDegSnap     = ((ascLonSnap % 30) + 30) % 30;
  const almuten        = ascSignSnap ? getAlmuten(ascSignSnap, ascDegSnap, dayChart) : null;
  const spirit         = getLotOfSpirit(snap);
  const perfection     = getPerfectionAspects(aspects, querentLord, quesitedLord);
  const translations = getTranslationOfLight(aspects, querentLord, quesitedLord);
  const collections  = getCollectionOfLight(aspects, querentLord, quesitedLord);
  const prohibitions = getProhibition(aspects, querentLord, quesitedLord);
  const allRecs    = getReceptions(reading.ephemerisSnapshot);
  const sigSet     = new Set([querentLord, quesitedLord, 'Moon'].filter(Boolean));
  const sigRecs    = allRecs.filter(r => sigSet.has(r.p1) && sigSet.has(r.p2));

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">

        {/* Brand header */}
        <div className="text-center mb-2">
          <button onClick={() => navigate('/')} className="group">
            <div className="text-copper-400 text-2xl font-serif group-hover:opacity-80 transition-opacity">✦</div>
            <p className="text-silver/40 text-xs tracking-widest uppercase mt-1">Aevum · Horary Astrology</p>
          </button>
        </div>

        {/* Question + meta */}
        <div className="text-center space-y-1">
          <p className="text-silver/70 text-xs uppercase tracking-widest">The Question</p>
          <p className="text-bone text-lg font-serif italic">"{reading.question}"</p>
          {(date || location) && (
            <p className="text-silver/40 text-xs">
              {[date, location].filter(Boolean).join(' · ')}
            </p>
          )}
          {(() => {
            const t = getTradition(reading.dateTime?.tradition);
            if (!t || t.id === 'classic') return null;
            return (
              <p className="text-copper-400/70 text-xs tracking-widest">
                {t.name} · {t.era}
              </p>
            );
          })()}
        </div>

        {/* Narrated teaching walkthrough — the booked-reading package */}
        {reading.packageSlides?.length > 0 && (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <p className="text-copper-400 text-xs uppercase tracking-[0.25em]">Your Personal Walkthrough</p>
              <p className="text-silver/50 text-xs">
                Eight slides, narrated for you — how your answer was found in the sky.
              </p>
            </div>
            <SlideDeck
              slides={reading.packageSlides}
              audioUrls={reading.packageAudio || {}}
              ephemerisData={reading.ephemerisSnapshot}
              significations={reading.significations}
              chartPrefs={chartPrefs}
            />
          </div>
        )}

        {/* Strictures against judgment */}
        {strictures.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-700/50 rounded-2xl px-5 py-4">
            <p className="text-amber-400 text-xs uppercase tracking-widest mb-3">Strictures Against Judgment</p>
            <ul className="space-y-2">
              {strictures.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-200/80 leading-relaxed">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Answer */}
        {sections.answer && (
          <div className={`rounded-2xl ring-1 ${style.ring} p-8 text-center shadow-lg`}
               style={{ background: 'rgba(13,13,31,0.85)' }}>
            <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">The Answer</p>
            <p className={`text-7xl font-serif font-bold tracking-wide ${style.text}`}>
              {sections.answer.toUpperCase()}
            </p>
          </div>
        )}

        {/* Chart wheel */}
        {reading.ephemerisSnapshot && (
          <>
            <WheelChart
              ephemerisData={reading.ephemerisSnapshot}
              houseSignifications={reading.significations}
              transitData={transitData}
              skipAnimation={true}
              prefs={chartPrefs}
            />
            {/* Transit date picker */}
            <div className="bg-teal-900/40 border border-teal-600/30 rounded-2xl px-5 py-4">
              <p className="text-silver/70 text-xs uppercase tracking-widest mb-2">Transit Date</p>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={transitDate}
                  onChange={e => { setTransitDate(e.target.value); fetchTransits(e.target.value); }}
                  className="bg-teal-900/60 border border-teal-600 rounded-xl px-3 py-2
                             text-bone/90 text-xs focus:outline-none focus:border-copper-400/60"
                />
                {transitLoading && <span className="text-silver/70 text-xs">Loading…</span>}
                {transitData && !transitLoading && (
                  <span className="text-silver/40 text-xs">Blue = transits</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* What this means */}
        {sections.meaning && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl p-7 backdrop-blur-sm">
            <h3 className="text-copper-400 text-xs uppercase tracking-widest mb-5">
              What This Means
            </h3>
            <div className="space-y-4">
              {sections.meaning.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                <p key={i} className="text-bone/75 leading-relaxed text-sm"
                   dangerouslySetInnerHTML={{ __html: formatInline(para.trim()) }} />
              ))}
            </div>
          </div>
        )}

        {/* What the stars show */}
        {sections.stars && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl p-7 backdrop-blur-sm">
            <h3 className="text-copper-400 text-xs uppercase tracking-widest mb-5">
              What The Stars Show
            </h3>
            <ul className="space-y-4">
              {parseBullets(sections.stars).map((bullet, i) => (
                <li key={i} className="flex gap-3 text-sm text-bone/75 leading-relaxed">
                  <span className="text-copper-400 mt-0.5 shrink-0">✦</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(bullet) }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chart notes — perfection aspects + warnings */}
        {((chartPrefs.showTiming && timing) ||
          (chartPrefs.showAlmuten && almuten) ||
          (chartPrefs.showMoonTestimony && (moonTestimony.last || moonTestimony.next)) ||
          (chartPrefs.showPerfectionAspects && perfection.length > 0) ||
          (chartPrefs.showTranslation && translations.length > 0) ||
          (chartPrefs.showCollection && collections.length > 0) ||
          (chartPrefs.showProhibition && prohibitions.length > 0) ||
          (chartPrefs.showReception && sigRecs.length > 0) ||
          (chartPrefs.showRefranation && refranation) ||
          (chartPrefs.showFixedStars && fixedStarHits.length > 0) ||
          (chartPrefs.showAntiscia && antiscia.length > 0) ||
          (chartPrefs.showWarnings && warnings.length > 0)) && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-6 py-4">
            <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Chart Notes</p>
            <ul className="space-y-2">
              {chartPrefs.showTiming && timing && (
                <li className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-copper-400 shrink-0 mt-0.5">◷</span>
                  <span className="text-bone/90">
                    ~{timing.estimate} {timing.unit}
                    <span className="text-silver/70 ml-1">
                      — {timing.faster} in {timing.sign} ({timing.mode}) applies to {timing.aspect.p1 === timing.faster ? timing.aspect.p2 : timing.aspect.p1} by {timing.aspect.aspect.toLowerCase()} ({timing.estimate}°)
                    </span>
                  </span>
                </li>
              )}
              {chartPrefs.showAlmuten && almuten && (
                <li className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-copper-400 shrink-0 mt-0.5">⊕</span>
                  <span className="text-bone/75">
                    Almuten of ASC: <span className="text-copper-400 font-medium">{almuten.planet}</span>
                    <span className="text-silver/70"> (score {almuten.score}) — {dayChart ? 'day' : 'night'} chart</span>
                  </span>
                </li>
              )}
              {chartPrefs.showMoonTestimony && moonTestimony.last && (
                <li className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-silver/70 shrink-0 mt-0.5">☽</span>
                  <span className="text-silver/70">
                    Moon separated from {moonTestimony.last.p1 === 'Moon' ? moonTestimony.last.p2 : moonTestimony.last.p1} by {moonTestimony.last.aspect.toLowerCase()} ({moonTestimony.last.orb}°) — what has passed
                  </span>
                </li>
              )}
              {chartPrefs.showMoonTestimony && moonTestimony.next && (() => {
                const other = moonTestimony.next.p1 === 'Moon' ? moonTestimony.next.p2 : moonTestimony.next.p1;
                const moonSign = snap?.planets?.Moon?.sign;
                const mode = SIGN_MODES[moonSign];
                const unit = mode ? MODE_UNITS[mode] : null;
                return (
                  <li className="flex items-start gap-2 text-xs leading-relaxed">
                    <span className="text-sky-300 shrink-0 mt-0.5">☽</span>
                    <span className="text-bone/75">
                      Moon applies to {other} by {moonTestimony.next.aspect.toLowerCase()} ({moonTestimony.next.orb}°)
                      {unit && <span className="text-silver/70"> — ~{moonTestimony.next.orb} {unit}</span>}
                    </span>
                  </li>
                );
              })()}
              {chartPrefs.showPerfectionAspects && perfection.map((a, i) => (
                <li key={`perf-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={a.applying ? 'text-copper-400 shrink-0 mt-0.5' : 'text-silver/70 shrink-0 mt-0.5'}>
                    {a.applying ? '✦' : '◇'}
                  </span>
                  <span className={a.applying ? 'text-bone/75' : 'text-silver/70'}>
                    {a.p1} {a.applying ? 'applies to' : 'separates from'} {a.p2} by {a.aspect.toLowerCase()} ({a.orb}°)
                    {a.p1 === querentLord || a.p2 === querentLord
                      ? a.p1 === quesitedLord || a.p2 === quesitedLord
                        ? ' — significator perfection'
                        : ''
                      : ''}
                  </span>
                </li>
              ))}
              {chartPrefs.showCollection && collections.map((c, i) => (
                <li key={`col-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-emerald-400 shrink-0 mt-0.5">⟐</span>
                  <span className="text-bone/75">
                    {c.collector} collects light from {querentLord} and {quesitedLord}
                    {' '}({querentLord} {c.querentAspect.abbr} {c.querentAspect.orb}°, {quesitedLord} {c.quesitedAspect.abbr} {c.quesitedAspect.orb}°)
                  </span>
                </li>
              ))}
              {chartPrefs.showProhibition && prohibitions.map((p, i) => (
                <li key={`proh-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-red-400 shrink-0 mt-0.5">⊗</span>
                  <span className="text-silver">
                    {p.prohibitor} prohibits — perfects with {p.target} ({p.aspect.abbr} {p.aspect.orb}°)
                    {' '}before {querentLord}–{quesitedLord} ({p.sigAspect.abbr} {p.sigAspect.orb}°)
                  </span>
                </li>
              ))}
              {chartPrefs.showTranslation && translations.map((t, i) => (
                <li key={`tol-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-sky-400 shrink-0 mt-0.5">↝</span>
                  <span className="text-bone/75">
                    {t.translator} translates light from {t.from} to {t.to}
                    {' '}(separates {t.separatingAspect.abbr} {t.separatingAspect.orb}° → applies {t.applyingAspect.abbr} {t.applyingAspect.orb}°)
                  </span>
                </li>
              ))}
              {chartPrefs.showReception && sigRecs.map((r, i) => (
                <li key={`rec-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={r.mutual ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-silver/70 shrink-0 mt-0.5'}>
                    {r.mutual ? '⇄' : '→'}
                  </span>
                  <span className={r.mutual ? 'text-bone/75' : 'text-silver/70'}>
                    {receptionLabel(r, aspects)}
                  </span>
                </li>
              ))}
              {chartPrefs.showRefranation && refranation && (
                <li className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-red-400 shrink-0 mt-0.5">⊘</span>
                  <span className="text-red-300">
                    Refranation — {refranation.planet} is applying ({refranation.aspect.aspect.toLowerCase()} {refranation.aspect.orb}°)
                    but near stationary ({refranation.speed}°/day) — may station and pull back before perfection
                  </span>
                </li>
              )}
              {chartPrefs.showFixedStars && fixedStarHits.map((h, i) => (
                <li key={`star-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={h.nature === 'malefic' ? 'text-red-400 shrink-0 mt-0.5' : 'text-copper-400 shrink-0 mt-0.5'}>★</span>
                  <span className={h.nature === 'malefic' ? 'text-red-300' : 'text-bone/75'}>
                    {h.planet} conjunct {h.star} ({h.orb}°) — {h.gloss}
                  </span>
                </li>
              ))}
              {chartPrefs.showAntiscia && antiscia.map((a, i) => (
                <li key={`anti-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-violet-300 shrink-0 mt-0.5">⟂</span>
                  <span className="text-bone/75">
                    {a.p1} {a.type === 'antiscia' ? 'antiscia' : 'contra-antiscia'} {a.p2}
                    <span className="text-silver/70"> ({a.orb}° from {a.sign} {Math.floor(a.degree)}°)</span>
                  </span>
                </li>
              ))}
              {chartPrefs.showWarnings && warnings.map((w, i) => (
                <li key={`warn-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={
                    w.severity === 'positive' ? 'text-emerald-400 shrink-0 mt-0.5' :
                    w.severity === 'severe'   ? 'text-red-400 shrink-0 mt-0.5' :
                    w.severity === 'mild'     ? 'text-amber-400 shrink-0 mt-0.5' :
                                                'text-blue-400 shrink-0 mt-0.5'
                  }>
                    {w.severity === 'positive' ? '★' :
                     w.severity === 'severe'   ? '⚠' :
                     w.severity === 'mild'     ? '◎' : '◌'}
                  </span>
                  <span className="text-silver">{w.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What to do next */}
        {sections.next && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl p-7 backdrop-blur-sm">
            <h3 className="text-copper-400 text-xs uppercase tracking-widest mb-5">
              What To Do Next
            </h3>
            <ol className="space-y-4">
              {parseNumbered(sections.next).map((step, i) => (
                <li key={i} className="flex gap-4 text-sm text-bone/75 leading-relaxed">
                  <span className="text-copper-400 font-semibold shrink-0 w-5 text-right">{i + 1}.</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(step) }} />
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Full aspects table */}
        {chartPrefs.showAspectsTable && aspects.length > 0 && (() => {
          const sigSet = new Set([querentLord, quesitedLord, 'Moon'].filter(Boolean));
          const sorted = [...aspects].sort((a, b) => {
            const aSig = sigSet.has(a.p1) && sigSet.has(a.p2);
            const bSig = sigSet.has(b.p1) && sigSet.has(b.p2);
            if (aSig !== bSig) return aSig ? -1 : 1;
            if (a.applying !== b.applying) return a.applying ? -1 : 1;
            return a.orb - b.orb;
          });
          return (
            <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-6 py-5">
              <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Aspects</p>
              <div className="space-y-1.5">
                {sorted.map((a, i) => {
                  const isSig = sigSet.has(a.p1) && sigSet.has(a.p2);
                  return (
                    <div key={i}
                         className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs
                           ${isSig ? 'bg-copper-400/10 border border-copper-400/20' : 'bg-teal-900/40'}`}>
                      <span className={isSig ? 'text-bone/90 w-36 shrink-0' : 'text-silver w-36 shrink-0'}>
                        {a.p1} – {a.p2}
                      </span>
                      <span className="text-silver/70 w-14 shrink-0">{a.abbr ?? a.aspect.slice(0,3)}</span>
                      <span className="text-silver/70 w-10 shrink-0">{a.orb}°</span>
                      <span className={a.applying ? 'text-copper-400 font-medium' : 'text-silver/40'}>
                        {a.applying ? 'Applying' : 'Separating'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Reception table */}
        {chartPrefs.showReceptionTable && allRecs.length > 0 && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-6 py-5">
            <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Reception</p>
            <div className="space-y-1.5">
              {allRecs.map((r, i) => {
                const isSig = sigSet.has(r.p1) && sigSet.has(r.p2);
                return (
                  <div key={i}
                       className={`rounded-lg px-3 py-2 text-xs leading-relaxed
                         ${isSig ? 'bg-copper-400/10 border border-copper-400/20 text-bone/90'
                                 : 'bg-teal-900/40 text-silver'}`}>
                    {receptionLabel(r, aspects)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Planetary dignities */}
        {chartPrefs.showDignitiesTable && dignities.length > 0 && (
          <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-6 py-5">
            <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Planetary Dignities</p>
            <div className="space-y-1.5">
              {dignities.map(({ planet, sign, degree, dignity }) => (
                <div key={planet}
                     className="flex items-center justify-between bg-teal-900/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-silver w-16 shrink-0">{planet}</span>
                  <span className="text-silver/70 flex-1">{sign} {Math.floor(degree)}°</span>
                  {chartPrefs.showHayz && hayzMap[planet]?.hayz && (
                    <span className="text-amber-400 text-[10px] mr-2 shrink-0">Hayz</span>
                  )}
                  <span className={`font-medium ${dignityColor(dignity.type)}`}>
                    {dignity.label}
                    {dignity.extra.length > 0 && (
                      <span className="text-silver/40 font-normal"> (+{dignity.extra.join(', ')})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arabic Parts */}
        {(() => {
          const fortune = getLotOfFortune(reading.ephemerisSnapshot);
          if (!fortune && !spirit) return null;
          return (
            <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl px-6 py-4">
              <p className="text-silver/70 text-xs uppercase tracking-widest mb-2">Arabic Parts</p>
              <div className="space-y-1.5">
                {fortune && chartPrefs.showLotOfFortune !== false && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-silver/70">Part of Fortune</span>
                    <span className="text-bone/75">{fortune.sign} {fortune.degree}° · {fortune.lord}</span>
                  </div>
                )}
                {spirit && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-silver/70">Part of Spirit</span>
                    <span className="text-bone/75">{spirit.sign} {spirit.degree}° · {spirit.lord}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* CTA */}
        <div className="bg-teal-900/40 border border-teal-600/30 rounded-2xl p-6 text-center space-y-3">
          <div className="text-copper-400 text-xl font-serif">✦</div>
          <p className="text-bone/75 text-sm">Have a question of your own?</p>
          <p className="text-silver/70 text-xs leading-relaxed">
            Aevum casts a chart for the moment you ask and reads the heavens for an answer.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 inline-block bg-copper-400 hover:bg-copper-300 text-teal-900
                       font-semibold text-sm px-6 py-2.5 rounded-xl transition-all"
          >
            Cast your own reading →
          </button>
        </div>

      </div>
    </div>
  );
}
