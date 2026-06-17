// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

function getLon(p) {
  const idx = ZODIAC_SIGNS.indexOf(p.sign);
  return ((idx < 0 ? 0 : idx) * 30) + (p.sign_degree || 0);
}

// Approximate tropical longitudes for 2026 (precessed ~0.37° from J2000 values).
export const FIXED_STARS = [
  { name: 'Regulus', lon: 150.0, nature: 'benefic', gloss: 'honor and success; risk of sudden reversal if afflicted' },
  { name: 'Spica',   lon: 204.0, nature: 'benefic', gloss: 'fortune, gifts, and success — one of the most benefic stars' },
  { name: 'Algol',   lon:  56.1, nature: 'malefic', gloss: 'violence, misfortune, and loss — one of the most malefic stars' },
  { name: 'Antares', lon: 249.8, nature: 'malefic', gloss: 'conflict, recklessness, and danger' },
];

const ORB = 1.0;

/**
 * Returns conjunctions (within 1°) between planets and the four most-watched
 * fixed stars (Regulus, Spica, Algol, Antares).
 *
 * @param {Object} ephemerisData - Full ephemeris response.
 * @param {Set<string>|null} sigSet - If provided, only checks planets in this set.
 *   Pass null to check all planets.
 * @returns {Array<{ planet, star, nature, gloss, orb }>}
 *   Sorted: malefic hits first, then by tightest orb.
 */
export function getFixedStarHits(ephemerisData, sigSet = null) {
  if (!ephemerisData?.planets) return [];
  const { planets } = ephemerisData;

  const hits = [];

  for (const [name, p] of Object.entries(planets)) {
    if (!p?.sign) continue;
    if (sigSet && !sigSet.has(name)) continue;

    const lon = getLon(p);
    for (const star of FIXED_STARS) {
      const diff = ((lon - star.lon + 180) % 360 + 360) % 360 - 180;
      const orb = Math.abs(diff);
      if (orb <= ORB) {
        hits.push({ planet: name, star: star.name, nature: star.nature, gloss: star.gloss, orb: parseFloat(orb.toFixed(2)) });
      }
    }
  }

  return hits.sort((a, b) => {
    if (a.nature !== b.nature) return a.nature === 'malefic' ? -1 : 1;
    return a.orb - b.orb;
  });
}
