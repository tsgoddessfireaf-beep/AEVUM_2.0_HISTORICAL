// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { describe, it, expect } from 'vitest';
import { getLotOfFortune, getLotOfSpirit } from './lots.js';

function makeData({ asc = 0, sunSign = 'Aries', sunDeg = 0, moonSign = 'Aries', moonDeg = 0 } = {}) {
  return {
    houses: { ascendant: String(asc), cusps: {} },
    planets: {
      Sun:  { sign: sunSign,  sign_degree: sunDeg  },
      Moon: { sign: moonSign, sign_degree: moonDeg },
    },
  };
}

describe('getLotOfFortune', () => {
  it('returns null when houses missing', () => {
    expect(getLotOfFortune({ planets: {} })).toBeNull();
  });

  it('returns null when planets missing', () => {
    expect(getLotOfFortune({ houses: { ascendant: '0', cusps: {} } })).toBeNull();
  });

  it('returns null when Sun has no sign', () => {
    expect(getLotOfFortune({
      houses: { ascendant: '0', cusps: {} },
      planets: { Sun: {}, Moon: { sign: 'Aries', sign_degree: 0 } },
    })).toBeNull();
  });

  it('returns null when Moon has no sign', () => {
    expect(getLotOfFortune({
      houses: { ascendant: '0', cusps: {} },
      planets: { Sun: { sign: 'Aries', sign_degree: 0 }, Moon: {} },
    })).toBeNull();
  });

  it('day chart: ASC=0, Sun=Capricorn 0°, Moon=Cancer 0° → Fortune at Libra 0°', () => {
    // sunLon=270, moonLon=90; ((270-0+180)%360+360)%360=90 < 180 → day
    // Fortune = 0 + 90 - 270 = -180 → 180° → Libra 0°
    const result = getLotOfFortune(makeData({
      sunSign: 'Capricorn', sunDeg: 0,
      moonSign: 'Cancer', moonDeg: 0,
    }));
    expect(result).not.toBeNull();
    expect(result.isDay).toBe(true);
    expect(result.lon).toBe(180);
    expect(result.sign).toBe('Libra');
    expect(result.degree).toBe(0);
    expect(result.lord).toBe('Venus');
  });

  it('night chart: ASC=0, Sun=Cancer 0°, Moon=Taurus 0° → Fortune at Gemini 0°', () => {
    // sunLon=90, moonLon=30; ((90-0+180)%360+360)%360=270 >= 180 → night
    // Fortune = 0 + 90 - 30 = 60° → Gemini 0°
    const result = getLotOfFortune(makeData({
      sunSign: 'Cancer', sunDeg: 0,
      moonSign: 'Taurus', moonDeg: 0,
    }));
    expect(result).not.toBeNull();
    expect(result.isDay).toBe(false);
    expect(result.lon).toBe(60);
    expect(result.sign).toBe('Gemini');
    expect(result.degree).toBe(0);
    expect(result.lord).toBe('Mercury');
  });

  it('non-zero ASC: ASC=30, Sun=Capricorn 0°, Moon=Cancer 0° → Fortune at Scorpio 0°', () => {
    // sunLon=270, moonLon=90; ((270-30+180)%360+360)%360=60 < 180 → day
    // Fortune = 30 + 90 - 270 = -150 → 210° → Scorpio 0°
    const result = getLotOfFortune(makeData({
      asc: 30,
      sunSign: 'Capricorn', sunDeg: 0,
      moonSign: 'Cancer', moonDeg: 0,
    }));
    expect(result.isDay).toBe(true);
    expect(result.lon).toBe(210);
    expect(result.sign).toBe('Scorpio');
    expect(result.degree).toBe(0);
    expect(result.lord).toBe('Mars');
  });

  it('night chart with degree offset: ASC=0, Sun=Aries 10°, Moon=Leo 5° → Fortune at Sagittarius 5°', () => {
    // sunLon=10, moonLon=125; ((10-0+180)%360+360)%360=190 >= 180 → night
    // Fortune = 0 + 10 - 125 = -115 → 245° → Sagittarius 5°
    const result = getLotOfFortune(makeData({
      sunSign: 'Aries', sunDeg: 10,
      moonSign: 'Leo', moonDeg: 5,
    }));
    expect(result.isDay).toBe(false);
    expect(result.lon).toBe(245);
    expect(result.sign).toBe('Sagittarius');
    expect(result.degree).toBe(5);
    expect(result.lord).toBe('Jupiter');
  });

  it('result always has lon in [0, 360)', () => {
    const cases = [
      { asc: 350, sunSign: 'Aries', sunDeg: 0, moonSign: 'Aries', moonDeg: 0 },
      { asc: 0,   sunSign: 'Pisces', sunDeg: 29, moonSign: 'Aries', moonDeg: 1 },
    ];
    cases.forEach(c => {
      const result = getLotOfFortune(makeData(c));
      expect(result.lon).toBeGreaterThanOrEqual(0);
      expect(result.lon).toBeLessThan(360);
    });
  });
});

describe('getLotOfSpirit', () => {
  it('returns null when data is missing', () => {
    expect(getLotOfSpirit(null)).toBeNull();
    expect(getLotOfSpirit({ planets: {} })).toBeNull();
  });

  it('day chart: Spirit is inverse of Fortune — ASC=0, Sun=Capricorn 0°, Moon=Cancer 0°', () => {
    // Day chart. Fortune = 0 + 90 - 270 = -180 → 180° (Libra 0°)
    // Spirit day = 0 + 270 - 90 = 180° (Libra 0°) — same in this symmetric case
    // Let's pick asymmetric: Sun=Aquarius 0°=300°, Moon=Cancer 0°=90°
    // Day chart: (300+180)%360=120 < 180 → day
    // Fortune day = 0 + 90 - 300 = -210 → 150° (Leo 0°)
    // Spirit day  = 0 + 300 - 90 = 210° (Scorpio 0°)
    const data = makeData({ sunSign: 'Aquarius', sunDeg: 0, moonSign: 'Cancer', moonDeg: 0 });
    const spirit = getLotOfSpirit(data);
    expect(spirit).not.toBeNull();
    expect(spirit.isDay).toBe(true);
    expect(spirit.lon).toBe(210);
    expect(spirit.sign).toBe('Scorpio');
    expect(spirit.lord).toBe('Mars');
  });

  it('night chart: Spirit = ASC + Moon - Sun', () => {
    // Night chart: Sun=Cancer 0°=90°; Moon=Taurus 0°=30°
    // ((90+180)%360)=270 >= 180 → night
    // Spirit night = 0 + 30 - 90 = -60 → 300° (Aquarius 0°)
    const data = makeData({ sunSign: 'Cancer', sunDeg: 0, moonSign: 'Taurus', moonDeg: 0 });
    const spirit = getLotOfSpirit(data);
    expect(spirit.isDay).toBe(false);
    expect(spirit.lon).toBe(300);
    expect(spirit.sign).toBe('Aquarius');
    expect(spirit.lord).toBe('Saturn');
  });

  it('Spirit and Fortune are always symmetric around the ASC — day chart', () => {
    // For a day chart: Fortune = ASC + Moon - Sun, Spirit = ASC + Sun - Moon
    // Fortune + Spirit = 2*ASC, so they should be equidistant from ASC on either side
    const data = makeData({ asc: 60, sunSign: 'Pisces', sunDeg: 10, moonSign: 'Virgo', moonDeg: 5 });
    const fortune = getLotOfFortune(data);
    const spirit  = getLotOfSpirit(data);
    if (fortune && spirit) {
      // Both should be non-null
      expect(fortune.isDay).toBe(spirit.isDay);
      // fortLon + spiritLon = 2 * ascLon (mod 360)
      const expected = ((2 * 60) % 360 + 360) % 360;
      expect(((fortune.lon + spirit.lon) % 360 + 360) % 360).toBeCloseTo(expected, 1);
    }
  });

  it('result lon is always in [0, 360)', () => {
    const data = makeData({ asc: 350, sunSign: 'Aries', sunDeg: 5, moonSign: 'Pisces', moonDeg: 25 });
    const spirit = getLotOfSpirit(data);
    expect(spirit.lon).toBeGreaterThanOrEqual(0);
    expect(spirit.lon).toBeLessThan(360);
  });
});
