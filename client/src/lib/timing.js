// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

export const SIGN_MODES = {
  Aries: 'cardinal', Cancer: 'cardinal', Libra: 'cardinal', Capricorn: 'cardinal',
  Taurus: 'fixed',   Leo: 'fixed',      Scorpio: 'fixed',   Aquarius: 'fixed',
  Gemini: 'mutable', Virgo: 'mutable',  Sagittarius: 'mutable', Pisces: 'mutable',
};

export const MODE_UNITS = { cardinal: 'days', mutable: 'weeks', fixed: 'months' };

/**
 * Derives a traditional timing estimate from the tightest applying aspect between
 * the querent and quesited lords.
 *
 * Method (William Lilly): take the orb of the applying aspect in degrees; translate
 * using the sign mode of the faster (applying) planet:
 *   Cardinal  → days
 *   Mutable   → weeks
 *   Fixed     → months
 *
 * Returns null when there is no applying sig-to-sig aspect in orb.
 *
 * @returns {{ aspect, faster, sign, mode, unit, estimate } | null}
 *   aspect   — the aspect object from getAspects()
 *   faster   — name of the applying planet
 *   sign     — sign the applying planet occupies
 *   mode     — 'cardinal' | 'mutable' | 'fixed'
 *   unit     — 'days' | 'weeks' | 'months'
 *   estimate — number of units (= orb in degrees)
 */
export function getTiming(aspects, querentLord, quesitedLord, ephemerisData) {
  if (!querentLord || !quesitedLord || !ephemerisData?.planets) return null;

  const sigSet = new Set([querentLord, quesitedLord]);

  const applying = aspects
    .filter(a => sigSet.has(a.p1) && sigSet.has(a.p2) && a.applying)
    .sort((a, b) => a.orb - b.orb);

  if (!applying.length) return null;

  const a = applying[0];
  const fasterPlanet = ephemerisData.planets[a.faster];
  if (!fasterPlanet?.sign) return null;

  const sign = fasterPlanet.sign;
  const mode = SIGN_MODES[sign];
  if (!mode) return null;

  return {
    aspect:   a,
    faster:   a.faster,
    sign,
    mode,
    unit:     MODE_UNITS[mode],
    estimate: parseFloat(a.orb.toFixed(1)),
  };
}
