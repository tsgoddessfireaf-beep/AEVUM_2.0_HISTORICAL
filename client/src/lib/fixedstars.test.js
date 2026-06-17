// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { describe, it, expect } from 'vitest';
import { getFixedStarHits } from './fixedstars.js';

function makeEph(entries) {
  return {
    planets: Object.fromEntries(
      entries.map(([name, sign, deg]) => [name, { sign, sign_degree: deg }])
    ),
  };
}

describe('getFixedStarHits', () => {
  it('returns empty for missing data', () => {
    expect(getFixedStarHits(null)).toEqual([]);
    expect(getFixedStarHits({})).toEqual([]);
  });

  it('returns empty when no planet is near a fixed star', () => {
    const eph = makeEph([['Mars', 'Aries', 0]]);
    expect(getFixedStarHits(eph)).toEqual([]);
  });

  it('detects Regulus conjunction (Leo ~30° = lon 150°)', () => {
    // Regulus at 150.0°; Mars at Leo 30° = lon 150°
    const eph = makeEph([['Mars', 'Leo', 30]]);
    const hits = getFixedStarHits(eph);
    expect(hits).toHaveLength(1);
    expect(hits[0].star).toBe('Regulus');
    expect(hits[0].planet).toBe('Mars');
    expect(hits[0].nature).toBe('benefic');
    expect(hits[0].orb).toBe(0);
  });

  it('detects Algol conjunction (Taurus ~26° = lon ~56°)', () => {
    // Algol at 56.1°; Moon at Taurus 26° = lon 56°
    const eph = makeEph([['Moon', 'Taurus', 26]]);
    const hits = getFixedStarHits(eph);
    expect(hits).toHaveLength(1);
    expect(hits[0].star).toBe('Algol');
    expect(hits[0].planet).toBe('Moon');
    expect(hits[0].nature).toBe('malefic');
  });

  it('does not flag planets more than 1° from a star', () => {
    // Regulus at 150.0°; Mars at Leo 28.8° = lon 148.8° → orb 1.2° → outside
    const eph = makeEph([['Mars', 'Leo', 28.8]]);
    expect(getFixedStarHits(eph)).toHaveLength(0);
  });

  it('respects sigSet — only checks listed planets', () => {
    const eph = makeEph([
      ['Mars',  'Leo', 30],    // near Regulus
      ['Venus', 'Aries', 0],  // not near anything
    ]);
    const hits = getFixedStarHits(eph, new Set(['Venus']));
    expect(hits).toHaveLength(0);
  });

  it('sorts malefic hits before benefic hits', () => {
    const eph = makeEph([
      ['Moon',  'Taurus', 26],  // near Algol (malefic)
      ['Mars',  'Leo', 30],     // near Regulus (benefic)
    ]);
    const hits = getFixedStarHits(eph);
    expect(hits[0].nature).toBe('malefic');
    expect(hits[1].nature).toBe('benefic');
  });

  it('detects Spica conjunction (Libra ~24° = lon ~204°)', () => {
    const eph = makeEph([['Venus', 'Libra', 24]]);
    const hits = getFixedStarHits(eph);
    expect(hits).toHaveLength(1);
    expect(hits[0].star).toBe('Spica');
  });

  it('detects Antares conjunction (Sagittarius ~10° = lon ~250°)', () => {
    const eph = makeEph([['Jupiter', 'Sagittarius', 10]]);
    const hits = getFixedStarHits(eph);
    expect(hits).toHaveLength(1);
    expect(hits[0].star).toBe('Antares');
  });
});
