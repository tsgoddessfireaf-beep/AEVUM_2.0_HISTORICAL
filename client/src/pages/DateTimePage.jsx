// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator.jsx';
import useAppStore from '../store/useAppStore.js';
import { TRADITIONS } from '../lib/traditions.js';

const TIMEZONES = [
  { group: 'Americas', zones: [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
    'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Bogota',
  ]},
  { group: 'Europe', zones: [
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw',
    'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow',
  ]},
  { group: 'Africa & Middle East', zones: [
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Riyadh',
  ]},
  { group: 'Asia & Pacific', zones: [
    'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Australia/Melbourne',
    'Pacific/Auckland',
  ]},
  { group: 'UTC', zones: ['UTC'] },
];

/** @returns {string} Today's date as "YYYY-MM-DD". */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
/** @returns {string} Current local time as "HH:MM". */
function nowTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
/**
 * Returns local time N hours in the past as "HH:MM".
 * Used for the "−2h" quick-fill button when the question was asked earlier.
 * @param {number} [hoursBack=2]
 * @returns {string}
 */
function earlierTimeStr(hoursBack = 2) {
  const d = new Date(Date.now() - hoursBack * 3600 * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Step 2 — collects the date, time, timezone, and location of the question.
 * The "Now" button attempts geolocation via the browser and reverse-geocodes to a city name.
 * Shows a confirmation modal before committing the detected values to the store.
 */
export default function DateTimePage() {
  const navigate = useNavigate();
  const { question, dateTimeData, setDateTimeData, setInterviewMessages, setHouseSignifications, setReadingId, setFollowUpMessages, setJournal, setAnalysis, setEphemerisData } = useAppStore();

  const [form, setForm] = useState({
    date: dateTimeData.date || todayStr(),
    time: dateTimeData.time || nowTimeStr(),
    timezone: dateTimeData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    location: dateTimeData.location || '',
    houseSystem: dateTimeData.houseSystem || 'Regiomontanus',
    tradition: dateTimeData.tradition || 'classic',
  });

  const [locating, setLocating] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (!question) navigate('/ask');
  }, [question, navigate]);

  function patch(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleNow() {
    const date = todayStr();
    const time = nowTimeStr();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setLocationError('');

    if (!navigator.geolocation) {
      setConfirmData({ date, time, timezone, location: form.location, latitude: null, longitude: null });
      setShowConfirm(true);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let location = form.location;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: {
                'Accept-Language': 'en',
                'User-Agent': 'Aevum/1.0 (https://app.aeonicarts.com)',
              }
            }
          );
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
          const country = addr.country || '';
          location = city && country ? `${city}, ${country}` : city || country || location;
        } catch {
          // geocoding failed — keep existing location, user can edit
          setLocationError('Could not detect your city — please confirm or type it below.');
        }
        setLocating(false);
        setConfirmData({ date, time, timezone, location, latitude, longitude });
        setShowConfirm(true);
      },
      () => {
        // Permission denied or timeout
        setLocating(false);
        setConfirmData({ date, time, timezone, location: form.location, latitude: null, longitude: null });
        setShowConfirm(true);
        setLocationError('Location access was denied — please enter your city manually.');
      },
      { timeout: 8000 }
    );
  }

  function handleEarlier() {
    setForm((f) => ({
      ...f,
      date: todayStr(),
      time: earlierTimeStr(2),
    }));
  }

  function confirmNow() {
    setForm(confirmData);
    setConfirmData(null);
    setShowConfirm(false);
  }

  function dismissConfirm() {
    setShowConfirm(false);
    setConfirmData(null);
  }

  function handleContinue() {
    if (!form.date || !form.time || !form.location.trim()) return;
    setDateTimeData(form);
    setInterviewMessages([]);
    setHouseSignifications(null);
    setEphemerisData(null);
    setAnalysis('');
    setReadingId(null);
    setFollowUpMessages([]);
    setJournal(null);
    prefetchEphemeris(form);
    navigate('/significations');
  }

  // Fires the chart calculation the instant the moment/location are confirmed,
  // instead of waiting until the results page. Runs in the background while
  // the house-signification interview proceeds, so by the time the user
  // reaches DashboardPage, ephemerisData is already populated and its own
  // fetch (in run()) is skipped. Fire-and-forget from the caller's
  // perspective — a failure here doesn't block navigation; DashboardPage's
  // run() will simply retry the fetch itself if ephemerisData never arrived.
  async function prefetchEphemeris(snapshot) {
    try {
      const res = await fetch('/api/ephemeris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: snapshot.date,
          time: snapshot.time + ':00',
          timezone: snapshot.timezone,
          location: snapshot.location,
          latitude: snapshot.latitude || null,
          longitude: snapshot.longitude || null,
          topocentric: true,
          elevation: 0.0,
          house_system: snapshot.houseSystem || 'Regiomontanus',
        }),
      });
      if (!res.ok) return; // silent — DashboardPage.run() re-fetches on arrival
      const chartData = await res.json();
      setEphemerisData(chartData);
      if (chartData.chart_meta?.resolved_latitude && chartData.chart_meta?.resolved_longitude) {
        setDateTimeData({
          latitude: chartData.chart_meta.resolved_latitude,
          longitude: chartData.chart_meta.resolved_longitude,
        });
      }
    } catch {
      // Silent — DashboardPage.run() falls back to fetching it itself.
    }
  }

  const valid = form.date && form.time && form.location.trim();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-16">

      {/* Confirmation modal */}
      {showConfirm && confirmData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-teal-900 border border-copper-400/30 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <p className="text-silver/70 text-xs uppercase tracking-widest text-center mb-1">Confirm</p>
            <h3 className="text-lg font-serif text-bone mb-5 text-center">
              Is this when & where you are?
            </h3>

            <div className="space-y-3 mb-5">
              {[
                { label: 'Date', value: confirmData.date },
                { label: 'Time', value: confirmData.time },
                { label: 'Timezone', value: confirmData.timezone },
                { label: 'Location', value: confirmData.location || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between bg-teal-900/60 rounded-xl px-4 py-3">
                  <span className="text-silver/70 text-xs uppercase tracking-wide pt-0.5">{label}</span>
                  <span className="text-bone/90 text-sm text-right max-w-[55%]">{value}</span>
                </div>
              ))}
            </div>

            {locationError && (
              <p className="text-amber-400/80 text-xs mb-4 text-center">{locationError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={dismissConfirm}
                className="flex-1 py-2.5 border border-teal-600 text-silver hover:text-bone/90
                           rounded-xl text-sm transition-colors"
              >
                Go Back & Edit
              </button>
              <button
                onClick={confirmNow}
                className="flex-1 py-2.5 bg-copper-400 hover:bg-copper-300 text-teal-900
                           font-semibold rounded-xl text-sm transition-all"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg">
        <StepIndicator current={2} />

        <div className="text-center mb-8">
          <h2 className="text-2xl font-serif text-bone mb-1">The Moment of Reception</h2>
          <p className="text-silver/70 text-sm">When and where was the petition received and understood?</p>
        </div>

        {/* Question reminder */}
        <div className="bg-teal-900/40 border border-teal-600/30 rounded-xl px-4 py-3 mb-4 text-sm text-silver italic">
          "{question}"
        </div>

        {/* Historical Rule Callout */}
        <div className="bg-teal-700/30 border border-copper-400/20 rounded-xl px-4 py-3 mb-6 text-xs text-copper-300">
          📜 <strong>Traditional Horary Rule:</strong> The chart is cast for the exact moment the astrologer receives and understands the petition. Select the coordinate parameters for the casebook logging.
        </div>

        <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-7 backdrop-blur-sm space-y-5">

          {/* Quick buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleNow}
              disabled={locating}
              className="flex-1 py-2 text-sm font-medium border border-copper-400/40 text-copper-400
                         rounded-lg hover:bg-copper-400/10 disabled:opacity-60 transition-colors"
            >
              {locating ? '⌛ Detecting…' : '⚡ Now'}
            </button>
            <button
              onClick={handleEarlier}
              className="flex-1 py-2 text-sm font-medium border border-teal-600 text-silver
                         rounded-lg hover:bg-teal-700/40 transition-colors"
            >
              ⏮ Earlier (−2h)
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => patch('date', e.target.value)}
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-2.5
                         text-bone focus:outline-none focus:border-copper-400/60 transition-colors"
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-1.5">Time</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => patch('time', e.target.value)}
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-2.5
                         text-bone focus:outline-none focus:border-copper-400/60 transition-colors"
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => patch('timezone', e.target.value)}
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-2.5
                         text-bone focus:outline-none focus:border-copper-400/60 transition-colors"
            >
              {TIMEZONES.map(({ group, zones }) => (
                <optgroup key={group} label={group}>
                  {zones.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => {
                patch('location', e.target.value);
                patch('latitude', null);
                patch('longitude', null);
              }}
              placeholder="City, Country — e.g. Tampa, USA"
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-2.5
                         text-bone placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 transition-colors"
            />
            <p className="text-silver/40 text-xs mt-1">City name is geocoded automatically</p>
          </div>

          {/* Interpretive Tradition */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-2">
              Interpretive Tradition
            </label>
            <div className="space-y-1.5">
              {TRADITIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    patch('tradition', t.id);
                    patch('houseSystem', t.houseSystem);
                  }}
                  className={`w-full text-left rounded-xl px-4 py-3 border transition-all
                    ${form.tradition === t.id
                      ? 'border-copper-400/60 bg-copper-400/8 ring-1 ring-copper-400/20'
                      : 'border-teal-600 bg-teal-900/40 hover:border-teal-600'}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm font-medium ${form.tradition === t.id ? 'text-bone' : 'text-bone/75'}`}>
                      {t.name}
                    </span>
                    <span className="text-copper-400/60 text-xs shrink-0 ml-2">{t.era}</span>
                  </div>
                  <p className="text-xs text-silver/70 leading-snug">{t.description}</p>
                </button>
              ))}
            </div>
            <p className="text-silver/40 text-xs mt-1.5">Selecting a tradition also sets the default house system</p>
          </div>

          {/* House System */}
          <div>
            <label className="text-silver text-xs uppercase tracking-wide block mb-1.5">House System</label>
            <select
              value={form.houseSystem}
              onChange={(e) => patch('houseSystem', e.target.value)}
              className="w-full bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-2.5
                         text-bone focus:outline-none focus:border-copper-400/60 transition-colors"
            >
              <option value="Regiomontanus">Regiomontanus (traditional horary)</option>
              <option value="Placidus">Placidus</option>
              <option value="Whole Sign">Whole Sign</option>
              <option value="Equal">Equal</option>
              <option value="Porphyry">Porphyry</option>
              <option value="Koch">Koch</option>
            </select>
            <p className="text-silver/40 text-xs mt-1">Override if you prefer a different system</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => navigate('/ask')}
              className="px-5 py-3 text-silver/70 hover:text-bone/75 text-sm border border-teal-600
                         rounded-xl transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!valid}
              className="flex-1 bg-copper-400 hover:bg-copper-300 disabled:opacity-30 disabled:cursor-not-allowed
                         text-teal-900 font-semibold py-3 rounded-xl transition-all text-sm"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
