import { describe, it, expect } from 'vitest';
import { getStrictures } from './warnings.js';

function makeEphemeris({ ascendant = 0, saturnHouse = null } = {}) {
  return {
    houses: { ascendant },
    planets: {
      Saturn: saturnHouse != null ? { house: saturnHouse, sign: 'Capricorn', sign_degree: 10 } : null,
    },
  };
}

describe('getStrictures', () => {
  it('returns empty when no strictures', () => {
    expect(getStrictures(makeEphemeris({ ascendant: 15 * 30 + 15 }))).toEqual([]);
  });

  it('returns empty for null input', () => {
    expect(getStrictures(null)).toEqual([]);
    expect(getStrictures({})).toEqual([]);
  });

  it('detects early ASC (< 3°)', () => {
    // 1° into Aries = longitude 1
    const result = getStrictures(makeEphemeris({ ascendant: 1 }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('early_asc');
    expect(result[0].label).toMatch(/early/i);
  });

  it('detects late ASC (> 27°)', () => {
    // 28° into Aries = longitude 28
    const result = getStrictures(makeEphemeris({ ascendant: 28 }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('late_asc');
    expect(result[0].label).toMatch(/late/i);
  });

  it('does not trigger for ASC exactly at 3° or 27°', () => {
    expect(getStrictures(makeEphemeris({ ascendant: 3 }))).toEqual([]);
    expect(getStrictures(makeEphemeris({ ascendant: 27 }))).toEqual([]);
  });

  it('detects Saturn in 1st house (number)', () => {
    const result = getStrictures(makeEphemeris({ ascendant: 15, saturnHouse: 1 }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('saturn_1st');
  });

  it('detects Saturn in 7th house (string)', () => {
    const result = getStrictures(makeEphemeris({ ascendant: 15, saturnHouse: '7' }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('saturn_7th');
  });

  it('can return multiple strictures simultaneously', () => {
    // Early ASC + Saturn in 7th
    const result = getStrictures(makeEphemeris({ ascendant: 1, saturnHouse: 7 }));
    expect(result).toHaveLength(2);
    expect(result.map(s => s.type)).toContain('early_asc');
    expect(result.map(s => s.type)).toContain('saturn_7th');
  });

  it('handles ASC degrees across sign boundaries correctly', () => {
    // 28° into Taurus = longitude 30 + 28 = 58 → late ASC
    const result = getStrictures(makeEphemeris({ ascendant: 58 }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('late_asc');
  });
});
