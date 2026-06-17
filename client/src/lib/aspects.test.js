import { describe, it, expect } from 'vitest';
import { getAspects, getSignificators, getPerfectionAspects, getTranslationOfLight, getCollectionOfLight, getProhibition, getMoonTestimony, getRefranation } from './aspects.js';

// Helper: build a minimal ephemeris payload with two planets
function planets(entries) {
  return {
    planets: Object.fromEntries(
      entries.map(([name, sign, deg, retro = false]) => [
        name, { sign, sign_degree: deg, is_retrograde: retro },
      ])
    ),
    houses: { cusps: {}, ascendant: 0 },
  };
}

describe('getAspects', () => {
  it('returns empty array when no planet data', () => {
    expect(getAspects(null)).toEqual([]);
    expect(getAspects({})).toEqual([]);
    expect(getAspects({ planets: {} })).toEqual([]);
  });

  it('detects a conjunction within orb', () => {
    // Moon at 15° Aries, Sun at 20° Aries → 5° apart → conjunction (orb 8°)
    const data = planets([['Moon', 'Aries', 15], ['Sun', 'Aries', 20]]);
    const asp = getAspects(data);
    expect(asp).toHaveLength(1);
    expect(asp[0].aspect).toBe('Conjunction');
    expect(asp[0].orb).toBe(5);
  });

  it('in-sign conjunction has outOfSign=false', () => {
    const data = planets([['Moon', 'Aries', 15], ['Sun', 'Aries', 20]]);
    expect(getAspects(data)[0].outOfSign).toBe(false);
  });

  it('out-of-sign conjunction has outOfSign=true', () => {
    // Moon at Aries 28°, Sun at Taurus 2° → 4° apart → conjunction but in different signs
    const data = planets([['Moon', 'Aries', 28], ['Sun', 'Taurus', 2]]);
    const asp = getAspects(data);
    expect(asp).toHaveLength(1);
    expect(asp[0].aspect).toBe('Conjunction');
    expect(asp[0].outOfSign).toBe(true);
  });

  it('normal trine (Aries–Leo, 4 signs apart) has outOfSign=false', () => {
    const data = planets([['Moon', 'Aries', 0], ['Sun', 'Leo', 5]]);
    expect(getAspects(data)[0].outOfSign).toBe(false);
  });

  it('out-of-sign trine has outOfSign=true', () => {
    // Moon at Aries 27°, Sun at Virgo 2° → sep = ~125° → trine (orb 5°), but Aries–Virgo is 5 signs = no trine
    const data = planets([['Moon', 'Aries', 27], ['Sun', 'Virgo', 2]]);
    const asp = getAspects(data);
    if (asp.length > 0 && asp[0].aspect === 'Trine') {
      expect(asp[0].outOfSign).toBe(true);
    }
  });

  it('detects a trine within orb', () => {
    // Moon at 0° Aries (lon=0), Sun at 5° Leo (lon=125) → sep=125°, orb=5° → trine
    const data = planets([['Moon', 'Aries', 0], ['Sun', 'Leo', 5]]);
    const asp = getAspects(data);
    expect(asp).toHaveLength(1);
    expect(asp[0].aspect).toBe('Trine');
    expect(asp[0].orb).toBe(5);
  });

  it('returns no aspect when separation exceeds orb', () => {
    // Moon at 0° Aries, Sun at 15° Aries → sep=15° → outside any orb
    const data = planets([['Moon', 'Aries', 0], ['Sun', 'Aries', 15]]);
    expect(getAspects(data)).toHaveLength(0);
  });

  it('marks Moon applying to Sun (Moon is faster)', () => {
    // Moon at 15° Aries, Sun at 20° Aries → Moon behind Sun going forward → applying
    const data = planets([['Moon', 'Aries', 15], ['Sun', 'Aries', 20]]);
    const [asp] = getAspects(data);
    expect(asp.applying).toBe(true);
    expect(asp.faster).toBe('Moon');
  });

  it('marks Moon separating from Sun after conjunction', () => {
    // Moon at 25° Aries, Sun at 20° Aries → Moon has passed Sun → separating
    const data = planets([['Moon', 'Aries', 25], ['Sun', 'Aries', 20]]);
    const [asp] = getAspects(data);
    expect(asp.applying).toBe(false);
  });

  it('marks retrograde Mercury applying to Sun from ahead', () => {
    // Mercury retrograde at 23° Aries, Sun at 20° Aries
    // Mercury is moving backward (decreasing lon) toward Sun at 20° → applying
    const data = planets([['Mercury', 'Aries', 23, true], ['Sun', 'Aries', 20]]);
    const [asp] = getAspects(data);
    expect(asp.applying).toBe(true);
    expect(asp.faster).toBe('Mercury');
  });

  it('detects sextile between Moon and Mars', () => {
    // Moon at 57° (=27° Taurus), Mars at 120° (=0° Leo) → sep=63°, orb=3 → sextile
    const data = planets([['Moon', 'Taurus', 27], ['Mars', 'Leo', 0]]);
    const asp = getAspects(data);
    expect(asp).toHaveLength(1);
    expect(asp[0].aspect).toBe('Sextile');
    expect(asp[0].orb).toBe(3);
    expect(asp[0].applying).toBe(true); // Moon approaching from 57° toward 60° from Mars
  });

  it('detects opposition', () => {
    // Moon at 0° Aries, Saturn at 2° Libra → sep=178°, orb=2° → opposition applying
    const data = planets([['Moon', 'Aries', 0], ['Saturn', 'Libra', 2]]);
    const [asp] = getAspects(data);
    expect(asp.aspect).toBe('Opposition');
    expect(asp.applying).toBe(true);
  });
});

describe('getSignificators', () => {
  it('returns nulls when data is missing', () => {
    expect(getSignificators(null, null)).toEqual({ querentLord: null, quesitedLord: null });
  });

  it('identifies rulers from house cusps', () => {
    const data = {
      planets: {},
      houses: {
        cusps: { '1': 0, '7': 180 }, // House 1 = 0° Aries (Mars), House 7 = 0° Libra (Venus)
        ascendant: 0,
      },
    };
    const { querentLord, quesitedLord } = getSignificators(data, { querent_house: 1, quesited_house: 7 });
    expect(querentLord).toBe('Mars');
    expect(quesitedLord).toBe('Venus');
  });
});

describe('getPerfectionAspects', () => {
  it('filters to significator + Moon aspects only', () => {
    const aspects = [
      { p1: 'Mars', p2: 'Venus', aspect: 'Trine',     orb: 2, applying: true  },
      { p1: 'Moon', p2: 'Venus', aspect: 'Sextile',   orb: 3, applying: true  },
      { p1: 'Sun',  p2: 'Saturn', aspect: 'Square',   orb: 1, applying: false },
    ];
    const result = getPerfectionAspects(aspects, 'Mars', 'Venus');
    // Sun-Saturn doesn't involve a significator or Moon → excluded
    expect(result).toHaveLength(2);
    expect(result.every(a => ['Mars','Venus','Moon'].includes(a.p1) && ['Mars','Venus','Moon'].includes(a.p2))).toBe(true);
  });

  it('sorts applying before separating, then by orb', () => {

    const aspects = [
      { p1: 'Mars', p2: 'Venus', aspect: 'Trine',   orb: 4, applying: false },
      { p1: 'Moon', p2: 'Mars',  aspect: 'Square',  orb: 2, applying: true  },
      { p1: 'Moon', p2: 'Venus', aspect: 'Sextile', orb: 5, applying: true  },
    ];
    const result = getPerfectionAspects(aspects, 'Mars', 'Venus');
    expect(result[0].applying).toBe(true);
    expect(result[0].orb).toBe(2); // tightest applying first
    expect(result[result.length - 1].applying).toBe(false);
  });
});

describe('getTranslationOfLight', () => {
  it('returns empty array when significators are missing', () => {
    expect(getTranslationOfLight([], null, 'Mars')).toEqual([]);
    expect(getTranslationOfLight([], 'Venus', null)).toEqual([]);
  });

  it('returns empty when significators already have a direct applying aspect', () => {
    const aspects = [{ p1: 'Venus', p2: 'Mars', aspect: 'Trine', applying: true, orb: 3 }];
    expect(getTranslationOfLight(aspects, 'Venus', 'Mars')).toHaveLength(0);
  });

  it('detects translation when Moon separates from querent lord and applies to quesited lord', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Venus', aspect: 'Conjunction', applying: false, orb: 2 },
      { p1: 'Moon', p2: 'Mars',  aspect: 'Sextile',     applying: true,  orb: 3 },
    ];
    const result = getTranslationOfLight(aspects, 'Venus', 'Mars');
    expect(result).toHaveLength(1);
    expect(result[0].translator).toBe('Moon');
    expect(result[0].from).toBe('Venus');
    expect(result[0].to).toBe('Mars');
    expect(result[0].separatingAspect.aspect).toBe('Conjunction');
    expect(result[0].applyingAspect.aspect).toBe('Sextile');
  });

  it('detects translation in the reverse direction', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Mars',  aspect: 'Conjunction', applying: false, orb: 1 },
      { p1: 'Moon', p2: 'Venus', aspect: 'Trine',        applying: true,  orb: 4 },
    ];
    const result = getTranslationOfLight(aspects, 'Venus', 'Mars');
    expect(result).toHaveLength(1);
    expect(result[0].translator).toBe('Moon');
    expect(result[0].from).toBe('Mars');
    expect(result[0].to).toBe('Venus');
  });

  it('returns empty when no third planet bridges the significators', () => {

    // Moon only applies to Venus — nothing connects Venus to Mars
    const aspects = [
      { p1: 'Moon', p2: 'Venus', aspect: 'Sextile', applying: true, orb: 2 },
    ];
    expect(getTranslationOfLight(aspects, 'Venus', 'Mars')).toHaveLength(0);
  });

  it('returns empty when significators have no relevant aspects at all', () => {
    expect(getTranslationOfLight([], 'Venus', 'Mars')).toHaveLength(0);
  });
});

describe('getCollectionOfLight', () => {
  it('returns empty array when significators are missing', () => {
    expect(getCollectionOfLight([], null, 'Mars')).toEqual([]);
    expect(getCollectionOfLight([], 'Venus', null)).toEqual([]);
  });

  it('detects collection when both significators apply to a common slower planet', () => {
    // Moon (faster) applies to Jupiter; Venus (faster) applies to Jupiter → Jupiter collects
    const aspects = [
      { p1: 'Moon',  p2: 'Jupiter', aspect: 'Trine',  applying: true, orb: 3, faster: 'Moon'  },
      { p1: 'Venus', p2: 'Jupiter', aspect: 'Sextile', applying: true, orb: 4, faster: 'Venus' },
    ];
    const result = getCollectionOfLight(aspects, 'Moon', 'Venus');
    expect(result).toHaveLength(1);
    expect(result[0].collector).toBe('Jupiter');
    expect(result[0].querentAspect.aspect).toBe('Trine');
    expect(result[0].quesitedAspect.aspect).toBe('Sextile');
  });

  it('returns empty when only one significator applies to the third planet', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Jupiter', aspect: 'Trine', applying: true, orb: 3, faster: 'Moon' },
    ];
    expect(getCollectionOfLight(aspects, 'Moon', 'Venus')).toHaveLength(0);
  });

  it('returns empty when the third planet is faster (it applies to them, not them to it)', () => {
    // Moon faster than both — Moon applies to Mars and Moon applies to Venus — no collection
    const aspects = [
      { p1: 'Moon', p2: 'Mars',  aspect: 'Trine',  applying: true, orb: 2, faster: 'Moon' },
      { p1: 'Moon', p2: 'Venus', aspect: 'Square', applying: true, orb: 3, faster: 'Moon' },
    ];
    // Mars and Venus are the significators; neither is applying to Moon
    expect(getCollectionOfLight(aspects, 'Mars', 'Venus')).toHaveLength(0);
  });
});

describe('getProhibition', () => {
  it('returns empty array when significators are missing', () => {
    expect(getProhibition([], null, 'Mars')).toEqual([]);
    expect(getProhibition([], 'Venus', null)).toEqual([]);
  });

  it('returns empty when significators have no direct applying aspect', () => {
    const aspects = [
      { p1: 'Saturn', p2: 'Venus', aspect: 'Square', applying: true, orb: 1 },
    ];
    expect(getProhibition(aspects, 'Venus', 'Mars')).toHaveLength(0);
  });

  it('detects prohibition when a third planet has a tighter orb to one significator', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars',   aspect: 'Trine', applying: true, orb: 4 }, // sig-to-sig
      { p1: 'Saturn', p2: 'Mars',  aspect: 'Square', applying: true, orb: 2 }, // tighter → prohibits
    ];
    const result = getProhibition(aspects, 'Venus', 'Mars');
    expect(result).toHaveLength(1);
    expect(result[0].prohibitor).toBe('Saturn');
    expect(result[0].target).toBe('Mars');
    expect(result[0].aspect.orb).toBe(2);
  });

  it('returns empty when the third planet orb is wider than the sig-to-sig orb', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars',   aspect: 'Trine',  applying: true, orb: 2 },
      { p1: 'Saturn', p2: 'Mars',  aspect: 'Square', applying: true, orb: 5 }, // wider → no prohibition
    ];
    expect(getProhibition(aspects, 'Venus', 'Mars')).toHaveLength(0);
  });

  it('detects prohibition against querent lord as well', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars',   aspect: 'Trine',  applying: true, orb: 5 },
      { p1: 'Moon',  p2: 'Venus',  aspect: 'Square', applying: true, orb: 1 }, // Moon prohibits Venus
    ];
    const result = getProhibition(aspects, 'Venus', 'Mars');
    expect(result).toHaveLength(1);
    expect(result[0].prohibitor).toBe('Moon');
    expect(result[0].target).toBe('Venus');
  });
});

describe('getMoonTestimony', () => {
  it('returns null last and next when no Moon aspects exist', () => {
    const aspects = [{ p1: 'Mars', p2: 'Venus', aspect: 'Trine', applying: true, orb: 3 }];
    const result = getMoonTestimony(aspects, {});
    expect(result.last).toBeNull();
    expect(result.next).toBeNull();
  });

  it('returns next as the tightest applying Moon aspect', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Venus',  aspect: 'Sextile',  applying: true,  orb: 2.5, faster: 'Moon' },
      { p1: 'Moon', p2: 'Saturn', aspect: 'Square',   applying: true,  orb: 5.0, faster: 'Moon' },
    ];
    const { next } = getMoonTestimony(aspects, {});
    expect(next.p2).toBe('Venus');
    expect(next.orb).toBe(2.5);
  });

  it('returns last as the tightest separating Moon aspect', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Mars',   aspect: 'Trine',    applying: false, orb: 1.2, faster: 'Moon' },
      { p1: 'Moon', p2: 'Jupiter', aspect: 'Square',  applying: false, orb: 4.8, faster: 'Moon' },
    ];
    const { last } = getMoonTestimony(aspects, {});
    expect(last.p2).toBe('Mars');
    expect(last.orb).toBe(1.2);
  });

  it('works when Moon is p2 in the aspect object', () => {
    const aspects = [
      { p1: 'Saturn', p2: 'Moon', aspect: 'Opposition', applying: true, orb: 3.0, faster: 'Moon' },
    ];
    const { next } = getMoonTestimony(aspects, {});
    expect(next).not.toBeNull();
    expect(next.aspect).toBe('Opposition');
  });

  it('returns both last and next when both exist', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Sun',    aspect: 'Conjunction', applying: false, orb: 0.8, faster: 'Moon' },
      { p1: 'Moon', p2: 'Venus',  aspect: 'Sextile',     applying: true,  orb: 3.5, faster: 'Moon' },
    ];
    const { last, next } = getMoonTestimony(aspects, {});
    expect(last.p2).toBe('Sun');
    expect(next.p2).toBe('Venus');
  });
});

describe('getRefranation', () => {
  function eph(planetEntries) {
    return {
      planets: Object.fromEntries(
        planetEntries.map(([name, sign, deg, speed, retro = false]) => [
          name, { sign, sign_degree: deg, daily_speed: speed, is_retrograde: retro },
        ])
      ),
      houses: { cusps: {}, ascendant: 0 },
    };
  }

  it('returns null when significators are missing', () => {
    expect(getRefranation([], null, 'Mars', {})).toBeNull();
    expect(getRefranation([], 'Venus', null, {})).toBeNull();
  });

  it('returns null when there is no applying sig-to-sig aspect', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars', aspect: 'Trine', applying: false, orb: 2, faster: 'Venus' },
    ];
    const data = eph([['Venus', 'Aries', 0, 0.05], ['Mars', 'Leo', 0, 0.5]]);
    expect(getRefranation(aspects, 'Venus', 'Mars', data)).toBeNull();
  });

  it('returns null when the faster planet is already retrograde', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars', aspect: 'Trine', applying: true, orb: 3, faster: 'Venus' },
    ];
    // Venus retrograde — not refranation (already retro)
    const data = eph([['Venus', 'Aries', 0, 0.05, true], ['Mars', 'Leo', 0, 0.5]]);
    expect(getRefranation(aspects, 'Venus', 'Mars', data)).toBeNull();
  });

  it('returns null when speed is above the station threshold', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars', aspect: 'Trine', applying: true, orb: 3, faster: 'Venus' },
    ];
    // Venus daily_speed 0.5°/day — well above threshold of 0.15
    const data = eph([['Venus', 'Aries', 0, 0.5], ['Mars', 'Leo', 0, 0.5]]);
    expect(getRefranation(aspects, 'Venus', 'Mars', data)).toBeNull();
  });

  it('detects refranation when Venus is direct and near-stationary', () => {
    const aspects = [
      { p1: 'Venus', p2: 'Mars', aspect: 'Trine', applying: true, orb: 3, faster: 'Venus' },
    ];
    // Venus direct at 0.05°/day — below threshold of 0.15 → about to station
    const data = eph([['Venus', 'Aries', 0, 0.05], ['Mars', 'Leo', 0, 0.5]]);
    const result = getRefranation(aspects, 'Venus', 'Mars', data);
    expect(result).not.toBeNull();
    expect(result.planet).toBe('Venus');
    expect(result.speed).toBe(0.05);
    expect(result.aspect.aspect).toBe('Trine');
  });

  it('detects refranation when Mercury is near-stationary', () => {
    const aspects = [
      { p1: 'Moon', p2: 'Mercury', aspect: 'Conjunction', applying: true, orb: 1, faster: 'Moon' },
      // Moon has no threshold — check if Mercury (as quesited) triggers refranation
      { p1: 'Mercury', p2: 'Saturn', aspect: 'Square', applying: true, orb: 2, faster: 'Mercury' },
    ];
    // Mercury is quesitedLord applying to Saturn (not sig-to-sig) — should be null
    const data = eph([['Mercury', 'Virgo', 0, 0.10], ['Saturn', 'Capricorn', 0, 0.03]]);
    expect(getRefranation(aspects, 'Moon', 'Saturn', data)).toBeNull();
  });

  it('returns null for Sun as faster planet (Sun never stations)', () => {
    const aspects = [
      { p1: 'Sun', p2: 'Saturn', aspect: 'Square', applying: true, orb: 2, faster: 'Sun' },
    ];
    const data = eph([['Sun', 'Aries', 0, 0.98], ['Saturn', 'Cancer', 0, 0.03]]);
    expect(getRefranation(aspects, 'Sun', 'Saturn', data)).toBeNull();
  });
});
