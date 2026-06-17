import { describe, it, expect } from 'vitest';
import { lonToSVGAngle, polar, planetLon, getCuspLons } from './WheelChart.jsx';

describe('lonToSVGAngle', () => {
  it('places the Ascendant at 180°', () => {
    const ascLon = 45;
    expect(lonToSVGAngle(ascLon, ascLon)).toBe(180);
  });

  it('places the Descendant (opposite ASC) at 0°', () => {
    const ascLon = 45;
    const dscLon = (ascLon + 180) % 360;
    expect(lonToSVGAngle(dscLon, ascLon)).toBe(0);
  });

  it('always returns a value in [0, 360)', () => {
    for (let lon = 0; lon < 360; lon += 15) {
      const angle = lonToSVGAngle(lon, 0);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    }
  });
});

describe('polar', () => {
  it('returns a point at radius distance from centre', () => {
    const { x, y } = polar(0, 100, 0, 0);
    expect(Math.round(x)).toBe(100);
    expect(Math.round(y)).toBe(0);
  });

  it('returns centre when radius is 0', () => {
    const { x, y } = polar(45, 0, 250, 250);
    expect(x).toBe(250);
    expect(y).toBe(250);
  });

  it('point distance from centre equals radius', () => {
    const cx = 250, cy = 250, r = 120;
    const { x, y } = polar(37, r, cx, cy);
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    expect(dist).toBeCloseTo(r, 5);
  });
});

describe('planetLon', () => {
  it('computes 0° for Aries 0°', () => {
    expect(planetLon({ sign: 'Aries', sign_degree: 0 })).toBe(0);
  });

  it('computes 30° for Taurus 0°', () => {
    expect(planetLon({ sign: 'Taurus', sign_degree: 0 })).toBe(30);
  });

  it('computes 180° for Libra 0°', () => {
    expect(planetLon({ sign: 'Libra', sign_degree: 0 })).toBe(180);
  });

  it('adds fractional degrees', () => {
    expect(planetLon({ sign: 'Aries', sign_degree: 14.5 })).toBe(14.5);
  });

  it('defaults missing sign_degree to 0', () => {
    expect(planetLon({ sign: 'Gemini' })).toBe(60);
  });
});

describe('getCuspLons', () => {
  it('returns a 12-element array', () => {
    const cusps = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, i * 30])
    );
    expect(getCuspLons({ cusps })).toHaveLength(12);
  });

  it('maps house numbers to correct index (House 1 → index 0)', () => {
    const cusps = { 1: 45, 2: 75, 3: 105 };
    const lons = getCuspLons({ cusps });
    expect(lons[0]).toBe(45);
    expect(lons[1]).toBe(75);
  });

  it('defaults missing cusps to 0', () => {
    const lons = getCuspLons({ cusps: {} });
    expect(lons.every((l) => l === 0)).toBe(true);
  });
});
