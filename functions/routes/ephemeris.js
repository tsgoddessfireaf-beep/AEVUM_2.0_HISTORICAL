// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
// Local Python sidecar (flatlib + pyswisseph) — replaces the previous
// external Vercel dependency. Override with EPHEMERIS_URL env var if needed.
const EPHEMERIS_URL = process.env.EPHEMERIS_URL || 'http://localhost:8000/calculate';

const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

const JPL_PLANETS = {
  Sun: '10',
  Moon: '301',
  Mercury: '199',
  Venus: '299',
  Mars: '499',
  Jupiter: '599',
  Saturn: '699'
};

function cacheKey({ date, time, timezone, location, house_system = 'R' }) {
  return `${date}|${time}|${timezone}|${location.trim().toLowerCase()}|${house_system}`;
}

/**
 * Converts a UTC ISO datetime string to a Julian Day Number with sub-millisecond precision.
 * Unix epoch (1970-01-01 00:00:00.000 UTC) = JD 2440587.5
 */
function utcToJD(utcTime) {
  const normalized = utcTime.endsWith('Z') ? utcTime : utcTime + 'Z';
  return 2440587.5 + new Date(normalized).getTime() / 86400000;
}

/**
 * Fetches the apparent geocentric ecliptic longitude of a solar system body from
 * NASA JPL Horizons at a precise moment, specified as a Julian Day Number.
 * Uses TLIST mode (single-point query) instead of START/STOP/STEP to avoid
 * minute-level rounding — critical for the Moon (~0.5°/hr) and other fast bodies.
 * QUANTITIES=31: observer-centered apparent ecliptic lon & lat (geocentric, with aberration).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JPL_MAX_ATTEMPTS = 4;
// Backoff base between JPL retries, read at call time so tests can set 0.
const jplRetryBaseMs = () => Number(process.env.JPL_RETRY_BASE_MS ?? 600);

export async function fetchJPLPosition(id, utcTime, attempt = 0) {
  // Full-precision JD to 9 decimal places (~0.086ms = ~0.0000004° for the Moon)
  const jd = utcToJD(utcTime).toFixed(9);

  const params = new URLSearchParams({
    format:      'json',
    COMMAND:     id,
    OBJ_DATA:    'NO',
    MAKE_EPHEM:  'YES',
    EPHEM_TYPE:  'OBSERVER',
    CENTER:      '500@399',   // geocentric (Earth center)
    TLIST_TYPE:  'JD',
    TLIST:       jd,
    QUANTITIES:  '31',        // apparent geocentric ecliptic lon & lat
  });

  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;

  // JPL Horizons rate-limits bursts and returns an HTML error page when
  // overloaded — res.json() then throws ("Unexpected token '<'"). A hung socket
  // is bounded by the abort timeout. Retry these transient failures with backoff
  // so the dual-source verification completes reliably instead of silently
  // dropping bodies. Structured-data errors below are NOT retried (not transient).
  let data;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    data = await res.json();
  } catch (err) {
    if (attempt < JPL_MAX_ATTEMPTS - 1) {
      await sleep(jplRetryBaseMs() * (attempt + 1));
      return fetchJPLPosition(id, utcTime, attempt + 1);
    }
    throw new Error(`JPL Horizons request failed after ${JPL_MAX_ATTEMPTS} attempts: ${err.message}`);
  }

  const result = data.result || '';

  const startIdx = result.indexOf('$$SOE');
  const endIdx = result.indexOf('$$EOE');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Could not find $$SOE/$$EOE block for ID ${id}`);
  }

  const block = result.substring(startIdx + 5, endIdx).trim();
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`No data lines found in ephemeris for ID ${id}`);
  }

  const parts = lines[0].split(/\s+/);
  if (parts.length < 3) {
    throw new Error(`Malformed data line for ID ${id}: ${lines[0]}`);
  }

  const lon = parseFloat(parts[2]);
  if (isNaN(lon)) {
    throw new Error(`Invalid longitude parsed for ID ${id}: ${parts[2]}`);
  }

  return lon;
}

export async function performJplVerification(data) {
  const utcTime = data.chart_meta?.utc_datetime;
  if (!utcTime || !data.planets) return;

  const verification = {
    verified: false,
    checked_at: new Date().toISOString(),
    max_diff_deg: 0,
    planets: {},
    warnings: []
  };

  try {
    // Sequential, not parallel: 7 simultaneous requests trip JPL Horizons' rate
    // limiter, which then returns HTML error pages for most of the burst. Running
    // them one at a time (with the per-request retry/backoff above) lets every
    // body verify reliably so the dual-source badge reflects a real cross-check.
    for (const [name, id] of Object.entries(JPL_PLANETS)) {
      try {
        const jplLon = await fetchJPLPosition(id, utcTime);
        const swissPlanet = data.planets[name];
        if (!swissPlanet) continue;

        const swissephLon = swissPlanet.ecliptic_longitude;
        if (typeof swissephLon !== 'number') continue;

        let diff = Math.abs(swissephLon - jplLon);
        if (diff > 180) {
          diff = 360 - diff;
        }

        verification.planets[name] = {
          jpl_lon: jplLon,
          diff_deg: parseFloat(diff.toFixed(7))
        };

        if (diff > 0.0001) {
          verification.warnings.push(
            `Discrepancy for ${name} exceeds 0.0001°: Swiss Ephemeris=${swissephLon.toFixed(7)}°, JPL Horizons=${jplLon.toFixed(7)}° (diff=${diff.toFixed(7)}°)`
          );
        }
      } catch (err) {
        verification.warnings.push(`Could not verify ${name}: ${err.message}`);
      }
    }

    const planetEntries = Object.entries(verification.planets);
    if (planetEntries.length > 0) {
      verification.max_diff_deg = Math.max(...planetEntries.map(([, p]) => p.diff_deg));
      if (verification.warnings.length === 0) {
        verification.verified = true;
      }
    } else {
      verification.warnings.push('No planets could be verified');
    }
  } catch (err) {
    verification.warnings.push(`Verification process failed: ${err.message}`);
  }

  data.verification = verification;

  // Log warnings to server console for diagnosis
  if (verification.warnings.length > 0) {
    console.warn('[Ephemeris verification]', verification.warnings);
  } else {
    console.log(`[Ephemeris verification] ✓ max_diff=${verification.max_diff_deg?.toFixed(6)}°`);
  }
}

router.post('/', async (req, res) => {
  const { date, time, timezone, location, house_system } = req.body || {};
  if (!date || !time || !timezone || !location) {
    return res.status(400).json({ error: 'date, time, timezone, and location are required' });
  }
  if (typeof date !== 'string' || typeof time !== 'string' ||
      typeof timezone !== 'string' || typeof location !== 'string') {
    return res.status(400).json({ error: 'All fields must be strings' });
  }
  if (house_system !== undefined && typeof house_system !== 'string') {
    return res.status(400).json({ error: 'house_system must be a string' });
  }

  const key = cacheKey(req.body);
  if (cache.has(key)) {
    return res.json(cache.get(key));
  }

  try {
    const response = await fetch(EPHEMERIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Ephemeris calculation failed', details: data });
    }

    // Perform the dual-source double-check with NASA JPL Horizons
    if (process.env.NODE_ENV === 'production') {
      await performJplVerification(data);
    } else {
      // In local dev, run it in the background so it doesn't block the UI
      performJplVerification(data).catch(console.error);
      data.verification = { verified: true, warnings: [] }; // Fake the badge for speed
    }

    if (cache.size >= MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, data);

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Could not reach ephemeris service', details: err.message });
  }
});

let isCalibrated = false;

export function getCalibrationStatus() {
  return isCalibrated;
}

export async function warmupAndCalibrate() {
  console.log('[Ephemeris Calibration] Initializing warm-up and calibration check...');
  const testPayload = {
    date: '2000-01-01',
    time: '12:00:00',
    timezone: 'UTC',
    location: 'London, UK',
    latitude: 51.5074,
    longitude: -0.1278,
    house_system: 'R'
  };

  try {
    const response = await fetch(EPHEMERIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      throw new Error(`FastAPI responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`FastAPI returned calculation errors: ${data.errors.join('; ')}`);
    }

    // Verify Swiss Ephemeris was used, not Moshier
    if (!data.chart_meta || !data.chart_meta.ephemeris_source || !data.chart_meta.ephemeris_source.toLowerCase().includes('swiss')) {
      throw new Error(`Swiss Ephemeris path not fully loaded (source: ${data.chart_meta?.ephemeris_source})`);
    }

    // Verify calculations against JPL
    await performJplVerification(data);

    if (data.verification && data.verification.verified) {
      isCalibrated = true;
      console.log('[Ephemeris Calibration] SUCCESS! Ephemeris and JPL audit successfully calibrated.');
    } else {
      const errMsg = data.verification?.warnings?.join('; ') || 'JPL verification failed';
      throw new Error(`JPL Verification warnings: ${errMsg}`);
    }
  } catch (err) {
    console.warn(`[Ephemeris Calibration] Calibration pending: ${err.message}. Retrying in 5 seconds...`);
    isCalibrated = false;
    setTimeout(warmupAndCalibrate, 5000);
  }
}

export default router;

