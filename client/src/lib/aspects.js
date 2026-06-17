// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

// Ptolemaic aspects — the only aspects used in traditional horary
export const ASPECT_DEFS = [
  { angle: 0,   name: 'Conjunction', abbr: 'Cnj', orb: 8 },
  { angle: 60,  name: 'Sextile',     abbr: 'Sxt', orb: 6 },
  { angle: 90,  name: 'Square',      abbr: 'Sqr', orb: 8 },
  { angle: 120, name: 'Trine',       abbr: 'Tri', orb: 8 },
  { angle: 180, name: 'Opposition',  abbr: 'Opp', orb: 8 },
];

// Chaldean speed order — faster = lower rank
const SPEED_RANK = { Moon: 0, Mercury: 1, Venus: 2, Sun: 3, Mars: 4, Jupiter: 5, Saturn: 6 };
const CLASSICAL  = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

const SIGN_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

function getLon(p) {
  const idx = ZODIAC_SIGNS.indexOf(p.sign);
  return ((idx < 0 ? 0 : idx) * 30) + (p.sign_degree || 0);
}

/**
 * Determines whether the faster planet is applying to or separating from
 * the exact aspect point with the slower planet.
 *
 * Direct planets apply when moving forward toward the exact point;
 * retrograde planets apply when moving backward toward it.
 */
function aspectState(fasterLon, slowerLon, aspAngle, orb, fasterRetro) {
  // Generate the one or two exact-aspect longitude points relative to the slower planet
  let pts;
  if (aspAngle === 0)        pts = [slowerLon];
  else if (aspAngle === 180) pts = [((slowerLon + 180) % 360 + 360) % 360];
  else pts = [
    ((slowerLon + aspAngle) % 360 + 360) % 360,
    ((slowerLon - aspAngle) % 360 + 360) % 360,
  ];

  for (const pt of pts) {
    const fwd = ((pt - fasterLon) % 360 + 360) % 360; // degrees to travel forward to reach pt
    const bkw = ((fasterLon - pt) % 360 + 360) % 360; // degrees to travel backward to reach pt
    if (!fasterRetro) {
      if (fwd <= orb) return 'applying';
      if (bkw <= orb) return 'separating';
    } else {
      if (bkw <= orb) return 'applying';
      if (fwd <= orb) return 'separating';
    }
  }
  return 'separating'; // fallback (shouldn't reach here if the pair is genuinely in aspect)
}

/**
 * Returns all Ptolemaic aspects currently in orb between the 7 classical planets.
 * Each result: { p1, p2, aspect, angle, orb, applying, faster }
 */
export function getAspects(ephemerisData) {
  if (!ephemerisData?.planets) return [];
  const { planets } = ephemerisData;

  const bodies = CLASSICAL
    .filter(n => planets[n]?.sign)
    .map(n => ({
      name:  n,
      lon:   getLon(planets[n]),
      sign:  planets[n].sign,
      retro: planets[n].is_retrograde || false,
      rank:  SPEED_RANK[n] ?? 6,
    }));

  const results = [];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const diff = ((b.lon - a.lon) % 360 + 360) % 360;
      const sep  = diff > 180 ? 360 - diff : diff; // 0–180°

      for (const asp of ASPECT_DEFS) {
        const orbVal = Math.abs(sep - asp.angle);
        if (orbVal <= asp.orb) {
          const [faster, slower] = a.rank <= b.rank ? [a, b] : [b, a];
          const state = aspectState(faster.lon, slower.lon, asp.angle, asp.orb, faster.retro);

          // Out-of-sign: the signs the planets occupy don't have the expected relationship
          const si = ZODIAC_SIGNS.indexOf(a.sign);
          const sj = ZODIAC_SIGNS.indexOf(b.sign);
          const signSep = Math.min(((sj - si) + 12) % 12, ((si - sj) + 12) % 12);
          const EXPECTED_SIGN_SEP = { 0: [0], 60: [2, 10], 90: [3, 9], 120: [4, 8], 180: [6] };
          const outOfSign = !(EXPECTED_SIGN_SEP[asp.angle] ?? []).includes(signSep);

          results.push({
            p1: a.name,
            p2: b.name,
            aspect: asp.name,
            abbr:   asp.abbr,
            angle:  asp.angle,
            orb:    parseFloat(orbVal.toFixed(1)),
            applying:  state === 'applying',
            faster:    faster.name,
            outOfSign,
          });
          break; // one aspect per pair
        }
      }
    }
  }

  return results;
}

/**
 * Returns the ruling planets for the querent and quesited houses.
 * Uses Regiomontanus-style cusp signs from the ephemeris data.
 */
export function getSignificators(ephemerisData, houseSignifications) {
  if (!ephemerisData?.houses?.cusps || !houseSignifications) {
    return { querentLord: null, quesitedLord: null };
  }
  const { cusps } = ephemerisData.houses;

  function cuspSign(houseNum) {
    const lon = parseFloat(cusps[String(houseNum)] ?? cusps[houseNum] ?? 0) || 0;
    return ZODIAC_SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
  }

  return {
    querentLord:  SIGN_RULERS[cuspSign(houseSignifications.querent_house  || 1)] ?? null,
    quesitedLord: SIGN_RULERS[cuspSign(houseSignifications.quesited_house || 7)] ?? null,
  };
}

/**
 * Detects collection of light: a slower planet receives applying aspects from both
 * significators simultaneously, acting as an intermediary between them.
 * Requires both lords to be the faster planet in their respective aspects.
 *
 * Each result: { collector, querentAspect, quesitedAspect }
 */
export function getCollectionOfLight(aspects, querentLord, quesitedLord) {
  if (!querentLord || !quesitedLord) return [];

  // Planets the querentLord is applying to (querentLord is faster)
  const querentApplyingTo = new Map();
  for (const a of aspects) {
    if (!a.applying || a.faster !== querentLord) continue;
    const other = a.p1 === querentLord ? a.p2 : a.p1;
    if (other !== quesitedLord) querentApplyingTo.set(other, a);
  }

  // Planets the quesitedLord is applying to (quesitedLord is faster)
  const results = [];
  for (const a of aspects) {
    if (!a.applying || a.faster !== quesitedLord) continue;
    const other = a.p1 === quesitedLord ? a.p2 : a.p1;
    if (other !== querentLord && querentApplyingTo.has(other)) {
      results.push({
        collector: other,
        querentAspect:  querentApplyingTo.get(other),
        quesitedAspect: a,
      });
    }
  }
  return results;
}

/**
 * Detects prohibition: a third planet has a tighter applying aspect to one of the
 * significators than the orb of the sig-to-sig applying aspect, meaning it will
 * perfect first and may block the matter.
 *
 * Returns [] when the significators have no direct applying aspect (nothing to prohibit).
 * Each result: { prohibitor, target, aspect (the prohibiting aspect), sigAspect }
 */
export function getProhibition(aspects, querentLord, quesitedLord) {
  if (!querentLord || !quesitedLord) return [];

  const sigAspect = aspects.find(a =>
    a.applying && (
      (a.p1 === querentLord && a.p2 === quesitedLord) ||
      (a.p1 === quesitedLord && a.p2 === querentLord)
    )
  );
  if (!sigAspect) return [];

  const results = [];
  for (const a of aspects) {
    if (!a.applying || a.orb >= sigAspect.orb) continue;
    const invQ  = a.p1 === querentLord  || a.p2 === querentLord;
    const invQd = a.p1 === quesitedLord || a.p2 === quesitedLord;
    if (!invQ && !invQd) continue;
    if (invQ && invQd) continue; // that's the sig-to-sig aspect itself

    const target    = invQ ? querentLord : quesitedLord;
    const prohibitor = a.p1 === target ? a.p2 : a.p1;
    results.push({ prohibitor, target, aspect: a, sigAspect });
  }
  return results;
}

/**
 * Detects translation of light: a third planet (the translator) has recently separated
 * from one significator and is currently applying to the other, connecting them when
 * they lack a direct applying aspect between themselves.
 *
 * Returns [] when the significators already share a direct applying aspect.
 * Each result: { translator, from, to, separatingAspect, applyingAspect }
 */
export function getTranslationOfLight(aspects, querentLord, quesitedLord) {
  if (!querentLord || !quesitedLord) return [];

  const directApplying = aspects.find(a =>
    a.applying && (
      (a.p1 === querentLord && a.p2 === quesitedLord) ||
      (a.p1 === quesitedLord && a.p2 === querentLord)
    )
  );
  if (directApplying) return [];

  const results = [];
  for (const T of CLASSICAL) {
    if (T === querentLord || T === quesitedLord) continue;

    const sepFrom = sig => aspects.find(a =>
      !a.applying && ((a.p1 === T && a.p2 === sig) || (a.p1 === sig && a.p2 === T))
    );
    const appTo = sig => aspects.find(a =>
      a.applying && ((a.p1 === T && a.p2 === sig) || (a.p1 === sig && a.p2 === T))
    );

    const s1 = sepFrom(querentLord), a2 = appTo(quesitedLord);
    if (s1 && a2) results.push({ translator: T, from: querentLord, to: quesitedLord, separatingAspect: s1, applyingAspect: a2 });

    const s2 = sepFrom(quesitedLord), a1 = appTo(querentLord);
    if (s2 && a1) results.push({ translator: T, from: quesitedLord, to: querentLord, separatingAspect: s2, applyingAspect: a1 });
  }
  return results;
}

/**
 * Filters aspects down to those involving both a significator planet (querent/quesited lord)
 * and the Moon, for the top-of-mind "perfection" summary.
 * Returns applying aspects first, then separating, sorted by tightest orb.
 */
export function getPerfectionAspects(aspects, querentLord, quesitedLord) {
  const sigs = new Set([querentLord, quesitedLord, 'Moon'].filter(Boolean));
  return aspects
    .filter(a => sigs.has(a.p1) && sigs.has(a.p2))
    .sort((a, b) => {
      if (a.applying !== b.applying) return a.applying ? -1 : 1;
      return a.orb - b.orb;
    });
}

// Daily speed (°/day) below which a direct planet is considered near-stationary and
// may turn retrograde before perfecting an applying aspect (refranation risk).
const STATION_THRESHOLDS = {
  Mercury: 0.20, Venus: 0.15, Mars: 0.06, Jupiter: 0.025, Saturn: 0.020,
};

/**
 * Detects refranation: the faster significator is direct and applying to an aspect,
 * but its speed is close to zero — it is about to station retrograde and back away
 * before perfection, destroying the matter.
 *
 * Returns null when there is no applying sig-to-sig aspect or no refranation risk.
 * Returns { planet, aspect, speed } when refranation is detected.
 */
export function getRefranation(aspects, querentLord, quesitedLord, ephemerisData) {
  if (!querentLord || !quesitedLord || !ephemerisData?.planets) return null;

  const sigSet = new Set([querentLord, quesitedLord]);
  const applying = aspects
    .filter(a => sigSet.has(a.p1) && sigSet.has(a.p2) && a.applying)
    .sort((a, b) => a.orb - b.orb);

  if (!applying.length) return null;

  const a = applying[0];
  const planet = ephemerisData.planets[a.faster];
  if (!planet || planet.is_retrograde) return null; // already retro — not refranation

  const threshold = STATION_THRESHOLDS[a.faster];
  if (!threshold) return null; // Sun/Moon never station retrograde

  const speed = planet.daily_speed;
  if (speed == null || speed <= 0 || speed >= threshold) return null;

  return { planet: a.faster, aspect: a, speed: parseFloat(speed.toFixed(4)) };
}

/**
 * Returns the Moon's most recent (last) and nearest upcoming (next) aspects.
 *
 * last — tightest separating Moon aspect; describes what has already passed.
 * next — tightest applying Moon aspect; describes what approaches.
 *        Includes a timing estimate using the Moon's sign mode.
 *
 * @returns {{ last: Object|null, next: Object|null }}
 */
export function getMoonTestimony(aspects, ephemerisData) {
  const moonAspects = aspects.filter(a => a.p1 === 'Moon' || a.p2 === 'Moon');

  const last = moonAspects
    .filter(a => !a.applying)
    .sort((a, b) => a.orb - b.orb)[0] ?? null;

  const next = moonAspects
    .filter(a => a.applying)
    .sort((a, b) => a.orb - b.orb)[0] ?? null;

  return { last, next };
}
