// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Dev calibration tool for the AstroScript font.
// AstroScript reuses ASCII positions to render astrology glyphs, but the cmap
// names are nonsense (they say "A" but the outline is some sigil).
// This page renders every ASCII letter + digit so you can identify each glyph,
// then we lock the mapping into src/lib/glyphs.js.
//
// Visit: http://localhost:5173/font-calibrate

import { useState } from 'react';

const CHARS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789',
  ...'!@#$%^&*()_+-=[]{};:,.<>/?\\|`~',
];

const TARGETS = [
  // Planets
  { key: 'Sun',     unicode: '☉' },
  { key: 'Moon',    unicode: '☽' },
  { key: 'Mercury', unicode: '☿' },
  { key: 'Venus',   unicode: '♀' },
  { key: 'Mars',    unicode: '♂' },
  { key: 'Jupiter', unicode: '♃' },
  { key: 'Saturn',  unicode: '♄' },
  { key: 'Uranus',  unicode: '♅' },
  { key: 'Neptune', unicode: '♆' },
  { key: 'Pluto',   unicode: '♇' },
  { key: 'Node (North)', unicode: '☊' },
  // Signs
  { key: 'Aries',       unicode: '♈' },
  { key: 'Taurus',      unicode: '♉' },
  { key: 'Gemini',      unicode: '♊' },
  { key: 'Cancer',      unicode: '♋' },
  { key: 'Leo',         unicode: '♌' },
  { key: 'Virgo',       unicode: '♍' },
  { key: 'Libra',       unicode: '♎' },
  { key: 'Scorpio',     unicode: '♏' },
  { key: 'Sagittarius', unicode: '♐' },
  { key: 'Capricorn',   unicode: '♑' },
  { key: 'Aquarius',    unicode: '♒' },
  { key: 'Pisces',      unicode: '♓' },
];

/**
 * Dev-only tool for mapping AstroScript font characters to planet/sign names.
 * Visit /font-calibrate, click glyphs to assign them, then copy the generated
 * snippet into src/lib/glyphs.js. Not linked from the main app navigation.
 */
export default function FontCalibratePage() {
  const [mapping, setMapping] = useState({});

  /** @param {string} targetKey - Planet or sign name. @param {string} char - ASCII char mapped to that glyph. */
  function assign(targetKey, char) {
    setMapping((m) => ({ ...m, [targetKey]: char }));
  }
  /** @param {string} targetKey - Planet or sign name to clear from the mapping. */
  function unassign(targetKey) {
    setMapping((m) => {
      const next = { ...m };
      delete next[targetKey];
      return next;
    });
  }

  const assignedChars = new Set(Object.values(mapping));

  /**
   * Generates the ASTROSCRIPT_PLANETS / ASTROSCRIPT_SIGNS constant block
   * ready to paste into src/lib/glyphs.js from the current mapping state.
   * @returns {string}
   */
  function generateSnippet() {
    const planets = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
    const signs   = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const fmt = (k) => mapping[k] ? `'${mapping[k]}'` : "''";
    return `const ASTROSCRIPT_PLANETS = {
  Sun: ${fmt('Sun')}, Moon: ${fmt('Moon')}, Mercury: ${fmt('Mercury')}, Venus: ${fmt('Venus')}, Mars: ${fmt('Mars')},
  Jupiter: ${fmt('Jupiter')}, Saturn: ${fmt('Saturn')}, Uranus: ${fmt('Uranus')}, Neptune: ${fmt('Neptune')}, Pluto: ${fmt('Pluto')},
  Node: ${fmt('Node (North)')},
};

const ASTROSCRIPT_SIGNS = {
  Aries: ${fmt('Aries')}, Taurus: ${fmt('Taurus')}, Gemini: ${fmt('Gemini')}, Cancer: ${fmt('Cancer')}, Leo: ${fmt('Leo')}, Virgo: ${fmt('Virgo')},
  Libra: ${fmt('Libra')}, Scorpio: ${fmt('Scorpio')}, Sagittarius: ${fmt('Sagittarius')}, Capricorn: ${fmt('Capricorn')}, Aquarius: ${fmt('Aquarius')}, Pisces: ${fmt('Pisces')},
};`;
  }

  return (
    <div className="min-h-screen p-8 text-bone/90">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-serif text-copper-400 mb-2">AstroScript Calibration</h1>
        <p className="text-silver text-sm mb-8">
          For each planet/sign on the right, click the matching glyph on the left.
          When done, copy the snippet at the bottom into <code className="text-copper-300">src/lib/glyphs.js</code>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: character grid */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-silver/70 mb-3">Glyphs in font</h2>
            <div className="grid grid-cols-8 gap-2">
              {CHARS.map((ch) => {
                const used = assignedChars.has(ch);
                return (
                  <div
                    key={ch}
                    className={`flex flex-col items-center p-2 rounded border
                      ${used ? 'border-copper-400/60 bg-copper-400/5' : 'border-teal-600 bg-teal-900/40'}`}
                  >
                    <span className="astro-glyph text-3xl text-copper-300 leading-none mb-1">
                      {ch}
                    </span>
                    <span className="text-silver/40 text-[10px] font-mono">
                      {ch === ' ' ? 'space' : ch}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: target list */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-silver/70 mb-3">Targets</h2>
            <div className="space-y-2">
              {TARGETS.map(({ key, unicode }) => (
                <div key={key} className="flex items-center gap-3 bg-teal-900/40 border border-teal-600 rounded-lg px-3 py-2">
                  <span className="text-2xl text-silver w-10 text-center">{unicode}</span>
                  <span className="text-sm text-bone/90 w-32">{key}</span>
                  <select
                    value={mapping[key] || ''}
                    onChange={(e) => e.target.value ? assign(key, e.target.value) : unassign(key)}
                    className="flex-1 bg-teal-900 border border-teal-600 rounded px-2 py-1 text-sm"
                  >
                    <option value="">— pick a glyph —</option>
                    {CHARS.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                  {mapping[key] && (
                    <span className="astro-glyph text-2xl text-copper-300 w-8 text-center">
                      {mapping[key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Snippet output */}
        <div className="mt-10 bg-teal-900/80 border border-teal-600 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-silver/70">
              Paste into src/lib/glyphs.js
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(generateSnippet())}
              className="text-xs px-3 py-1 bg-copper-400 text-teal-900 rounded font-semibold"
            >
              Copy
            </button>
          </div>
          <pre className="text-xs text-bone/75 font-mono whitespace-pre-wrap leading-relaxed">
            {generateSnippet()}
          </pre>
        </div>
      </div>
    </div>
  );
}
