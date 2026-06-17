// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// ReadingPackagePanel — practitioner-only fulfillment tool on the Results page.
// Generates the 9-slide teaching deck for a booked client, hosts the narration
// studio (record your voice per slide), and persists everything to the reading
// document so the client's share link delivers the full package.

import { useState, useEffect } from 'react';
import SlideDeck from './SlideDeck.jsx';
import { useAuthState } from '../hooks/useAuthState.js';
import { isPractitioner, generateSlides } from '../lib/package.js';
import { loadReading, saveReadingPackage, uploadSlideAudio } from '../lib/firebase.js';

export default function ReadingPackagePanel({
  readingId,
  question,
  houseSignifications,
  ephemerisData,
  analysis,
  tradition,
  chartPrefs,
}) {
  const { user } = useAuthState();
  const [slides, setSlides] = useState(null);
  const [audioUrls, setAudioUrls] = useState({});
  const [genState, setGenState] = useState('idle'); // idle | generating | error
  const [genError, setGenError] = useState('');

  const practitioner = isPractitioner(user);
  const [savePending, setSavePending] = useState(!readingId);

  // Once readingId arrives, clear the pending state
  useEffect(() => {
    if (readingId) setSavePending(false);
  }, [readingId]);

  // If readingId hasn't arrived within 8s, stop waiting — show error instead
  useEffect(() => {
    if (!savePending) return;
    const t = setTimeout(() => setSavePending(false), 8000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull any previously generated package (e.g. reading reopened from history)
  useEffect(() => {
    if (!practitioner || !readingId) return;
    loadReading(readingId).then((r) => {
      if (r?.packageSlides?.length) setSlides(r.packageSlides);
      if (r?.packageAudio) setAudioUrls(r.packageAudio);
    });
  }, [practitioner, readingId]);

  if (!practitioner) return null;

  async function handleGenerate() {
    setGenState('generating');
    setGenError('');
    try {
      const deck = await generateSlides({
        question, houseSignifications, ephemerisData, analysis,
        tradition: tradition || 'classic',
      });
      setSlides(deck);
      setGenState('idle');
      if (readingId) await saveReadingPackage(readingId, { packageSlides: deck });
    } catch (e) {
      setGenError(e.message);
      setGenState('error');
    }
  }

  async function handleSaveAudio(slideIndex, blob) {
    if (!readingId) return null;
    const url = await uploadSlideAudio(readingId, slideIndex, blob);
    if (url) {
      setAudioUrls(prev => ({ ...prev, [slideIndex]: url }));
      await saveReadingPackage(readingId, { [`packageAudio.${slideIndex}`]: url });
    }
    return url;
  }

  return (
    <div className="bg-teal-900/40 border border-copper-400/20 rounded-3xl px-6 py-6 space-y-4 print:hidden">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-copper-400 text-xs uppercase tracking-widest">Client Package · Practitioner</p>
          <p className="text-silver/50 text-xs mt-1">
            9 exposition slides + your voice narration, delivered through the share link.
          </p>
        </div>
        {!slides && (
          <button
            onClick={handleGenerate}
            disabled={genState === 'generating' || !readingId}
            className="bg-copper-400 hover:bg-copper-300 disabled:opacity-50 text-teal-900
                       font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {genState === 'generating' ? 'Composing slides…' : '✦ Generate teaching slides'}
          </button>
        )}
      </div>

      {!readingId && savePending && (
        <p className="text-silver/30 text-xs animate-pulse">Saving reading…</p>
      )}
      {!readingId && !savePending && (
        <p className="text-red-400/70 text-xs">Could not save the reading — sign in and reload to try again.</p>
      )}

      {genError && (
        <p className="text-red-400 text-xs">{genError}</p>
      )}

      {slides && (
        <>
          <SlideDeck
            slides={slides}
            audioUrls={audioUrls}
            ephemerisData={ephemerisData}
            significations={houseSignifications}
            chartPrefs={chartPrefs}
            practitioner={true}
            onSaveAudio={handleSaveAudio}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-silver/30 text-xs">
              When every slide is narrated, use <span className="text-silver/50">↗ Share</span> below — your
              client's link now opens with the full narrated walkthrough.
            </p>
            <button
              onClick={handleGenerate}
              disabled={genState === 'generating'}
              className="text-silver/40 hover:text-silver text-xs underline underline-offset-2 transition-colors"
            >
              {genState === 'generating' ? 'Regenerating…' : 'Regenerate slides'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
