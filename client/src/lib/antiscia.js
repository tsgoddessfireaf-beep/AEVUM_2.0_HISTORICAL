// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const ZODIAC = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const CLASSICAL = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];

function planetLon(p) {
  const idx = ZODIAC.indexOf(p.sign);
  if (idx < 0) return null;
  return idx * 30 + (p.sign_degree || 0);
}

function lonToSignDeg(lon) {
  const l = ((lon % 360) + 360) % 360;
  return { sign: ZODIAC[Math.floor(l / 30)], degree: parseFloat((l % 30).toFixed(2)) };
}

/**
 * Returns antiscia and contra-antiscia connections between classical planets.
 *
 * Antiscia: mirror across the Cancer/Capricorn (solstice) axis.
 *   Formula: antiscion(L) = (180 − L + 360) % 360
 * Contra-antiscia: mirror across the Aries/Libra (equinox) axis.
 *   Formula: contrantiscion(L) = (360 − L) % 360
 *
 * @param {Object} ephemerisData
 * @param {number} [orb=1.5] - Orb in degrees
 * @returns {Array<{p1, p2, type, orb, antiscionLon, sign, degree}>}
 */
export function getAntiscia(ephemerisData, orb = 1.5) {
  if (!ephemerisData?.planets) return [];
  const { planets } = ephemerisData;
  const bodies = CLASSICAL
    .filter(n => planets[n]?.sign)
    .map(n => ({ name: n, lon: planetLon(planets[n]) }))
    .filter(b => b.lon != null);

  const results = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];

      // Antiscion of a
      const antiscionA = ((180 - a.lon) % 360 + 360) % 360;
      const diffA = ((b.lon - antiscionA + 180) % 360 + 360) % 360 - 180;
      if (Math.abs(diffA) <= orb) {
        results.push({
          p1: a.name, p2: b.name,
          type: 'antiscia',
          orb: parseFloat(Math.abs(diffA).toFixed(2)),
          antiscionLon: antiscionA,
          ...lonToSignDeg(antiscionA),
        });
      }

      // Contra-antiscion of a
      const contrantA = ((360 - a.lon) % 360 + 360) % 360;
      const diffC = ((b.lon - contrantA + 180) % 360 + 360) % 360 - 180;
      if (Math.abs(diffC) <= orb) {
        results.push({
          p1: a.name, p2: b.name,
          type: 'contra-antiscia',
          orb: parseFloat(Math.abs(diffC).toFixed(2)),
          antiscionLon: contrantA,
          ...lonToSignDeg(contrantA),
        });
      }
    }
  }

  return results.sort((a, b) => a.orb - b.orb);
}
