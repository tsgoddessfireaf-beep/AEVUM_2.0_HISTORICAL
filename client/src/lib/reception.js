// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Reception = a planet is placed in a sign where another planet holds dignity.
// Only rulership and exaltation are used — triplicity/term/face receptions are
// recognised by some authorities but are too weak to surface in the UI.

const RULERSHIPS = {
  Sun:     ['Leo'],
  Moon:    ['Cancer'],
  Mercury: ['Gemini', 'Virgo'],
  Venus:   ['Taurus', 'Libra'],
  Mars:    ['Aries', 'Scorpio'],
  Jupiter: ['Sagittarius', 'Pisces'],
  Saturn:  ['Capricorn', 'Aquarius'],
};

const EXALTATIONS = {
  Sun:     'Aries',
  Moon:    'Taurus',
  Mercury: 'Virgo',
  Venus:   'Pisces',
  Mars:    'Capricorn',
  Jupiter: 'Cancer',
  Saturn:  'Libra',
};

const CLASSICAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

/** Returns 'rulership', 'exaltation', or null for `host` planet's dignity in `sign`. */
function dignityIn(host, sign) {
  if (RULERSHIPS[host]?.includes(sign)) return 'rulership';
  if (EXALTATIONS[host] === sign)       return 'exaltation';
  return null;
}

/**
 * Returns all reception relationships among the 7 classical planets.
 *
 * Reception means: planet A is in a sign where planet B holds dignity (A is received by B),
 * and/or planet B is in a sign where planet A holds dignity (B is received by A).
 *
 * Each result shape:
 * {
 *   p1, p2,           — pair (p1 is earlier in Chaldean order)
 *   mutual,           — true when both planets receive each other
 *   type,             — 'mutual_rulership' | 'mutual_exaltation' | 'mutual_mixed' | 'one_way'
 *   p1ReceivesP2,     — 'rulership' | 'exaltation' | null  (p2 is in p1's dignity)
 *   p2ReceivesP1,     — 'rulership' | 'exaltation' | null  (p1 is in p2's dignity)
 * }
 */
export function getReceptions(ephemerisData) {
  if (!ephemerisData?.planets) return [];
  const { planets } = ephemerisData;
  const results = [];

  for (let i = 0; i < CLASSICAL.length; i++) {
    for (let j = i + 1; j < CLASSICAL.length; j++) {
      const pA = CLASSICAL[i], pB = CLASSICAL[j];
      const a = planets[pA], b = planets[pB];
      if (!a?.sign || !b?.sign) continue;

      // pA receives pB = pB is in pA's dignity
      const aReceivesB = dignityIn(pA, b.sign);
      // pB receives pA = pA is in pB's dignity
      const bReceivesA = dignityIn(pB, a.sign);

      if (!aReceivesB && !bReceivesA) continue;

      const mutual = !!(aReceivesB && bReceivesA);
      let type;
      if (!mutual) {
        type = 'one_way';
      } else if (aReceivesB === 'rulership' && bReceivesA === 'rulership') {
        type = 'mutual_rulership';
      } else if (aReceivesB === 'exaltation' && bReceivesA === 'exaltation') {
        type = 'mutual_exaltation';
      } else {
        type = 'mutual_mixed';
      }

      results.push({ p1: pA, p2: pB, mutual, type, p1ReceivesP2: aReceivesB, p2ReceivesP1: bReceivesA });
    }
  }

  return results;
}

/**
 * Builds a human-readable label for a reception entry.
 * Optionally notes when the pair is also in an applying aspect.
 *
 * @param {Object} rec       — reception entry from getReceptions()
 * @param {Object[]} aspects — from getAspects(), used to detect perfection boost
 */
export function receptionLabel(rec, aspects = []) {
  const { p1, p2, mutual, type, p1ReceivesP2, p2ReceivesP1 } = rec;

  let base;
  if (mutual) {
    const byWhat = type === 'mutual_rulership' ? 'rulership'
                 : type === 'mutual_exaltation' ? 'exaltation'
                 : 'rulership & exaltation';
    base = `${p1} and ${p2} — mutual reception by ${byWhat}`;
  } else if (p1ReceivesP2) {
    base = `${p1} receives ${p2} by ${p1ReceivesP2}`;
  } else {
    base = `${p2} receives ${p1} by ${p2ReceivesP1}`;
  }

  // Note if the pair is also in an applying aspect — combination strengthens perfection
  const aspecting = aspects.find(
    a => a.applying && ((a.p1 === p1 && a.p2 === p2) || (a.p1 === p2 && a.p2 === p1))
  );
  if (aspecting) {
    base += ` + applying ${aspecting.aspect.toLowerCase()} — perfection strongly indicated`;
  }

  return base;
}
