// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { describe, it, expect } from 'vitest';
import { getTiming, MODE_UNITS } from './timing.js';

function makeAspect(p1, p2, orb, applying, faster) {
  return { p1, p2, aspect: 'Trine', abbr: 'Tri', angle: 120, orb, applying, faster };
}

function makeEph(planetSign) {
  return {
    planets: {
      Mars:   { sign: planetSign, sign_degree: 5, is_retrograde: false },
      Venus:  { sign: 'Taurus',  sign_degree: 10, is_retrograde: false },
      Moon:   { sign: 'Cancer',  sign_degree: 0,  is_retrograde: false },
    },
  };
}

describe('getTiming', () => {
  it('returns null when querentLord is missing', () => {
    expect(getTiming([], null, 'Venus', makeEph('Aries'))).toBeNull();
  });

  it('returns null when quesitedLord is missing', () => {
    expect(getTiming([], 'Mars', null, makeEph('Aries'))).toBeNull();
  });

  it('returns null when no applying sig-to-sig aspect exists', () => {
    const aspects = [makeAspect('Mars', 'Venus', 3.5, false, 'Mars')]; // separating
    expect(getTiming(aspects, 'Mars', 'Venus', makeEph('Aries'))).toBeNull();
  });

  it('returns null when sig-to-sig aspect exists but involves other planets', () => {
    const aspects = [makeAspect('Moon', 'Venus', 3.5, true, 'Moon')];
    expect(getTiming(aspects, 'Mars', 'Saturn', makeEph('Aries'))).toBeNull();
  });

  it('cardinal sign → days', () => {
    const aspects = [makeAspect('Mars', 'Venus', 4.0, true, 'Mars')];
    const result = getTiming(aspects, 'Mars', 'Venus', makeEph('Aries')); // Mars in Aries = cardinal
    expect(result).not.toBeNull();
    expect(result.mode).toBe('cardinal');
    expect(result.unit).toBe('days');
    expect(result.estimate).toBe(4.0);
    expect(result.faster).toBe('Mars');
    expect(result.sign).toBe('Aries');
  });

  it('fixed sign → months', () => {
    const aspects = [makeAspect('Mars', 'Venus', 2.5, true, 'Mars')];
    const result = getTiming(aspects, 'Mars', 'Venus', makeEph('Scorpio')); // Mars in Scorpio = fixed
    expect(result.mode).toBe('fixed');
    expect(result.unit).toBe('months');
    expect(result.estimate).toBe(2.5);
  });

  it('mutable sign → weeks', () => {
    const aspects = [makeAspect('Mars', 'Venus', 6.0, true, 'Mars')];
    const result = getTiming(aspects, 'Mars', 'Venus', makeEph('Virgo')); // Mars in Virgo = mutable
    expect(result.mode).toBe('mutable');
    expect(result.unit).toBe('weeks');
    expect(result.estimate).toBe(6.0);
  });

  it('uses the faster planet sign, not p1', () => {
    // Venus is faster than Mars — Venus is in Gemini (mutable → weeks)
    const eph = {
      planets: {
        Mars:  { sign: 'Scorpio', sign_degree: 5 },   // fixed
        Venus: { sign: 'Gemini',  sign_degree: 10 },  // mutable
      },
    };
    const aspects = [makeAspect('Mars', 'Venus', 3.0, true, 'Venus')]; // Venus is faster
    const result = getTiming(aspects, 'Mars', 'Venus', eph);
    expect(result.faster).toBe('Venus');
    expect(result.sign).toBe('Gemini');
    expect(result.unit).toBe('weeks');
  });

  it('picks the tightest applying aspect when multiple exist', () => {
    const aspects = [
      makeAspect('Mars', 'Venus', 5.5, true, 'Mars'),
      makeAspect('Venus', 'Mars', 2.1, true, 'Mars'), // tighter — same pair
    ];
    const result = getTiming(aspects, 'Mars', 'Venus', makeEph('Aries'));
    expect(result.estimate).toBe(2.1);
  });

  it('MODE_UNITS maps all three modes', () => {
    expect(MODE_UNITS.cardinal).toBe('days');
    expect(MODE_UNITS.mutable).toBe('weeks');
    expect(MODE_UNITS.fixed).toBe('months');
  });
});
