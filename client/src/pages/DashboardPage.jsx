// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator.jsx';
import ChartDisplay from '../components/ChartDisplay.jsx';
import SquareChart from '../components/SquareChart.jsx';
import Astrolabe from '../components/Astrolabe.jsx';
import LoadingProgress from '../components/LoadingProgress.jsx';
import FollowUpChat from '../components/FollowUpChat.jsx';
import DashboardTab from '../components/dashboard/DashboardTab.jsx';
import ArchivesTab from '../components/dashboard/ArchivesTab.jsx';
import LearningTab from '../components/dashboard/LearningTab.jsx';
import ThemesTab from '../components/dashboard/ThemesTab.jsx';
import JournalPanel from '../components/JournalPanel.jsx';
import ReadingPackagePanel from '../components/ReadingPackagePanel.jsx';
import useAppStore from '../store/useAppStore.js';
import { buildReadingFilename } from '../lib/filename.js';
import { saveReading, hasConsented, shareReading, getIdToken, clearDraft } from '../lib/firebase.js';
import { streamSSE } from '../lib/sse.js';
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
import ChartCustomizeModal from '../components/ChartCustomizeModal.jsx';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { isPractitioner } from '../lib/package.js';

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const HOUSE_SCORES = {
  1: 5, 10: 5,
  4: 4, 7: 4,
  11: 3, 5: 3, 2: 3,
  9: 2,
  3: 1,
  6: -2, 8: -2,
  12: -5
};

const MEAN_SPEEDS = {
  Sun: 0.986,
  Moon: 13.176,
  Mercury: 0.983,
  Venus: 0.983,
  Mars: 0.524,
  Jupiter: 0.083,
  Saturn: 0.033
};

const MOIETIES = {
  Sun: 7.5,
  Moon: 6.0,
  Saturn: 4.5,
  Jupiter: 4.5,
  Mars: 4.0,
  Venus: 4.0,
  Mercury: 3.5
};

function getEclipticLon(p) {
  const signs = ZODIAC_SIGNS;
  const idx = signs.indexOf(p.sign);
  return ((idx < 0 ? 0 : idx) * 30) + (p.sign_degree || 0);
}

function getMoiety(p1, p2) {
  const m1 = MOIETIES[p1] || 0;
  const m2 = MOIETIES[p2] || 0;
  return m1 + m2;
}

function calculateLillyAccidentalDignity(ephemerisData) {
  if (!ephemerisData?.planets) return {};
  const { planets } = ephemerisData;
  const hayzList = getHayz(ephemerisData);
  const hayzMap = Object.fromEntries(hayzList.map(h => [h.planet, h]));
  const sun = planets.Sun;
  const sunLon = sun ? getEclipticLon(sun) : 0;
  
  const results = {};
  
  for (const name of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const p = planets[name];
    if (!p) continue;
    
    const conditions = [];
    let score = 0;
    
    // 1. House Position
    const houseNum = parseInt(p.house) || 1;
    const houseScore = HOUSE_SCORES[houseNum] || 0;
    score += houseScore;
    if (houseScore > 0) {
      conditions.push(`House ${houseNum} (+${houseScore})`);
    } else if (houseScore < 0) {
      conditions.push(`House ${houseNum} (${houseScore})`);
    } else {
      conditions.push(`House ${houseNum} (0)`);
    }
    
    // 2. Direct / Retrograde
    if (name !== 'Sun' && name !== 'Moon') {
      if (p.is_retrograde) {
        score -= 5;
        conditions.push(`Retrograde (-5)`);
      } else {
        score += 4;
        conditions.push(`Direct (+4)`);
      }
    }
    
    // 3. Sun Proximity
    if (name !== 'Sun') {
      const pLon = getEclipticLon(p);
      let dist = Math.abs(pLon - sunLon);
      if (dist > 180) dist = 360 - dist;
      
      if (dist <= 0.283) { // 17'
        score += 5;
        conditions.push(`Cazimi (+5)`);
      } else if (dist <= 8.5) {
        score -= 5;
        conditions.push(`Combust (-5)`);
      } else if (dist <= 17) {
        score -= 4;
        conditions.push(`Under Beams (-4)`);
      }
    }
    
    // 4. Hayz
    const hayzItem = hayzMap[name];
    if (hayzItem?.hayz) {
      score += 2;
      conditions.push(`Hayz (+2)`);
    }
    
    // 5. Speed
    const meanSpeed = MEAN_SPEEDS[name];
    const speedVal = Math.abs(p.daily_speed || 0);
    if (meanSpeed) {
      if (speedVal > meanSpeed) {
        score += 2;
        conditions.push(`Swift (+2)`);
      } else {
        score -= 2;
        conditions.push(`Slow (-2)`);
      }
    }
    
    results[name] = { score, conditions };
  }
  
  return results;
}

function getSignificatorDescription(name, ephemerisData, accidentalDignities, essentialDignities) {
  if (!ephemerisData || !name) return 'N/A';
  const p = ephemerisData.planets[name];
  if (!p) return 'N/A';
  const ess = essentialDignities.find(d => d.planet === name);
  const acc = accidentalDignities[name];
  
  const sign = p.sign;
  const deg = Math.floor(p.sign_degree || 0);
  const min = Math.floor(((p.sign_degree || 0) % 1) * 60);
  const house = p.house;
  
  const essLabel = ess ? ess.dignity.label : 'Peregrine';
  const accScore = acc ? acc.score : 0;
  const signText = `${deg}°${min}' ${sign}`;
  
  return `${name} in ${signText} in the ${house}${house === 1 ? 'st' : house === 2 ? 'nd' : house === 3 ? 'rd' : 'th'} House. Status: ${essLabel} (Essential ${ess?.dignity.score || 0}), Accidental score: ${accScore >= 0 ? '+' : ''}${accScore}.`;
}




export default function ResultsPage() {
  const navigate = useNavigate();
  const {
    question, questionType, dateTimeData, setDateTimeData, houseSignifications,
    ephemerisData, setEphemerisData,
    analysis, appendAnalysis, setAnalysis,
    readingId, setReadingId,
    interviewMessages,
    resetAll,
    chartPrefs,
  } = useAppStore();

  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  // Staggered reveal: 0=hidden, 1=answer, 2=meaning, 3=stars, 4=next
  const [stage, setStage] = useState(0);
  const [showConsentNudge, setShowConsentNudge] = useState(false);
  const [shareState, setShareState] = useState('idle'); // idle | copying | copied | error
  const [citations, setCitations] = useState([]);
  const readingRef = useRef(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(() => {
    try { return getAuth().currentUser; } catch { return null; }
  });

  useEffect(() => {
    let unsub;
    try { unsub = onAuthStateChanged(getAuth(), u => setCurrentUser(u)); } catch {}
    return () => unsub?.();
  }, []);

  const sections = parseSections(analysis);
  const practitioner = isPractitioner(currentUser);

  const aspects = useMemo(() => getAspects(ephemerisData), [ephemerisData]);
  const { querentLord, quesitedLord } = useMemo(
    () => getSignificators(ephemerisData, houseSignifications),
    [ephemerisData, houseSignifications]
  );
  const allRecs = useMemo(() => getReceptions(ephemerisData), [ephemerisData]);
  const sigSet  = useMemo(
    () => new Set([querentLord, quesitedLord, 'Moon'].filter(Boolean)),
    [querentLord, quesitedLord]
  );
  const strictures = useMemo(() => getStrictures(ephemerisData), [ephemerisData]);

  const lillyAccidentalDignities = useMemo(() => {
    return calculateLillyAccidentalDignity(ephemerisData);
  }, [ephemerisData]);

  const essentialDignities = useMemo(() => {
    return getPlanetaryDignities(ephemerisData);
  }, [ephemerisData]);

  // Trigger staggered reveal once the full analysis arrives
  useEffect(() => {
    if (!sections.answer) return;
    readingRef.current?.scrollIntoView({ behavior: 'smooth' });
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 600);
    const t2 = setTimeout(() => setStage(3), 1200);
    const t3 = setTimeout(() => setStage(4), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [!!sections.answer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!question || !houseSignifications) {
      navigate('/ask');
      return;
    }
    if (ephemerisData && analysis && sections.answer) {
      setPhase('done');
      setStage(4);
      return;
    }
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setPhase('fetching-chart');
    setError('');
    setAnalysis('');
    setStage(0);

    let chartData = ephemerisData;
    if (!chartData) {
      try {
        const res = await fetch('/api/ephemeris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateTimeData.date,
            time: dateTimeData.time + ':00',
            timezone: dateTimeData.timezone,
            location: dateTimeData.location,
            latitude: dateTimeData.latitude || null,
            longitude: dateTimeData.longitude || null,
            topocentric: true,
            elevation: 0.0,
            house_system: dateTimeData.houseSystem || 'Regiomontanus',
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Ephemeris service failed');
        }
        chartData = await res.json();
        setEphemerisData(chartData);

        // Save resolved coordinates back to the store if they weren't already there
        if (chartData.chart_meta && chartData.chart_meta.resolved_latitude && chartData.chart_meta.resolved_longitude) {
          setDateTimeData({
            latitude: chartData.chart_meta.resolved_latitude,
            longitude: chartData.chart_meta.resolved_longitude
          });
        }
      } catch (e) {
        setError(e.message);
        setPhase('error');
        return;
      }
    }

    setPhase('analyzing');
    const idToken = await getIdToken();
    await streamSSE(
      '/api/chat/analyze',
      { question, houseSignifications, ephemerisData: chartData, tradition: dateTimeData.tradition || 'classic', questionType: questionType || 'perfection' },
      {
        onText: (text) => appendAnalysis(text),
        onDone: (data) => { setCitations(data?.citations || []); setPhase('done'); },
        onError: (err) => { setError(err); setPhase('error'); },
      },
      idToken ? { Authorization: `Bearer ${idToken}` } : {}
    );
}


  function handleNewReading() {
    resetAll();
    navigate('/ask');
  }

  async function handleShare() {
    if (!readingId) return;
    setShareState('copying');
    await shareReading(readingId);
    const url = `${window.location.origin}/reading/${readingId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch {
      setShareState('error');
      setTimeout(() => setShareState('idle'), 2500);
    }
  }

  function handlePrint() {
    const original = document.title;
    document.title = buildReadingFilename({ dateTimeData, houseSignifications });
    window.print();
    // Restore after the print dialog settles
    setTimeout(() => { document.title = original; }, 1000);
  }

  // Persist the reading to Firestore once the full reading is in hand
  useEffect(() => {
    if (phase !== 'done') return;
    if (!sections.answer || readingId) return;

    (async () => {
      // Single-user mode for now — always save, no opt-in/out gate.
      const id = await saveReading({
        question,
        dateTime: dateTimeData,
        significations: houseSignifications,
        interviewMessages,
        answer: sections.answer,
        fullAnalysis: analysis,
        ephemerisSnapshot: ephemerisData,
        citations,
      });
      if (id) {
        setReadingId(id);
        // Reading is durably saved now — the in-progress draft is no longer needed.
        clearDraft();
        // Nudge user toward consent settings if they haven't seen it yet
        const already = await hasConsented();
        if (!already) setShowConsentNudge(true);
      }
    })();
}, [phase, sections.answer, readingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWaiting = phase === 'analyzing' && !sections.answer;
  const isDone = phase === 'done';
  const showReading = sections.answer != null;

  // Full-page loader while the chart/analysis is being prepared, before the
  // dashboard chrome (sidebar, header, tabs) mounts. No animation — a static
  // progress bar with rotating astrologer phrases (Dolores's directive).
  // Errors still fall through to the dashboard so the existing error UI shows.
  if (phase === 'idle' || phase === 'fetching-chart' || (phase === 'analyzing' && !sections.answer)) {
    return (
      <LoadingProgress
        label={phase === 'fetching-chart' ? 'Erecting the Moment of Reception…' : 'Judgment is being prepared…'}
      />
    );
  }

  return (
    <div className="min-h-screen flex font-sans text-bone print:block print:bg-white print:text-black">
      <ChartCustomizeModal open={showCustomize} onClose={() => setShowCustomize(false)} />
      
      {/* Sidebar Navigation */}
      <aside className="w-24 border-r border-teal-800/30 flex flex-col h-screen sticky top-0 shrink-0 screen-only backdrop-blur-md bg-teal-950/40 shadow-2xl">
        <div className="p-4 flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full border border-copper-400/50 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(190,107,61,0.3)]" onClick={() => navigate('/')}>
            <span className="text-copper-400 font-serif text-xl">✦</span>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-2 w-full mt-4">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z' },
            { id: 'readings', label: 'Readings', icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
            { id: 'archives', label: '[change later]', icon: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z' },
            { id: 'learning', label: 'Community', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
            { id: 'themes', label: 'Settings', icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex flex-col items-center justify-center gap-1.5 py-4 transition-all relative ${
                activeTab === tab.id 
                  ? 'text-copper-400 bg-gradient-to-r from-copper-900/40 to-transparent' 
                  : 'text-silver/60 hover:text-bone hover:bg-teal-800/30'
              }`}
            >
              {activeTab === tab.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-copper-400 shadow-[0_0_10px_#BE6B3D]"></div>
              )}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d={tab.icon}/>
              </svg>
              <span className="text-[10px] uppercase tracking-wider font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-teal-800/30">
          <button onClick={handleNewReading} className="w-12 h-12 mx-auto flex items-center justify-center bg-teal-800/50 hover:bg-copper-900/60 hover:text-copper-400 text-bone rounded-full transition-colors border border-teal-700/50">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-hidden print:p-0">
        
        {/* Top Header Row */}
        <header className="w-full flex items-center justify-between px-10 py-6 screen-only border-b border-teal-800/30 bg-teal-950/20 backdrop-blur-sm z-10 shrink-0">
          <div className="text-copper-400/80 text-sm tracking-[0.2em] uppercase font-serif">
            Astrology Portal
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h2 className="text-2xl font-serif text-bone tracking-[0.1em] uppercase">Your Astrology Reading</h2>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative text-silver hover:text-bone transition-colors">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M4 19v-2h2v-7C6 6.69 8.31 4 11 4v-1h2v1c2.69 0 5 2.69 5 6v7h2v2H4zm8 3c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z"/></svg>
              <div className="absolute top-0 right-0 w-2 h-2 bg-copper-500 rounded-full border border-teal-950"></div>
            </button>
            <div className="w-8 h-8 rounded-full bg-teal-800 border-2 border-copper-400/50 flex items-center justify-center text-xs overflow-hidden cursor-pointer">
              <svg className="w-full h-full fill-silver/50 pt-2" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto px-10 py-6 custom-scrollbar z-0 relative">
          {ephemerisData && (
            <div className="w-full max-w-7xl mx-auto flex justify-center text-center mb-8">
              <div className="inline-flex gap-2 text-silver/60 text-sm">
                <span>Querent</span>
                <span className="text-silver/40">|</span>
                <span>{dateTimeData?.date} {dateTimeData?.time}</span>
                <span className="text-silver/40">|</span>
                <span>{dateTimeData?.location || 'Unknown Location'}</span>
              </div>
            </div>
          )}

          <div className="max-w-[1600px] mx-auto w-full relative">
          
          {activeTab === 'dashboard' && (
            <DashboardTab 
              question={question} 
              sections={sections} 
              ephemerisData={ephemerisData} 
              houseSignifications={houseSignifications} 
              chartPrefs={chartPrefs} 
              isWaiting={isWaiting}
            />
          )}

          {activeTab === 'themes' && <ThemesTab />}
          {activeTab === 'learning' && <LearningTab ephemerisData={ephemerisData} readingId={readingId} chartPrefs={chartPrefs} houseSignifications={houseSignifications} />}
          {activeTab === 'archives' && <ArchivesTab />}

          {activeTab === 'readings' && (
            <div className="screen-only w-full">
              <StepIndicator current={4} />

              <div className="text-center mb-10">
                <p className="text-silver/70 text-xs uppercase tracking-widest mb-2">Your Petition</p>
                <p className="text-bone/90 text-lg font-serif italic">"{question}"</p>
                {(() => {
                  const t = getTradition(dateTimeData.tradition);
                  if (!t || t.id === 'classic') return null;
                  return (
                    <p className="mt-2 text-copper-400/70 text-xs tracking-widest">
                      {t.name} · {t.era}
                    </p>
                  );
                })()}
              </div>

        {/* NOTE: phase === 'fetching-chart' and isWaiting (analyzing && !answer) never
            reach this point — the early-return LoadingProgress screen above the main
            return handles both. This dead branch (previously rendering Astrolabe as a
            "loading animation") was removed; Astrolabe is still used for the print-only
            wheel-chart view further below. */}

        {/* Error state */}
        {phase === 'error' && (
          <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 text-center">
            <p className="text-2xl mb-3">
              {/upgrade|limit|plan|tradition/i.test(error) ? '🔒' : '⚠'}
            </p>
            <p className="text-red-400 mb-5 text-sm leading-relaxed">{error}</p>
            {/upgrade|limit|plan|tradition/i.test(error) ? (
              <a
                href="/upgrade"
                className="inline-block px-6 py-2.5 bg-copper-400 text-teal-900 font-semibold rounded-xl text-sm hover:bg-copper-300"
              >
                View Plans
              </a>
            ) : (
              <button
                onClick={run}
                className="px-6 py-2.5 bg-copper-400 text-teal-900 font-semibold rounded-xl text-sm hover:bg-copper-300"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* PAYWALL — shown when chart is ready, for non-practitioners */}
        {showReading && !practitioner && (
          <div className="w-full mt-4 screen-only space-y-6">
            {/* Show the chart square so they can see THEIR data before paying */}
            <SquareChart
              ephemerisData={ephemerisData}
              houseSignifications={houseSignifications}
              skipAnimation={true}
              prefs={chartPrefs}
            />
            <div className="bg-teal-800/60 border border-copper-400/30 rounded-2xl px-6 py-8 text-center">
              <p className="text-copper-400 text-xs uppercase tracking-widest mb-3">Moment of Reception Cast</p>
              <p className="text-bone text-2xl font-serif italic mb-3">The Case Study is ready.</p>
              <p className="text-silver/70 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
                Commission a personalized Practitioner Case Study & Narrated Walkthrough — containing a written verdict, significator walk-through, and a 9-slide astronomical exposition deck delivered within 72 hours.
              </p>
              <a
                href="/upgrade"
                className="inline-block px-8 py-3 bg-copper-400 hover:bg-copper-300 text-teal-900
                           font-semibold rounded-xl transition-colors text-base"
              >
                Commission Case Study — $88
              </a>
              <p className="text-silver/40 text-xs mt-4">Founder rate · First 22 case studies only</p>
            </div>
          </div>
        )}

        {/* THE READING — sections fade in sequentially via stage — practitioners only */}
        {showReading && practitioner && (
          <div ref={readingRef} className="space-y-6">

            {/* Strictures against judgment — shown before the answer */}
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

            {/* 1. THE ANSWER */}
            {(() => {
              const style = answerStyle(sections.answer);
              const trad = getTradition(dateTimeData.tradition);
              const methodName = trad && trad.id !== 'classic' ? `${trad.name}'s method` : 'the traditional method';
              return (
                <div className={`rounded-2xl ring-1 ${style.ring} p-5 sm:p-8 text-center shadow-lg
                                transition-all duration-700
                                ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                     style={{ background: 'rgba(13,13,31,0.85)' }}>
                  <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Traditional Case Judgment Report</p>
                  <p className="text-copper-400/80 text-xs sm:text-sm italic mb-4">
                    Evaluated by {methodName}, the celestial simulation is judged:
                  </p>
                  <p className={`text-5xl sm:text-7xl font-serif font-bold tracking-wide ${style.text}`}>
                    {sections.answer.toUpperCase()}
                  </p>
                  <p className="text-silver/40 text-[11px] leading-relaxed mt-5 max-w-md mx-auto">
                    A reconstruction of historical horary methods and the 17th-century simulation engine for educational case-study purposes — not a prediction of future events.
                  </p>
                </div>
              );
            })()}

            {/* 2. WHAT THIS MEANS FOR YOU */}
            {sections.meaning && (
              <div className={`bg-teal-700/70 border border-teal-600/40 rounded-2xl p-4 sm:p-7 backdrop-blur-sm
                              transition-all duration-700
                              ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                <h3 className="text-copper-400 text-xs uppercase tracking-widest mb-5">
                  What This Means For You
                </h3>
                <div className="space-y-4">
                  {sections.meaning.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                    <p key={i} className="text-bone/75 leading-relaxed text-sm"
                       dangerouslySetInnerHTML={{ __html: formatInline(para.trim()) }} />
                  ))}
                </div>
              </div>
            )}

            {/* 3. WHAT THE STARS SHOW */}
            {sections.stars && (
              <div className={`bg-teal-700/70 border border-teal-600/40 rounded-2xl p-7 backdrop-blur-sm
                              transition-all duration-700
                              ${stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
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

            {/* 3b. CHART NOTES — combustion, void-of-course */}
            {(() => {
              const warnings = getChartWarnings(ephemerisData);
              const perfection = getPerfectionAspects(aspects, querentLord, quesitedLord);
              const translations = getTranslationOfLight(aspects, querentLord, quesitedLord);
              const collections  = getCollectionOfLight(aspects, querentLord, quesitedLord);
              const prohibitions = getProhibition(aspects, querentLord, quesitedLord);
              const timing = getTiming(aspects, querentLord, quesitedLord, ephemerisData);
              const moonTestimony = getMoonTestimony(aspects, ephemerisData);
              const refranation = getRefranation(aspects, querentLord, quesitedLord, ephemerisData);
              const fixedStarHits = getFixedStarHits(ephemerisData);
              const antiscia = getAntiscia(ephemerisData);
              const dayChart = isDayChart(ephemerisData);
              const ascLon = parseFloat(ephemerisData?.houses?.ascendant) || 0;
              const ascSign = ZODIAC_SIGNS[Math.floor(((ascLon % 360) + 360) % 360 / 30)];
              const ascDeg = (ascLon % 30 + 30) % 30;
              const almuten = ascSign ? getAlmuten(ascSign, ascDeg, dayChart) : null;
              const sigRecs = allRecs.filter(r => sigSet.has(r.p1) && sigSet.has(r.p2));
              const anyVisible =
                (chartPrefs.showTiming            && timing != null) ||
                (chartPrefs.showAlmuten           && almuten != null) ||
                (chartPrefs.showMoonTestimony     && (moonTestimony.last || moonTestimony.next)) ||
                (chartPrefs.showPerfectionAspects && perfection.length > 0) ||
                (chartPrefs.showCollection        && collections.length > 0) ||
                (chartPrefs.showProhibition       && prohibitions.length > 0) ||
                (chartPrefs.showTranslation       && translations.length > 0) ||
                (chartPrefs.showReception         && sigRecs.length > 0) ||
                (chartPrefs.showRefranation       && refranation != null) ||
                (chartPrefs.showFixedStars        && fixedStarHits.length > 0) ||
                (chartPrefs.showAntiscia          && antiscia.length > 0) ||
                (chartPrefs.showWarnings          && warnings.length > 0);
              if (!anyVisible || stage < 3) return null;
              return (
                <div className={`border border-teal-600/30 rounded-2xl overflow-hidden
                                transition-all duration-700
                                ${stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                  <button
                    onClick={() => setShowWarnings((v) => !v)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left
                               bg-teal-900/40 hover:bg-teal-900/40 transition-colors"
                  >
                    <span className="text-silver/70 text-xs uppercase tracking-widest">Chart Notes</span>
                    <span className="text-silver/70 text-sm">{showWarnings ? '▲' : '▼'}</span>
                  </button>
                  {showWarnings && (
                    <ul className="px-6 py-4 bg-teal-900/20 border-t border-teal-600/30 space-y-2">
                      {/* Timing estimate */}
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
                      {/* Almuten of ASC */}
                      {chartPrefs.showAlmuten && almuten && (
                        <li className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-copper-400 shrink-0 mt-0.5">⊕</span>
                          <span className="text-bone/75">
                            Almuten of ASC: <span className="text-copper-400 font-medium">{almuten.planet}</span>
                            <span className="text-silver/70"> (score {almuten.score}) — {dayChart ? 'day' : 'night'} chart</span>
                          </span>
                        </li>
                      )}
                      {/* Moon testimony */}
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
                        const moonSign = ephemerisData?.planets?.Moon?.sign;
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
                      {/* Perfection / significator aspects */}
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
                      {/* Collection of light */}
                      {chartPrefs.showCollection && collections.map((c, i) => (
                        <li key={`col-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-emerald-400 shrink-0 mt-0.5">⟐</span>
                          <span className="text-bone/75">
                            {c.collector} collects light from {querentLord} and {quesitedLord}
                            {' '}({querentLord} {c.querentAspect.abbr} {c.querentAspect.orb}°, {quesitedLord} {c.quesitedAspect.orb}°)
                          </span>
                        </li>
                      ))}
                      {/* Prohibition */}
                      {chartPrefs.showProhibition && prohibitions.map((p, i) => (
                        <li key={`proh-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-red-400 shrink-0 mt-0.5">⊗</span>
                          <span className="text-silver">
                            {p.prohibitor} prohibits — perfects with {p.target} ({p.aspect.abbr} {p.aspect.orb}°)
                            {' '}before {querentLord}–{quesitedLord} ({p.sigAspect.abbr} {p.sigAspect.orb}°)
                          </span>
                        </li>
                      ))}
                      {/* Translation of light */}
                      {chartPrefs.showTranslation && translations.map((t, i) => (
                        <li key={`tol-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-sky-400 shrink-0 mt-0.5">↝</span>
                          <span className="text-bone/75">
                            {t.translator} translates light from {t.from} to {t.to}
                            {' '}(separates {t.separatingAspect.abbr} {t.separatingAspect.orb}° → applies {t.applyingAspect.abbr} {t.applyingAspect.orb}°)
                          </span>
                        </li>
                      ))}
                      {/* Reception between significators */}
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
                      {/* Refranation */}
                      {chartPrefs.showRefranation && refranation && (
                        <li className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-red-400 shrink-0 mt-0.5">⊘</span>
                          <span className="text-red-300">
                            Refranation — {refranation.planet} is applying ({refranation.aspect.aspect.toLowerCase()} {refranation.aspect.orb}°)
                            but near stationary ({refranation.speed}°/day) — may station and pull back before perfection
                          </span>
                        </li>
                      )}
                      {/* Fixed stars */}
                      {chartPrefs.showFixedStars && fixedStarHits.map((h, i) => (
                        <li key={`star-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className={h.nature === 'malefic' ? 'text-red-400 shrink-0 mt-0.5' : 'text-copper-400 shrink-0 mt-0.5'}>★</span>
                          <span className={h.nature === 'malefic' ? 'text-red-300' : 'text-bone/75'}>
                            {h.planet} conjunct {h.star} ({h.orb}°) — {h.gloss}
                          </span>
                        </li>
                      ))}
                      {/* Antiscia / contra-antiscia */}
                      {chartPrefs.showAntiscia && antiscia.map((a, i) => (
                        <li key={`anti-${i}`} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-violet-300 shrink-0 mt-0.5">⟂</span>
                          <span className="text-bone/75">
                            {a.p1} {a.type === 'antiscia' ? 'antiscia' : 'contra-antiscia'} {a.p2}
                            <span className="text-silver/70"> ({a.orb}° from {a.sign} {Math.floor(a.degree)}°)</span>
                          </span>
                        </li>
                      ))}
                      {/* Combustion / VOC warnings */}
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
                  )}
                </div>
              );
            })()}

            {/* 4. WHAT TO DO NEXT */}
            {sections.next && (
              <div className={`bg-teal-700/70 border border-teal-600/40 rounded-2xl p-7 backdrop-blur-sm
                              transition-all duration-700
                              ${stage >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
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

            {/* Chart details — collapsible, secondary */}
            {ephemerisData && stage >= 4 && (
              <div className="border border-teal-600/30 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowChart((v) => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left
                             bg-teal-900/40 hover:bg-teal-900/40 transition-colors"
                >
                  <span className="text-silver/70 text-xs uppercase tracking-widest">
                    Chart Data & Significations
                  </span>
                  <span className="text-silver/70 text-sm">{showChart ? '▲' : '▼'}</span>
                </button>
                {showChart && (
                  <div className="px-6 py-5 bg-teal-900/30 border-t border-teal-600/30 space-y-5">
                    {/* Static natal chart with optional transit overlay */}
                    <SquareChart
                      ephemerisData={ephemerisData}
                      houseSignifications={houseSignifications}
                      skipAnimation={true}
                      prefs={chartPrefs}
                    />
                    {/* Arabic Parts */}
                    {(() => {
                      const fortune = getLotOfFortune(ephemerisData);
                      const spirit  = getLotOfSpirit(ephemerisData);
                      if (!fortune && !spirit) return null;
                      return (
                        <div>
                          <p className="text-silver/70 text-xs uppercase tracking-widest mb-2">Arabic Parts</p>
                          <div className="space-y-1.5">
                            {fortune && chartPrefs.showLotOfFortune !== false && (
                              <div className="bg-teal-900/40 rounded-xl px-4 py-3 text-xs text-bone/75 flex items-center justify-between">
                                <span className="text-silver/70">Part of Fortune</span>
                                <span>{fortune.sign} {fortune.degree}° · {fortune.lord}</span>
                              </div>
                            )}
                            {spirit && (
                              <div className="bg-teal-900/40 rounded-xl px-4 py-3 text-xs text-bone/75 flex items-center justify-between">
                                <span className="text-silver/70">Part of Spirit</span>
                                <span>{spirit.sign} {spirit.degree}° · {spirit.lord}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {houseSignifications && (
                      <div>
                        <p className="text-silver/70 text-xs mt-3">{houseSignifications.additional_notes}</p>
                      </div>
                    )}
                    {/* Aspects */}
                    {chartPrefs.showAspectsTable && (() => {
                      if (!aspects.length) return null;
                      const sorted = [...aspects].sort((a, b) => {
                        const aSig = sigSet.has(a.p1) && sigSet.has(a.p2);
                        const bSig = sigSet.has(b.p1) && sigSet.has(b.p2);
                        if (aSig !== bSig) return aSig ? -1 : 1;
                        if (a.applying !== b.applying) return a.applying ? -1 : 1;
                        return a.orb - b.orb;
                      });
                      return (
                        <div>
                          <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Aspects</p>
                          <div className="space-y-1.5 overflow-x-auto">
                            {sorted.map((a, i) => {
                              const isSig = sigSet.has(a.p1) && sigSet.has(a.p2);
                              return (
                                <div key={i}
                                     className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs min-w-0
                                       ${isSig ? 'bg-copper-400/10 border border-copper-400/20' : 'bg-teal-900/40'}`}>
                                  <span className={isSig ? 'text-bone/90 w-28 sm:w-36 shrink-0' : 'text-silver w-28 sm:w-36 shrink-0'}>
                                    {a.p1} – {a.p2}
                                  </span>
                                  <span className="text-silver/70 w-10 sm:w-14 shrink-0">
                                    {a.abbr ?? a.aspect.slice(0,3)}
                                    {a.outOfSign && <span className="text-silver/20 ml-0.5">*</span>}
                                  </span>
                                  <span className="text-silver/70 w-8 sm:w-10 shrink-0">{a.orb}°</span>
                                  <span className={a.applying ? 'text-copper-400 font-medium' : 'text-silver/40'}>
                                    {a.applying ? 'Applying' : 'Sep.'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Receptions */}
                    {chartPrefs.showReceptionTable && (() => {
                      if (!allRecs.length) return null;
                      return (
                        <div>
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
                      );
                    })()}

                    {/* Planetary dignities + Hayz */}
                    {chartPrefs.showDignitiesTable && (() => {
                      const dignities = essentialDignities;
                      if (!dignities.length) return null;
                      const hayzMap = chartPrefs.showHayz !== false
                        ? Object.fromEntries(getHayz(ephemerisData).map(h => [h.planet, h]))
                        : {};
                      return (
                        <div>
                          <p className="text-silver/70 text-xs uppercase tracking-widest mb-3">Planetary Dignities</p>
                          <div className="space-y-1.5">
                            {dignities.map(({ planet, sign, degree, dignity }) => {
                              const hayz = hayzMap[planet];
                              return (
                                <div key={planet}
                                     className="flex items-center justify-between bg-teal-900/40 rounded-lg px-3 py-2 text-xs">
                                  <span className="text-silver w-16 shrink-0">{planet}</span>
                                  <span className="text-silver/70 flex-1">
                                    {sign} {Math.floor(degree)}°
                                  </span>
                                  {hayz?.hayz && (
                                    <span className="text-amber-400 text-[10px] mr-2 shrink-0">Hayz</span>
                                  )}
                                  <span className={`font-medium ${dignityColor(dignity.type)}`}>
                                    {dignity.label}
                                    {dignity.extra.length > 0 && (
                                      <span className="text-silver/40 font-normal">
                                        {' '}(+{dignity.extra.join(', ')})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {chartPrefs.showRawChartData && <ChartDisplay data={ephemerisData} />}
                  </div>
                )}
              </div>
            )}

            {/* Client package — practitioner-only slide deck + voice narration */}
            {stage >= 4 && (
              <ReadingPackagePanel
                readingId={readingId}
                question={question}
                houseSignifications={houseSignifications}
                ephemerisData={ephemerisData}
                analysis={analysis}
                tradition={dateTimeData.tradition}
                chartPrefs={chartPrefs}
              />
            )}

            {/* Follow-up chat — appears once the reading has fully arrived */}
            {stage >= 4 && <FollowUpChat />}

            {/* Journal — outcome tracking + personal notes */}
            {stage >= 4 && <JournalPanel />}

            {/* Consent nudge — shown once after first save, dismissible */}
            {showConsentNudge && (
              <div className="flex items-start justify-between gap-4 bg-teal-900/60 border border-teal-600/40
                              rounded-2xl px-5 py-4 text-sm">
                <p className="text-silver leading-relaxed">
                  Would you like your readings to help improve Aevum over time?{' '}
                  <button
                    onClick={() => navigate('/consent')}
                    className="text-copper-400 hover:text-copper-300 underline underline-offset-2 transition-colors"
                  >
                    Review data settings →
                  </button>
                </p>
                <button
                  onClick={() => setShowConsentNudge(false)}
                  className="text-silver/40 hover:text-silver shrink-0 text-base leading-none transition-colors"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Footer actions */}
            {(isDone || stage >= 4) && (
              <div className="flex flex-wrap gap-2 sm:gap-3 pt-2 pb-8">
                <button
                  onClick={handleNewReading}
                  className="flex-1 py-3 border border-teal-600 text-silver hover:text-bone/90
                             rounded-xl text-sm transition-colors"
                >
                  New Case Petition
                </button>
                <button
                  onClick={() => setShowCustomize(true)}
                  className="px-4 py-3 bg-teal-900 hover:bg-teal-700 text-silver hover:text-bone/90
                             rounded-xl text-sm border border-teal-600 transition-colors"
                  title="Customize chart display"
                >
                  ⚙
                </button>
                {readingId && (
                  <button
                    onClick={handleShare}
                    disabled={shareState === 'copying'}
                    className="px-5 py-3 bg-teal-900 hover:bg-teal-700 disabled:opacity-50
                               text-bone/75 rounded-xl text-sm border border-teal-600 transition-colors"
                  >
                    {shareState === 'copied' ? '✓ Link copied' :
                     shareState === 'error'  ? 'Copy failed' :
                     shareState === 'copying' ? 'Sharing…' : '↗ Share'}
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="px-5 py-3 bg-teal-900 hover:bg-teal-700 text-bone/75
                             rounded-xl text-sm border border-teal-600 transition-colors"
                >
                  Print
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* PRINT-ONLY VIEW (Ink-saving, high-contrast, structured 3-page layout) */}
      {ephemerisData && showReading && (
        <div className="hidden print:block print-only w-full">
          {/* PAGE 1: Question and Cosmic Portrait */}
          <div className="print-page">
            <div>
              {/* Question Header */}
              <div style={{ textAlign: 'center', marginBottom: '20pt' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9pt', color: '#1a472a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4pt 0' }}>Horary Inquiry</p>
                <h1 className="print-heading" style={{ fontSize: '22pt', fontStyle: 'italic', fontFamily: 'Crimson Pro, Georgia, serif', fontWeight: 'normal', color: '#000000', textTransform: 'none', margin: '0 0 10pt 0' }}>
                  "{question}"
                </h1>
                
                {/* Provenance badge — only claims the NASA cross-check when it actually
                    passed; otherwise states the (true) Swiss Ephemeris precision alone. */}
                {ephemerisData?.verification?.verified ? (
                  <div className="dual-source-verified-badge-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '4pt', border: '1pt solid #1a472a', borderRadius: '4pt', padding: '3pt 6pt', fontSize: '8pt', fontFamily: 'Inter, sans-serif', color: '#1a472a', backgroundColor: '#f4f6f4', margin: '5pt 0' }}>
                    <span style={{ fontSize: '9pt' }}>✓</span>
                    <span>DUAL-SOURCE EPHEMERIS VERIFIED (SWISS EPHEMERIS &amp; NASA JPL HORIZONS)</span>
                  </div>
                ) : (
                  <div className="dual-source-verified-badge-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '4pt', border: '1pt solid #1a472a', borderRadius: '4pt', padding: '3pt 6pt', fontSize: '8pt', fontFamily: 'Inter, sans-serif', color: '#1a472a', backgroundColor: '#f4f6f4', margin: '5pt 0' }}>
                    <span style={{ fontSize: '9pt' }}>✦</span>
                    <span>SWISS EPHEMERIS — SUB-ARCSECOND PRECISION (sepl/semo data files)</span>
                  </div>
                )}
              </div>

              {/* Radicality Checker Status */}
              <div style={{ borderLeft: '2pt solid #1a472a', paddingLeft: '8pt', margin: '15pt 0' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9pt', fontWeight: 'bold', color: '#1a472a', textTransform: 'uppercase', margin: '0 0 3pt 0' }}>Radicality Status</p>
                <p className="print-body" style={{ margin: 0 }}>
                  {strictures.length === 0 ? (
                    <strong>Radical and Fit for Judgment:</strong>
                  ) : (
                    <strong>Unradical / Strictures Present:</strong>
                  )}{' '}
                  {strictures.length === 0 
                    ? 'The Ascendant is clear (between 3° and 27° of the sign), Saturn is not impeding the 1st or 7th houses, and the Moon is secure. The chart speaks with clear, traditional authority.' 
                    : strictures.map(s => s.label).join(', ') + '. Proceed with judgment using appropriate classical caution.'}
                </p>
              </div>

              {/* Large Wheel Chart Container */}
              <div className="print-chart-container">
                <Astrolabe 
                  ephemerisData={ephemerisData} 
                  houseSignifications={houseSignifications} 
                  skipAnimation={true} 
                  prefs={chartPrefs} 
                />
              </div>
            </div>

            {/* Page 1 Footer */}
            <div className="print-footer">
              <span>Aevum Traditional Case Judgment Report</span>
              <span>Page 1 of 3</span>
            </div>
          </div>

          {/* PAGE 2: Traditional Technical Calculations */}
          <div className="print-page">
            <div>
              <h2 className="print-heading">Traditional Technical Calculations</h2>
              
              {/* Significators Section */}
              <div style={{ marginBottom: '15pt' }}>
                <h3 className="print-subheading" style={{ marginTop: 0 }}>Significators & Conditions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8pt', fontFamily: 'Crimson Pro, serif', fontSize: '10.5pt' }}>
                  <div style={{ padding: '6pt', backgroundColor: '#f9f9f9', borderRadius: '4pt', border: '0.5pt solid #e0e0e0' }}>
                    <strong>Querent Significator (1st House Ruler & Moon):</strong>
                    <div style={{ marginTop: '3pt', fontSize: '10pt', color: '#333333' }}>
                      Primary: {getSignificatorDescription(querentLord, ephemerisData, lillyAccidentalDignities, essentialDignities)}
                    </div>
                    <div style={{ marginTop: '2pt', fontSize: '10pt', color: '#333333' }}>
                      Co-Significator: {getSignificatorDescription('Moon', ephemerisData, lillyAccidentalDignities, essentialDignities)}
                    </div>
                  </div>
                  <div style={{ padding: '6pt', backgroundColor: '#f9f9f9', borderRadius: '4pt', border: '0.5pt solid #e0e0e0' }}>
                    <strong>Quesited Significator (House {houseSignifications?.quesited_house || 7} Ruler):</strong>
                    <div style={{ marginTop: '3pt', fontSize: '10pt', color: '#333333' }}>
                      Primary: {getSignificatorDescription(quesitedLord, ephemerisData, lillyAccidentalDignities, essentialDignities)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accidental Dignities Table */}
              <div style={{ marginBottom: '15pt' }}>
                <h3 className="print-subheading">Planetary Dignities (William Lilly's Rules)</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Planet</th>
                      <th style={{ width: '20%' }}>Position</th>
                      <th style={{ width: '25%' }}>Essential Dignity</th>
                      <th style={{ width: '30%' }}>Accidental Conditions</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {essentialDignities.map(({ planet, sign, degree, dignity }) => {
                      const acc = lillyAccidentalDignities[planet];
                      const totalScore = (dignity?.score || 0) + (acc?.score || 0);
                      return (
                        <tr key={planet}>
                          <td><strong>{planet}</strong></td>
                          <td className="print-mono">{sign} {Math.floor(degree)}°{Math.floor((degree % 1) * 60)}'</td>
                          <td>
                            {dignity?.label} ({dignity?.score >= 0 ? '+' : ''}{dignity?.score})
                          </td>
                          <td style={{ fontSize: '9pt', color: '#555555' }}>
                            {acc?.conditions?.join(', ') || 'None'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '11pt' }}>
                            {totalScore >= 0 ? '+' : ''}{totalScore}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="print-caption" style={{ marginTop: '-4pt' }}>
                  * Essential dignities represent a planet's inherent strength (Ptolemaic). Accidental dignities represent its situational ability to act (William Lilly's Christian Astrology).
                </p>
              </div>

              {/* Key Aspects & Moieties Table */}
              <div>
                <h3 className="print-subheading">Key Ecliptic Aspects & Classical Moieties</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Aspecting Bodies</th>
                      <th style={{ width: '15%' }}>Aspect</th>
                      <th style={{ width: '15%' }}>Exact Orb</th>
                      <th style={{ width: '15%' }}>Motion</th>
                      <th style={{ width: '25%', textAlign: 'right' }}>Traditional Moiety Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aspects.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#777777' }}>No classical aspects found in the chart.</td>
                      </tr>
                    ) : (
                      [...aspects]
                        .sort((a, b) => {
                          const aSig = sigSet.has(a.p1) && sigSet.has(a.p2);
                          const bSig = sigSet.has(b.p1) && sigSet.has(b.p2);
                          if (aSig !== bSig) return aSig ? -1 : 1;
                          return a.orb - b.orb;
                        })
                        .map((a, i) => {
                          const moietyOrb = getMoiety(a.p1, a.p2);
                          const isSig = sigSet.has(a.p1) && sigSet.has(a.p2);
                          return (
                            <tr key={i} style={isSig ? { backgroundColor: '#fcfbf7' } : undefined}>
                              <td>
                                {isSig ? <strong>{a.p1} – {a.p2} *</strong> : `${a.p1} – ${a.p2}`}
                              </td>
                              <td>{a.aspect}</td>
                              <td className="print-mono">{a.orb.toFixed(2)}°</td>
                              <td style={{ color: a.applying ? '#1a472a' : '#666666', fontWeight: a.applying ? 'bold' : 'normal' }}>
                                {a.applying ? 'Applying' : 'Separating'}
                              </td>
                              <td style={{ textAlign: 'right' }} className="print-mono">
                                Max {moietyOrb.toFixed(1)}°
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
                <p className="print-caption" style={{ marginTop: '-4pt' }}>
                  * Asterisks and bolding denote aspects between primary significators or the Moon. Moiety limits show the traditional calculated limits for aspects according to classical semi-diameters.
                </p>
              </div>
            </div>

            {/* Page 2 Footer */}
            <div className="print-footer">
              <span>Aevum Traditional Case Judgment Report</span>
              <span>Page 2 of 3</span>
            </div>
          </div>

          {/* PAGE 3: Traditional Horary Judgment & Verdict */}
          <div className="print-page">
            <div>
              <h2 className="print-heading">Traditional Horary Judgment & Synthesis</h2>

              {/* The Verdict Box */}
              {(() => {
                const style = answerStyle(sections.answer);
                return (
                  <div style={{ 
                    border: '1.5pt solid #1a472a', 
                    borderRadius: '6pt', 
                    padding: '12pt', 
                    textAlign: 'center', 
                    backgroundColor: '#f4f6f4',
                    marginBottom: '15pt'
                  }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9pt', fontWeight: 'bold', color: '#1a472a', textTransform: 'uppercase', margin: '0 0 4pt 0' }}>The Verdict</p>
                    <h3 style={{ 
                      fontSize: '32pt', 
                      fontFamily: 'Inter, system-ui, sans-serif', 
                      fontWeight: '900', 
                      color: '#1a472a', 
                      margin: 0, 
                      letterSpacing: '0.05em' 
                    }}>
                      {sections.answer?.toUpperCase()}
                    </h3>
                  </div>
                );
              })()}

              {/* Why This Answer */}
              {sections.meaning && (
                <div style={{ marginBottom: '15pt' }}>
                  <h3 className="print-subheading" style={{ marginTop: 0 }}>Cosmic Synthesis (Why This Answer)</h3>
                  <div className="print-body" style={{ fontSize: '10.5pt', lineHeight: '1.5' }}>
                    {sections.meaning.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                      <p key={i} style={{ marginBottom: '8pt', textIndent: '15pt' }}
                         dangerouslySetInnerHTML={{ __html: formatInline(para.trim()).replace(/<\/?strong>/g, '<strong>') }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Cautions and Warnings (VOC, Via Combusta, Combustion) */}
              {(() => {
                const warnings = getChartWarnings(ephemerisData);
                const perfection = getPerfectionAspects(aspects, querentLord, quesitedLord);
                const translations = getTranslationOfLight(aspects, querentLord, quesitedLord);
                const collections  = getCollectionOfLight(aspects, querentLord, quesitedLord);
                const prohibitions = getProhibition(aspects, querentLord, quesitedLord);
                const timing = getTiming(aspects, querentLord, quesitedLord, ephemerisData);
                const moonTestimony = getMoonTestimony(aspects, ephemerisData);
                const refranation = getRefranation(aspects, querentLord, quesitedLord, ephemerisData);
                
                const cautionsList = [];
                if (warnings.length > 0) cautionsList.push(...warnings.map(w => w.label));
                if (refranation) cautionsList.push(`Refranation is occurring: ${refranation.planet} is applying but near stationary.`);
                if (prohibitions.length > 0) cautionsList.push(...prohibitions.map(p => `${p.prohibitor} prohibits perfection with ${p.target}.`));

                const actionsList = parseNumbered(sections.next || '');

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt', marginTop: '10pt' }}>
                    {/* Timing and Perfection Mechanism */}
                    <div style={{ padding: '8pt', border: '0.5pt solid #dddddd', borderRadius: '4pt', backgroundColor: '#fafafa' }}>
                      <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '9pt', fontWeight: 'bold', color: '#1a472a', textTransform: 'uppercase', margin: '0 0 5pt 0' }}>Perfection & Timing</h4>
                      <ul style={{ paddingLeft: '12pt', margin: 0, fontSize: '9.5pt', fontFamily: 'Crimson Pro, serif', lineHeight: '1.4' }}>
                        {timing && (
                          <li style={{ marginBottom: '4pt' }}>
                            <strong>Estimated Timeframe:</strong> ~{timing.estimate} {timing.unit}s ({timing.faster} in {timing.sign} at {timing.estimate}°).
                          </li>
                        )}
                        {perfection.length > 0 && (
                          <li style={{ marginBottom: '4pt' }}>
                            <strong>Aspect Perfection:</strong> {perfection.map(p => `${p.p1} is ${p.applying ? 'applying' : 'separating'} to ${p.p2} by ${p.aspect.toLowerCase()} (${p.orb}°)`).join(', ')}.
                          </li>
                        )}
                        {translations.length > 0 && (
                          <li style={{ marginBottom: '4pt' }}>
                            <strong>Translation of Light:</strong> {translations.map(t => `${t.translator} translates from ${t.from} to ${t.to}`).join(', ')}.
                          </li>
                        )}
                        {collections.length > 0 && (
                          <li style={{ marginBottom: '4pt' }}>
                            <strong>Collection of Light:</strong> {collections.map(c => `${c.collector} collects from ${querentLord} and ${quesitedLord}`).join(', ')}.
                          </li>
                        )}
                        {moonTestimony.next && (
                          <li>
                            <strong>Moon Testimony:</strong> Moon's next application is to {moonTestimony.next.p1 === 'Moon' ? moonTestimony.next.p2 : moonTestimony.next.p1} by {moonTestimony.next.aspect.toLowerCase()} ({moonTestimony.next.orb}°).
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Cautions and Recommended Actions */}
                    <div style={{ padding: '8pt', border: '0.5pt solid #dddddd', borderRadius: '4pt', backgroundColor: '#fafafa' }}>
                      <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '9pt', fontWeight: 'bold', color: '#1a472a', textTransform: 'uppercase', margin: '0 0 5pt 0' }}>Cautions & Actions</h4>
                      {cautionsList.length > 0 && (
                        <div style={{ marginBottom: '5pt' }}>
                          <strong>Astrological Cautions:</strong>
                          <ul style={{ paddingLeft: '12pt', margin: '2pt 0 0 0', fontSize: '9pt', color: '#c0392b' }}>
                            {cautionsList.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {actionsList.length > 0 && (
                        <div>
                          <strong>Recommended Actions:</strong>
                          <ol style={{ paddingLeft: '12pt', margin: '2pt 0 0 0', fontSize: '9pt', color: '#333333' }}>
                            {actionsList.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Page 3 Footer */}
            <div className="print-footer" style={{ marginTop: 'auto' }}>
              <span>Generated: {new Date(dateTimeData?.date + 'T' + (dateTimeData?.time || '12:00')).toLocaleDateString(undefined, { dateStyle: 'long' })} | Regiomontanus Houses | © {new Date().getFullYear()} Aevum</span>
              <span>Page 3 of 3</span>
            </div>
          </div>
        </div>
      )}
        </div>
        </div>
      </main>
    </div>
  );
}
