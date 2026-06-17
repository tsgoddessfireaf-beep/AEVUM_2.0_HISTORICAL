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

function angularSep(a, b) {
  const diff = ((a - b) % 360 + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

const CLASSICAL = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const ASPECT_DELTAS = [0, 60, 90, 120, 180];

/**
 * Returns an array of horary condition warnings derived from ephemeris data.
 * Covers: cazimi, combustion, under the beams, void-of-course Moon.
 *
 * Each warning: { type, planet?, sep?, severity, label }
 * severity: 'positive' | 'severe' | 'mild' | 'caution'
 */
export function getChartWarnings(ephemerisData) {
  if (!ephemerisData?.planets) return [];
  const { planets } = ephemerisData;
  const warnings = [];

  const sun = planets.Sun;
  if (sun) {
    const sunLon = getLon(sun);
    for (const pName of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      const p = planets[pName];
      if (!p) continue;
      const sep = angularSep(getLon(p), sunLon);
      if (sep < 0.5) {
        warnings.push({
          type: 'cazimi', planet: pName, sep, severity: 'positive',
          label: `${pName} is cazimi (within 0.5° of the Sun — greatly strengthened)`,
        });
      } else if (sep < 8.5) {
        warnings.push({
          type: 'combust', planet: pName, sep, severity: 'severe',
          label: `${pName} is combust (${sep.toFixed(1)}° from the Sun — severely weakened)`,
        });
      } else if (sep < 17) {
        warnings.push({
          type: 'under_beams', planet: pName, sep, severity: 'mild',
          label: `${pName} is under the Sun's beams (${sep.toFixed(1)}° — weakened)`,
        });
      }
    }
  }

  const moon = planets.Moon;
  if (moon) {
    // Via Combusta — Moon between 15° Libra and 15° Scorpio
    const moonLon = getLon(moon);
    if (moonLon >= 195 && moonLon <= 225) {
      warnings.push({
        type: 'via_combusta',
        severity: 'severe',
        label: 'Moon is Via Combusta (15° Libra – 15° Scorpio) — testimony is severely weakened',
      });
    }

    // Use the flag from the ephemeris service if available; otherwise calculate.
    if (ephemerisData.lunar_phase?.moon_is_void === true) {
      warnings.push(vocWarning());
    } else if (ephemerisData.lunar_phase?.moon_is_void !== false) {
      const moonLon = getLon(moon);
      const degreesToExit = 30 - (moonLon % 30);
      let applying = false;

      outer: for (const pName of CLASSICAL) {
        const p = planets[pName];
        if (!p) continue;
        const pLon = getLon(p);
        for (const delta of ASPECT_DELTAS) {
          const pts = (delta === 0 || delta === 180)
            ? [((pLon + delta) % 360 + 360) % 360]
            : [((pLon + delta) % 360 + 360) % 360, ((pLon - delta) % 360 + 360) % 360];
          for (const ap of pts) {
            const dist = ((ap - moonLon) % 360 + 360) % 360;
            if (dist > 0 && dist <= degreesToExit) { applying = true; break outer; }
          }
        }
      }

      if (!applying) warnings.push(vocWarning());
    }
  }

  return warnings;
}

function vocWarning() {
  return {
    type: 'void_of_course',
    severity: 'caution',
    label: 'The Moon is void of course — outcomes may not unfold as expected, or the matter may come to nothing',
  };
}

export function getStrictures(ephemerisData) {
  if (!ephemerisData?.houses || !ephemerisData?.planets) return [];
  const strictures = [];

  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const ascDeg = ((ascLon % 30) + 30) % 30;

  if (ascDeg < 3) {
    strictures.push({
      type: 'early_asc',
      label: `Ascendant is early (${ascDeg.toFixed(1)}° in sign) — the matter may be too new; the chart cannot speak clearly yet`,
    });
  } else if (ascDeg > 27) {
    strictures.push({
      type: 'late_asc',
      label: `Ascendant is late (${ascDeg.toFixed(1)}° in sign) — the matter may have already passed its turning point`,
    });
  }

  const saturnHouse = ephemerisData.planets.Saturn?.house;
  if (saturnHouse === 1 || saturnHouse === '1') {
    strictures.push({
      type: 'saturn_1st',
      label: 'Saturn in the 1st house — tread carefully; the astrologer may err in judgment (Lilly)',
    });
  } else if (saturnHouse === 7 || saturnHouse === '7') {
    strictures.push({
      type: 'saturn_7th',
      label: 'Saturn in the 7th house — tread carefully; the astrologer may err in judgment (Lilly)',
    });
  }

  return strictures;
}
