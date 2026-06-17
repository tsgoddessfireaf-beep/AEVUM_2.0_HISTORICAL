// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

// Essential dignity tables — traditional/Ptolemaic

const RULERSHIPS = {
  Sun:     ['Leo'],
  Moon:    ['Cancer'],
  Mercury: ['Gemini', 'Virgo'],
  Venus:   ['Taurus', 'Libra'],
  Mars:    ['Aries', 'Scorpio'],
  Jupiter: ['Sagittarius', 'Pisces'],
  Saturn:  ['Capricorn', 'Aquarius'],
};

const EXALTATIONS = {
  Sun:     'Aries',
  Moon:    'Taurus',
  Mercury: 'Virgo',
  Venus:   'Pisces',
  Mars:    'Capricorn',
  Jupiter: 'Cancer',
  Saturn:  'Libra',
};

const DETRIMENTS = {
  Sun:     ['Aquarius'],
  Moon:    ['Capricorn'],
  Mercury: ['Sagittarius', 'Pisces'],
  Venus:   ['Aries', 'Scorpio'],
  Mars:    ['Taurus', 'Libra'],
  Jupiter: ['Gemini', 'Virgo'],
  Saturn:  ['Cancer', 'Leo'],
};

const FALLS = {
  Sun:     'Libra',
  Moon:    'Scorpio',
  Mercury: 'Pisces',
  Venus:   'Virgo',
  Mars:    'Cancer',
  Jupiter: 'Capricorn',
  Saturn:  'Aries',
};

// Dorothean triplicity rulers
const TRIPLICITY = {
  fire:  { day: 'Sun',    night: 'Jupiter' },
  earth: { day: 'Venus',  night: 'Moon'    },
  air:   { day: 'Saturn', night: 'Mercury' },
  water: { day: 'Venus',  night: 'Mars'    },
};

const SIGN_ELEMENT = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water',
};

// Egyptian terms: [planet, startDeg, endDeg] per sign
const TERMS = {
  Aries:       [['Jupiter',0,6],  ['Venus',6,12],  ['Mercury',12,20], ['Mars',20,25],  ['Saturn',25,30]],
  Taurus:      [['Venus',0,8],    ['Mercury',8,14], ['Jupiter',14,22], ['Saturn',22,27],['Mars',27,30]],
  Gemini:      [['Mercury',0,6],  ['Jupiter',6,12], ['Venus',12,17],   ['Mars',17,24],  ['Saturn',24,30]],
  Cancer:      [['Mars',0,7],     ['Venus',7,13],   ['Mercury',13,19], ['Jupiter',19,26],['Saturn',26,30]],
  Leo:         [['Jupiter',0,6],  ['Venus',6,11],   ['Saturn',11,18],  ['Mercury',18,24],['Mars',24,30]],
  Virgo:       [['Mercury',0,7],  ['Venus',7,17],   ['Jupiter',17,21], ['Saturn',21,28], ['Mars',28,30]],
  Libra:       [['Saturn',0,6],   ['Mercury',6,14], ['Jupiter',14,21], ['Venus',21,28],  ['Mars',28,30]],
  Scorpio:     [['Mars',0,7],     ['Venus',7,11],   ['Mercury',11,19], ['Jupiter',19,24],['Saturn',24,30]],
  Sagittarius: [['Jupiter',0,12], ['Venus',12,17],  ['Mercury',17,21], ['Saturn',21,26], ['Mars',26,30]],
  Capricorn:   [['Mercury',0,7],  ['Jupiter',7,14], ['Venus',14,22],   ['Saturn',22,26], ['Mars',26,30]],
  Aquarius:    [['Mercury',0,7],  ['Venus',7,13],   ['Jupiter',13,20], ['Mars',20,25],   ['Saturn',25,30]],
  Pisces:      [['Venus',0,12],   ['Jupiter',12,16],['Mercury',16,19], ['Mars',19,28],   ['Saturn',28,30]],
};

// Chaldean decan lords — 36 decans of 10° each, starting 0° Aries
const DECAN_LORDS = [
  'Mars','Sun','Venus',        // Aries
  'Mercury','Moon','Saturn',   // Taurus
  'Jupiter','Mars','Sun',      // Gemini
  'Venus','Mercury','Moon',    // Cancer
  'Saturn','Jupiter','Mars',   // Leo
  'Sun','Venus','Mercury',     // Virgo
  'Moon','Saturn','Jupiter',   // Libra
  'Mars','Sun','Venus',        // Scorpio
  'Mercury','Moon','Saturn',   // Sagittarius
  'Jupiter','Mars','Sun',      // Capricorn
  'Venus','Mercury','Moon',    // Aquarius
  'Saturn','Jupiter','Mars',   // Pisces
];

function getTermLord(sign, degree) {
  for (const [planet, start, end] of (TERMS[sign] || [])) {
    if (degree >= start && degree < end) return planet;
  }
  return null;
}

function getDecanLord(sign, degree) {
  const idx = ZODIAC_SIGNS.indexOf(sign);
  return idx >= 0 ? (DECAN_LORDS[idx * 3 + Math.floor(degree / 10)] || null) : null;
}

/**
 * True when `planet` is the triplicity ruler of `sign` given sect.
 * Sun above the horizon = day chart.
 */
function isTriplicityRuler(planet, sign, isDayChart) {
  const rulers = TRIPLICITY[SIGN_ELEMENT[sign]];
  return rulers ? (isDayChart ? rulers.day : rulers.night) === planet : false;
}

/**
 * Returns the essential dignity of a planet at a given sign + degree.
 * Debilities (detriment/fall) take priority over positive dignities in the label,
 * but all active dignities are returned so callers can reason about them.
 *
 * @returns {{ label: string, score: number, type: string, extra: string[] }}
 *   type: 'rulership'|'exaltation'|'triplicity'|'term'|'face'|'peregrine'|'detriment'|'fall'
 */
function getPlanetDignity(planet, sign, degree, isDayChart) {
  const inRulership  = RULERSHIPS[planet]?.includes(sign)        || false;
  const inExaltation = EXALTATIONS[planet] === sign;
  const inTriplicity = isTriplicityRuler(planet, sign, isDayChart);
  const inTerm       = getTermLord(sign, degree) === planet;
  const inFace       = getDecanLord(sign, degree) === planet;
  const inDetriment  = DETRIMENTS[planet]?.includes(sign)        || false;
  const inFall       = FALLS[planet] === sign;

  // Collect any secondary dignities a debilitated planet may still hold
  const extra = [];
  if (inDetriment || inFall) {
    if (inTriplicity) extra.push('triplicity');
    if (inTerm)       extra.push('term');
    if (inFace)       extra.push('face');
  }

  if (inDetriment) return { label: 'Detriment', score: -5, type: 'detriment', extra };
  if (inFall)      return { label: 'Fall',       score: -4, type: 'fall',      extra };
  if (inRulership) return { label: 'Rulership',  score:  5, type: 'rulership', extra: [] };
  if (inExaltation)return { label: 'Exaltation', score:  4, type: 'exaltation',extra: [] };
  if (inTriplicity)return { label: 'Triplicity', score:  3, type: 'triplicity',extra: [] };
  if (inTerm)      return { label: 'Term',        score:  2, type: 'term',      extra: [] };
  if (inFace)      return { label: 'Face',        score:  1, type: 'face',      extra: [] };
  return              { label: 'Peregrine',    score:  0, type: 'peregrine', extra: [] };
}

const CLASSICAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

/**
 * Sums ALL positive essential dignity scores for a planet at the given position.
 * Unlike getPlanetDignity (which short-circuits for display), this accumulates
 * all active dignities so the almuten can be correctly identified.
 */
function getAlmutenScore(planet, sign, degree, isDayChart) {
  return (
    (RULERSHIPS[planet]?.includes(sign)           ? 5 : 0) +
    (EXALTATIONS[planet] === sign                 ? 4 : 0) +
    (isTriplicityRuler(planet, sign, isDayChart)  ? 3 : 0) +
    (getTermLord(sign, degree)   === planet       ? 2 : 0) +
    (getDecanLord(sign, degree)  === planet       ? 1 : 0)
  );
}

/**
 * Returns the almuten (lord of the geniture / victor) at a given ecliptic position —
 * the planet with the highest cumulative essential dignity score.
 *
 * @param {string} sign   - Zodiac sign name
 * @param {number} degree - Degree within the sign (0–29.99)
 * @param {boolean} isDayChart
 * @returns {{ planet: string, score: number } | null}
 */
export function getAlmuten(sign, degree, isDayChart) {
  let best = null;
  for (const planet of CLASSICAL) {
    const score = getAlmutenScore(planet, sign, degree, isDayChart);
    if (!best || score > best.score) best = { planet, score };
  }
  return best;
}

/**
 * Returns essential dignity for each of the 7 classical planets.
 * @param {Object} ephemerisData
 * @returns {Array<{ planet: string, sign: string, degree: number, dignity: Object }>}
 */
export function getPlanetaryDignities(ephemerisData) {
  if (!ephemerisData?.planets) return [];
  const { planets, houses } = ephemerisData;

  // Day chart: Sun above the horizon (between DSC and ASC going forward in longitude)
  let isDayChart = true;
  const sun = planets.Sun;
  if (houses?.ascendant != null && sun?.sign) {
    const ascLon = parseFloat(houses.ascendant) || 0;
    const sunLon = ZODIAC_SIGNS.indexOf(sun.sign) * 30 + (sun.sign_degree || 0);
    isDayChart = ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;
  }

  return CLASSICAL.map((pName) => {
    const p = planets[pName];
    if (!p?.sign) return null;
    const degree = p.sign_degree || 0;
    return { planet: pName, sign: p.sign, degree, dignity: getPlanetDignity(pName, p.sign, degree, isDayChart) };
  }).filter(Boolean);
}

/**
 * CSS colour class for a dignity type.
 */
export function dignityColor(type) {
  switch (type) {
    case 'rulership':
    case 'exaltation':  return 'text-emerald-400';
    case 'triplicity':  return 'text-copper-400';
    case 'term':
    case 'face':        return 'text-amber-500';
    case 'peregrine':   return 'text-silver/60';
    case 'detriment':
    case 'fall':        return 'text-red-400';
    default:            return 'text-silver';
  }
}
