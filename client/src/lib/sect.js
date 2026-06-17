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

const DIURNAL_PLANETS  = new Set(['Sun', 'Jupiter', 'Saturn']);
const NOCTURNAL_PLANETS = new Set(['Moon', 'Venus', 'Mars']);
// Masculine (diurnal) signs; feminine signs are the other six
export const DIURNAL_SIGNS  = new Set(['Aries','Gemini','Leo','Libra','Sagittarius','Aquarius']);
export const NOCTURNAL_SIGNS = new Set(['Taurus','Cancer','Virgo','Scorpio','Capricorn','Pisces']);

const CLASSICAL = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];

/**
 * Returns true for a day chart (Sun above the horizon), false for night, null if data missing.
 * Uses the same formula as dignity.js and lots.js.
 */
export function isDayChart(ephemerisData) {
  const sun = ephemerisData?.planets?.Sun;
  if (!sun?.sign || ephemerisData?.houses?.ascendant == null) return null;
  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const sunLon = getLon(sun);
  return ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;
}

/**
 * Returns hayz data for each of the 7 classical planets.
 *
 * A planet is fully in hayz when all three conditions are met:
 *   Diurnal planet (Sun, Jupiter, Saturn): day chart + masculine sign + above horizon (house 7–12)
 *   Nocturnal planet (Moon, Venus, Mars): night chart + feminine sign + below horizon (house 1–6)
 *   Mercury: treated as sharing the chart's sect (diurnal in day charts, nocturnal in night charts)
 *
 * @returns {Array<{ planet, diurnal, inSectChart, inSectSign, inSectHemisphere, hayz }>}
 */
export function getHayz(ephemerisData) {
  const dayChart = isDayChart(ephemerisData);
  if (dayChart === null || !ephemerisData?.planets) return [];
  const { planets } = ephemerisData;

  return CLASSICAL.map(name => {
    const p = planets[name];
    if (!p?.sign) return null;

    const diurnal = DIURNAL_PLANETS.has(name)  ? true
                  : NOCTURNAL_PLANETS.has(name) ? false
                  : dayChart; // Mercury follows chart sect

    const inSectChart      = diurnal === dayChart;
    const inSectSign       = diurnal ? DIURNAL_SIGNS.has(p.sign) : NOCTURNAL_SIGNS.has(p.sign);
    const aboveHorizon     = (p.house ?? 1) >= 7;
    const inSectHemisphere = diurnal === aboveHorizon; // diurnal wants above, nocturnal wants below

    return {
      planet: name,
      diurnal,
      inSectChart,
      inSectSign,
      inSectHemisphere,
      hayz: inSectChart && inSectSign && inSectHemisphere,
    };
  }).filter(Boolean);
}
