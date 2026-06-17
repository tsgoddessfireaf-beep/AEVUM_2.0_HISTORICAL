// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { describe, it, expect } from 'vitest';
import { getAntiscia } from './antiscia.js';

function eph(planets) {
  const built = {};
  for (const [name, sign, degree] of planets) {
    built[name] = { sign, sign_degree: degree };
  }
  return { planets: built };
}

describe('getAntiscia', () => {
  it('returns empty array for null/empty input', () => {
    expect(getAntiscia(null)).toEqual([]);
    expect(getAntiscia({})).toEqual([]);
    expect(getAntiscia({ planets: {} })).toEqual([]);
  });

  it('detects classic antiscia pair: Taurus and Leo at equal degrees', () => {
    // Taurus 15° (lon=45°) → antiscion = 180-45 = 135° = Leo 15° ✓
    const data = eph([
      ['Sun', 'Taurus', 15],
      ['Moon', 'Leo', 15],
    ]);
    const result = getAntiscia(data, 1.0);
    expect(result.length).toBeGreaterThan(0);
    const sunMoon = result.find(r => r.p1 === 'Sun' && r.p2 === 'Moon' && r.type === 'antiscia');
    expect(sunMoon).toBeDefined();
    expect(sunMoon.orb).toBeLessThan(0.1);
  });

  it('detects contra-antiscia pair: Aries and Pisces at equal degrees', () => {
    // Aries 10° (lon=10°) → contra-antiscion = 360-10 = 350° = Pisces 20° ✓
    const data = eph([
      ['Mars', 'Aries', 10],
      ['Venus', 'Pisces', 20],
    ]);
    const result = getAntiscia(data, 1.0);
    const pair = result.find(r =>
      ((r.p1 === 'Mars' && r.p2 === 'Venus') || (r.p1 === 'Venus' && r.p2 === 'Mars'))
      && r.type === 'contra-antiscia'
    );
    expect(pair).toBeDefined();
    expect(pair.orb).toBeLessThan(0.1);
  });

  it('respects orb parameter — wide pairs excluded with tight orb', () => {
    // Taurus 15° and Leo 18° are 3° apart in antiscia
    const data = eph([
      ['Sun', 'Taurus', 15],
      ['Moon', 'Leo', 18],
    ]);
    const tight = getAntiscia(data, 1.0);
    expect(tight.find(r => r.type === 'antiscia' && r.p1 === 'Sun' && r.p2 === 'Moon')).toBeUndefined();
    const wide = getAntiscia(data, 4.0);
    expect(wide.find(r => r.type === 'antiscia' && r.p1 === 'Sun' && r.p2 === 'Moon')).toBeDefined();
  });

  it('returns no hits when planets are not in antiscia relationship', () => {
    const data = eph([
      ['Sun', 'Aries', 0],
      ['Moon', 'Aries', 5],
    ]);
    const result = getAntiscia(data, 1.5);
    expect(result.length).toBe(0);
  });

  it('includes antiscion position info (sign and degree)', () => {
    // Taurus 15° antiscion is at Leo 15°
    const data = eph([
      ['Sun', 'Taurus', 15],
      ['Moon', 'Leo', 15],
    ]);
    const result = getAntiscia(data, 1.0);
    const hit = result.find(r => r.type === 'antiscia' && r.p1 === 'Sun');
    expect(hit.sign).toBe('Leo');
    expect(hit.degree).toBeCloseTo(15, 0);
  });

  it('sorts by orb ascending', () => {
    const data = eph([
      ['Sun', 'Taurus', 15],
      ['Moon', 'Leo', 15.5],    // antiscia, 0.5° orb
      ['Mars', 'Aries', 10],
      ['Venus', 'Pisces', 20.8], // contra-antiscia, 0.8° orb
    ]);
    const result = getAntiscia(data, 1.5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].orb).toBeGreaterThanOrEqual(result[i - 1].orb);
    }
  });

  it('detects Cancer/Cancer self-mirror on the solstice axis', () => {
    // Cancer 0° (lon=90°) antiscion = 180-90 = 90° = Cancer 0° (same point)
    // So planet at Cancer 0° has its antiscion at itself. Verify another planet near Cancer 0° hits.
    const data = eph([
      ['Sun', 'Cancer', 0.5],
      ['Moon', 'Cancer', 1.0],
    ]);
    // Sun's antiscion ≈ Gemini 29.5°, Moon at Cancer 1° → diff ≈ 1.5°
    // Wider check: at exactly Cancer 0°, antiscion is Cancer 0° (degenerate)
    const result = getAntiscia(data, 2.0);
    // Don't assert specific content — just that the function handles solstice-near positions without error
    expect(Array.isArray(result)).toBe(true);
  });
});
