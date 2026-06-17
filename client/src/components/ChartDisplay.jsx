// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { PLANET_GLYPHS, SIGN_GLYPHS as SIGN_SYMBOLS, GLYPH_CLASS } from '../lib/glyphs.js';

/**
 * Converts an ecliptic longitude (0–360°) to a human-readable sign + degree string.
 * @param {number} lon - Ecliptic longitude in decimal degrees.
 * @returns {string} e.g. "Scorpio 14.3°"
 */
export function eclipticToSign(lon) {
  const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                 'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const idx = Math.floor(lon / 30) % 12;
  const deg = (lon % 30).toFixed(1);
  return `${signs[idx]} ${deg}°`;
}

function PlanetRow({ name, data }) {
  if (!data) return null;
  const glyph = PLANET_GLYPHS[name] || name[0];
  const signSym = SIGN_SYMBOLS[data.sign] || '';

  return (
    <tr className="border-t border-teal-900 hover:bg-teal-900/40 transition-colors">
      <td className="py-2 px-3 text-copper-400 font-medium">
        <span className={`mr-1.5 ${GLYPH_CLASS}`}>{glyph}</span>{name}
      </td>
      <td className="py-2 px-3 text-bone/90">
        <span className={GLYPH_CLASS}>{signSym}</span> {data.sign} {data.sign_degree}°
      </td>
      <td className="py-2 px-3 text-silver text-center">{data.house}</td>
      <td className="py-2 px-3 text-silver text-center">
        {data.is_retrograde ? <span className="text-amber-500">℞</span> : <span className="text-silver/40">—</span>}
      </td>
      <td className="py-2 px-3 text-silver/70 text-right text-xs">
        {data.daily_speed?.toFixed(3)}°
      </td>
    </tr>
  );
}

/**
 * Tabular display of the horary chart data — meta, angles, planet table, lunar phase, and house cusps.
 * Used inside the collapsible "Chart Data & Significations" section on ResultsPage.
 * @param {{ data: Object }} props - Full ephemeris response object.
 */
export default function ChartDisplay({ data }) {
  if (!data) return null;
  const { chart_meta, houses, planets, nodes, lunar_phase } = data;

  return (
    <div className="space-y-5">
      {/* Verification Badge */}
      {data.verification && (
        <div className="bg-teal-700/70 border border-copper-500/20 rounded-lg p-3.5 flex items-center justify-between shadow-lg shadow-copper-500/5 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <span className="text-copper-400 text-lg select-none">✦</span>
            <div>
              <div className="text-[11px] font-semibold text-copper-400 tracking-wider uppercase">
                {data.verification.verified ? 'Dual-Source Verified' : 'Swiss Ephemeris'}
              </div>
              <div className="text-[11px] text-silver font-serif">
                {data.verification.verified
                  ? 'Swiss Ephemeris & NASA JPL DE441 geocentric audit'
                  : 'Sub-arcsecond precision · NASA cross-check incomplete'}
              </div>
            </div>
          </div>
          <div className="text-right">
            {data.verification.verified ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 font-mono">
                Δ max: {data.verification.max_diff_deg?.toFixed(7)}°
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                Audit warning
              </span>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-teal-900/50 border border-teal-600/40 rounded-lg p-3">
          <div className="text-silver/70 text-xs uppercase tracking-wide mb-1">Date & Time (UTC)</div>
          <div className="text-bone/90">{chart_meta?.utc_datetime?.replace('T', ' ').slice(0, 19)}</div>
        </div>
        <div className="bg-teal-900/50 border border-teal-600/40 rounded-lg p-3">
          <div className="text-silver/70 text-xs uppercase tracking-wide mb-1">Location</div>
          <div className="text-bone/90 truncate">{chart_meta?.resolved_place_name || 'Unknown'}</div>
          <div className="text-silver/70 text-xs">{chart_meta?.resolved_latitude?.toFixed(3)}°N, {chart_meta?.resolved_longitude?.toFixed(3)}°E</div>
        </div>
      </div>

      {/* Angles */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-teal-900/50 border border-copper-400/20 rounded-lg p-3">
          <div className="text-copper-400 text-xs uppercase tracking-wide mb-1">Ascendant</div>
          <div className="text-bone font-medium font-serif text-base">{eclipticToSign(houses?.ascendant)}</div>
        </div>
        <div className="bg-teal-900/50 border border-copper-400/20 rounded-lg p-3">
          <div className="text-copper-400 text-xs uppercase tracking-wide mb-1">Midheaven (MC)</div>
          <div className="text-bone font-medium font-serif text-base">{eclipticToSign(houses?.mc)}</div>
        </div>
      </div>

      {/* Planets table */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-silver/70 mb-2">Planets</h3>
        <div className="rounded-lg border border-teal-600/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-900/80">
                <th className="py-2 px-3 text-left text-silver/70 font-medium text-xs">Planet</th>
                <th className="py-2 px-3 text-left text-silver/70 font-medium text-xs">Position</th>
                <th className="py-2 px-3 text-center text-silver/70 font-medium text-xs">House</th>
                <th className="py-2 px-3 text-center text-silver/70 font-medium text-xs">℞</th>
                <th className="py-2 px-3 text-right text-silver/70 font-medium text-xs">Speed</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(planets || {}).map(([name, pData]) => (
                <PlanetRow key={name} name={name} data={pData} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Moon phase + Node */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-teal-900/50 border border-teal-600/40 rounded-lg p-3 space-y-1">
          <div className="text-silver/70 text-xs uppercase tracking-wide">Lunar Phase</div>
          <div className="text-bone/90">
            {lunar_phase?.moon_phase_angle?.toFixed(1)}°
            {' — '}
            {lunar_phase?.moon_is_waxing ? 'Waxing' : 'Waning'}
          </div>
          {lunar_phase?.moon_is_void && (
            <div className="text-amber-500 text-xs font-medium">⚠ Moon Void of Course</div>
          )}
        </div>
        <div className="bg-teal-900/50 border border-teal-600/40 rounded-lg p-3 space-y-1">
          <div className="text-silver/70 text-xs uppercase tracking-wide">Mean North Node ☊</div>
          <div className="text-bone/90">{nodes?.mean_north_node?.sign} {nodes?.mean_north_node?.sign_degree}°</div>
        </div>
      </div>

      {/* House cusps */}
      <details className="group">
        <summary className="text-xs uppercase tracking-widest text-silver/70 cursor-pointer hover:text-silver select-none">
          House Cusps ({houses?.system}) ▸
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
          {Object.entries(houses?.cusps || {}).map(([h, lon]) => (
            <div key={h} className="bg-teal-900/40 rounded px-2 py-1.5 flex justify-between">
              <span className="text-silver/70">H{h}</span>
              <span className="text-bone/75">{eclipticToSign(lon)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
