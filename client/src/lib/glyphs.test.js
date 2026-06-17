import { describe, it, expect } from 'vitest';
import { planetGlyph, signGlyph, PLANET_GLYPHS, SIGN_GLYPHS } from './glyphs.js';

describe('planetGlyph', () => {
  it('returns a non-empty string for every known planet', () => {
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node'];
    for (const p of planets) {
      const g = planetGlyph(p);
      expect(typeof g).toBe('string');
      expect(g.length).toBeGreaterThan(0);
    }
  });

  it('falls back to first letter for an unknown planet', () => {
    expect(planetGlyph('Chiron')).toBe('C');
  });

  it('returns ? for null or empty', () => {
    expect(planetGlyph(null)).toBe('?');
    expect(planetGlyph('')).toBe('?');
  });

  it('PLANET_GLYPHS has an entry for all 12 bodies (including SouthNode)', () => {
    expect(Object.keys(PLANET_GLYPHS).length).toBe(12);
  });
});

describe('signGlyph', () => {
  it('returns a non-empty string for every zodiac sign', () => {
    const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    for (const s of signs) {
      const g = signGlyph(s);
      expect(typeof g).toBe('string');
      expect(g.length).toBeGreaterThan(0);
    }
  });

  it('falls back to first letter for an unknown sign', () => {
    expect(signGlyph('Ophiuchus')).toBe('O');
  });

  it('returns ? for null or empty', () => {
    expect(signGlyph(null)).toBe('?');
    expect(signGlyph('')).toBe('?');
  });

  it('SIGN_GLYPHS covers all 12 signs', () => {
    expect(Object.keys(SIGN_GLYPHS).length).toBe(12);
  });
});
