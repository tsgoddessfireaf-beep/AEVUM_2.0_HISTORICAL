// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { describe, it, expect } from 'vitest';
import { getAlmuten, getPlanetaryDignities } from './dignity.js';

describe('getAlmuten', () => {
  it('returns the planet with the highest cumulative dignity score', () => {
    // Aries 5° — Mars has rulership (+5) + term (Jupiter 0-6 → Jupiter +2, not Mars)
    // Let's think: Aries 5°: rulership=Mars(5), exaltation=Sun(4), triplicity-day=Sun(3), term=Jupiter(2), face/decan=Mars(1)
    // Day chart: Mars=5+1=6, Sun=4+3=7, Jupiter=2 → Sun wins
    const result = getAlmuten('Aries', 5, true);
    expect(result).not.toBeNull();
    expect(result.planet).toBe('Sun'); // exaltation(4) + triplicity day(3) = 7
    expect(result.score).toBe(7);
  });

  it('returns a result for every sign and degree without throwing', () => {
    const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                   'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    for (const sign of SIGNS) {
      for (const deg of [0, 10, 20, 29]) {
        const result = getAlmuten(sign, deg, true);
        expect(result).not.toBeNull();
        expect(result.score).toBeGreaterThan(0);
      }
    }
  });

  it('gives different results for day vs night chart (triplicity differs)', () => {
    // Leo 15°: triplicity day=Sun, night=Jupiter
    // Rulership: Sun(5), exaltation: none, term at 15° = Saturn(11-18→Saturn=2), face = Jupiter(1)
    // Day: Sun = 5+3=8, Saturn=2, Jupiter=1
    // Night: Sun=5, Jupiter=3+1=4 → still Sun wins, but scores differ
    const day   = getAlmuten('Leo', 15, true);
    const night = getAlmuten('Leo', 15, false);
    expect(day.planet).toBe('Sun');  // Sun has rulership regardless
    // Scores differ because triplicity ruler changes
    expect(day.score).not.toBe(night.score);
  });

  it('a planet with multiple dignities accumulates the total', () => {
    // Virgo 7° — Mercury has rulership(5) + exaltation(4) + triplicity night(3) + term(0-7=Mercury=2)
    // night: Mercury = 5+4+3+2 = 14
    const result = getAlmuten('Virgo', 7, false);
    expect(result.planet).toBe('Mercury');
    expect(result.score).toBeGreaterThan(8);
  });
});

describe('getPlanetaryDignities', () => {
  it('returns empty for missing data', () => {
    expect(getPlanetaryDignities(null)).toEqual([]);
    expect(getPlanetaryDignities({})).toEqual([]);
  });

  it('returns 7 entries for a full chart', () => {
    const eph = {
      planets: {
        Sun:     { sign: 'Leo',       sign_degree: 15 },
        Moon:    { sign: 'Cancer',    sign_degree: 10 },
        Mercury: { sign: 'Virgo',     sign_degree: 5  },
        Venus:   { sign: 'Libra',     sign_degree: 20 },
        Mars:    { sign: 'Aries',     sign_degree: 5  },
        Jupiter: { sign: 'Cancer',    sign_degree: 0  },
        Saturn:  { sign: 'Capricorn', sign_degree: 0  },
      },
      houses: { ascendant: 270, cusps: {} },
    };
    const result = getPlanetaryDignities(eph);
    expect(result).toHaveLength(7);
  });

  it('correctly identifies Sun in Leo as Rulership', () => {
    const eph = {
      planets: { Sun: { sign: 'Leo', sign_degree: 10 } },
      houses: { ascendant: 0, cusps: {} },
    };
    const result = getPlanetaryDignities(eph);
    expect(result[0].dignity.type).toBe('rulership');
  });

  it('correctly identifies Mars in Libra as Detriment', () => {
    const eph = {
      planets: { Mars: { sign: 'Libra', sign_degree: 15 } },
      houses: { ascendant: 0, cusps: {} },
    };
    const result = getPlanetaryDignities(eph);
    expect(result[0].dignity.type).toBe('detriment');
  });
});
