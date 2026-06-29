// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// SlideDeck — the premium client deliverable: an 8-slide teaching walkthrough
// of a completed reading, narrated in the practitioner's own recorded voice.
//
// Two modes:
//   * playback (default)  — client views slides; per-slide audio + "Play my
//     reading" auto-advance that walks the whole deck with narration.
//   * practitioner        — adds per-slide voice recording (MediaRecorder),
//     take preview, and the suggested narration script.

import { useState, useEffect, useRef, useCallback } from 'react';
import Astrolabe from './Astrolabe.jsx';
import { pickAudioMimeType } from '../lib/package.js';

function fmtSecs(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function SlideDeck({
  slides,
  audioUrls = {},
  ephemerisData,
  significations,
  chartPrefs,
  practitioner = false,
  onSaveAudio,
  onSlideChange,
}) {
  const [idx, setIdx] = useState(0);
  const [savedUrls, setSavedUrls] = useState({});
  const [playingSlide, setPlayingSlide] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Recording state (practitioner mode)
  const [recState, setRecState] = useState('idle'); // idle | recording | preview | saving
  const [recSecs, setRecSecs] = useState(0);
  const [takeUrl, setTakeUrl] = useState(null);
  const [recError, setRecError] = useState('');
  const takeBlobRef = useRef(null);
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);

  const audioRef = useRef(null);
  const autoPlayRef = useRef(false);
  autoPlayRef.current = autoPlay;

  const urls = { ...audioUrls, ...savedUrls };
  const slide = slides[idx];
  const hasAnyAudio = Object.values(urls).some(Boolean);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    setPlayingSlide(null);
    setAutoPlay(false);
  }, []);

  const playSlide = useCallback((i) => {
    const url = ({ ...audioUrls, ...savedUrls })[i];
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    audioRef.current.play().then(() => setPlayingSlide(i)).catch(() => setPlayingSlide(null));
  }, [audioUrls, savedUrls]);

  function handleAudioEnded() {
    setPlayingSlide(null);
    if (!autoPlayRef.current) return;
    setIdx((cur) => {
      const next = cur + 1;
      if (next >= slides.length) { setAutoPlay(false); return cur; }
      setTimeout(() => playSlide(next), 400);
      return next;
    });
  }

  function startFullPlayback() {
    const first = slides.findIndex((_, i) => urls[i]);
    if (first === -1) return;
    setIdx(first);
    setAutoPlay(true);
    setTimeout(() => playSlide(first), 300);
  }

  function go(delta) {
    stopAudio();
    discardTake();
    setIdx((cur) => Math.min(slides.length - 1, Math.max(0, cur + delta)));
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onSlideChange) onSlideChange(idx);
  }, [idx, onSlideChange]);

  // ─── Recording (practitioner) ───────────────────────────────────────────────

  async function startRecording() {
    setRecError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        takeBlobRef.current = blob;
        setTakeUrl(URL.createObjectURL(blob));
        setRecState('preview');
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
      setRecState('recording');
    } catch {
      setRecError('Microphone access was denied. Allow it in your browser settings and try again.');
    }
  }

  function stopRecording() {
    clearInterval(recTimerRef.current);
    recorderRef.current?.stop();
  }

  function discardTake() {
    clearInterval(recTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (takeUrl) URL.revokeObjectURL(takeUrl);
    takeBlobRef.current = null;
    setTakeUrl(null);
    setRecState('idle');
  }

  async function saveTake() {
    if (!takeBlobRef.current || !onSaveAudio) return;
    setRecState('saving');
    const url = await onSaveAudio(idx, takeBlobRef.current);
    if (url) {
      setSavedUrls(prev => ({ ...prev, [idx]: url }));
      if (takeUrl) URL.revokeObjectURL(takeUrl);
      takeBlobRef.current = null;
      setTakeUrl(null);
      setRecState('idle');
    } else {
      setRecError('Could not save the recording. Check your connection and try again.');
      setRecState('preview');
    }
  }

  useEffect(() => () => {
    clearInterval(recTimerRef.current);
    if (takeUrl) URL.revokeObjectURL(takeUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slides?.length) return null;

  const recordedCount = slides.filter((_, i) => urls[i]).length;

  return (
    <div className="space-y-3">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Deck header */}
      <div className="flex items-center justify-between">
        <p className="text-copper-400 text-xs uppercase tracking-widest">
          Your Reading · Slide {idx + 1} of {slides.length}
        </p>
        {hasAnyAudio && (
          autoPlay
            ? <button onClick={stopAudio}
                      className="text-xs text-silver bg-teal-900/80 border border-teal-600 rounded-xl px-4 py-1.5 hover:border-copper-400/60 transition-colors">
                ◼ Stop
              </button>
            : <button onClick={startFullPlayback}
                      className="text-xs font-semibold text-teal-900 bg-copper-400 hover:bg-copper-300 rounded-xl px-4 py-1.5 transition-colors">
                ▶ Play my reading
              </button>
        )}
      </div>

      {/* Slide card */}
      <div className="relative glass-panel rounded-3xl px-6 py-8 sm:px-10 sm:py-10 min-h-[22rem] flex flex-col overflow-hidden">
        {/* subtle copper corner glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-copper-400/5 blur-3xl" />

        {slide.kicker && (
          <p className="text-copper-400/80 text-[11px] uppercase tracking-[0.25em] mb-3">{slide.kicker}</p>
        )}
        <h3 className="text-bone font-serif text-2xl sm:text-3xl leading-snug mb-5">{slide.title}</h3>

        {slide.kind === 'chart' && ephemerisData ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-md">
              <Astrolabe
                ephemerisData={ephemerisData}
                houseSignifications={significations}
                skipAnimation={true}
                prefs={chartPrefs}
              />
            </div>
            <ul className="space-y-2 w-full">
              {slide.body.map((line, i) => (
                <li key={i} className="flex gap-3 text-sm text-silver leading-relaxed">
                  <span className="text-copper-400 mt-0.5 shrink-0">✦</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {slide.body.map((line, i) => (
              <p key={i} className="text-silver text-sm sm:text-base leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        {slide.teach && (
          <div className="mt-6 bg-copper-400/10 border border-copper-400/20 rounded-2xl px-4 py-3">
            <p className="text-copper-300/90 text-xs leading-relaxed">
              <span className="uppercase tracking-widest text-copper-400 mr-2">You just learned</span>
              {slide.teach}
            </p>
          </div>
        )}

        {/* Per-slide narration playback */}
        {urls[idx] && (
          <div className="mt-4 flex items-center gap-3">
            {playingSlide === idx
              ? <button onClick={stopAudio}
                        className="text-xs text-bone bg-teal-800 border border-teal-600 rounded-full w-9 h-9 flex items-center justify-center hover:border-copper-400/60 transition-colors">◼</button>
              : <button onClick={() => playSlide(idx)}
                        className="text-xs text-teal-900 bg-copper-400 hover:bg-copper-300 rounded-full w-9 h-9 flex items-center justify-center transition-colors">▶</button>}
            <span className="text-silver/50 text-xs">
              {playingSlide === idx ? 'Playing narration…' : 'Hear this slide narrated'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} disabled={idx === 0}
                className="text-silver/60 hover:text-copper-400 disabled:opacity-30 disabled:hover:text-silver/60 text-sm px-3 py-1.5 transition-colors">
          ‹ Previous
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => { stopAudio(); discardTake(); setIdx(i); }}
                    aria-label={`Slide ${i + 1}`}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === idx ? 'bg-copper-400'
                      : urls[i] ? 'bg-copper-400/40 hover:bg-copper-400/70'
                      : 'bg-teal-700 hover:bg-teal-500'}`} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === slides.length - 1}
                className="text-silver/60 hover:text-copper-400 disabled:opacity-30 disabled:hover:text-silver/60 text-sm px-3 py-1.5 transition-colors">
          Next ›
        </button>
      </div>

      {/* Practitioner recording studio */}
      {practitioner && (
        <div className="bg-teal-900/50 border border-teal-700/50 rounded-2xl px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-silver/50 text-xs uppercase tracking-widest">
              Narration studio <span className="text-silver/30 normal-case tracking-normal ml-2">{recordedCount}/{slides.length} slides recorded</span>
            </p>
            {urls[idx] && recState === 'idle' && (
              <span className="text-emerald-400 text-xs">✓ This slide has narration</span>
            )}
          </div>

          {slide.script && (
            <div className="bg-teal-800/40 rounded-xl px-4 py-3">
              <p className="text-silver/40 text-[10px] uppercase tracking-widest mb-1.5">Suggested script — read aloud or improvise</p>
              <p className="text-silver text-sm leading-relaxed italic">{slide.script}</p>
            </div>
          )}

          {recState === 'idle' && (
            <button onClick={startRecording}
                    className="bg-red-500/90 hover:bg-red-400 text-white text-xs font-semibold rounded-xl px-4 py-2 transition-colors">
              ● {urls[idx] ? 'Re-record this slide' : 'Record this slide'}
            </button>
          )}

          {recState === 'recording' && (
            <div className="flex items-center gap-3">
              <button onClick={stopRecording}
                      className="bg-bone hover:bg-white text-teal-900 text-xs font-semibold rounded-xl px-4 py-2 transition-colors">
                ◼ Stop
              </button>
              <span className="text-red-400 text-xs animate-pulse">● Recording {fmtSecs(recSecs)}</span>
            </div>
          )}

          {(recState === 'preview' || recState === 'saving') && takeUrl && (
            <div className="space-y-2">
              <audio src={takeUrl} controls className="w-full h-9" />
              <div className="flex gap-2">
                <button onClick={saveTake} disabled={recState === 'saving'}
                        className="bg-copper-400 hover:bg-copper-300 disabled:opacity-50 text-teal-900 text-xs font-semibold rounded-xl px-4 py-2 transition-colors">
                  {recState === 'saving' ? 'Saving…' : '✓ Use this take'}
                </button>
                <button onClick={discardTake} disabled={recState === 'saving'}
                        className="text-silver/50 hover:text-bone text-xs px-3 py-2 transition-colors">
                  Discard
                </button>
              </div>
            </div>
          )}

          {recError && <p className="text-red-400 text-xs">{recError}</p>}
        </div>
      )}
    </div>
  );
}
