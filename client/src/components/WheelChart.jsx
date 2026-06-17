// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect, useMemo } from 'react';
import { PLANET_GLYPHS, SIGN_GLYPHS, GLYPH_CLASS, planetGlyph, ASTROSCRIPT_EXTRAS, GLYPH_MODE } from '../lib/glyphs.js';
import { getLotOfFortune } from '../lib/lots.js';
import { getAspects } from '../lib/aspects.js';
import { getPlanetaryDignities } from '../lib/dignity.js';

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                      'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

const SIGN_RULERS = {
  Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon', Leo:'Sun', Virgo:'Mercury',
  Libra:'Venus', Scorpio:'Mars', Sagittarius:'Jupiter', Capricorn:'Saturn',
  Aquarius:'Saturn', Pisces:'Jupiter',
};

const SIGN_ELEMENT = {
  Aries:'fire', Leo:'fire', Sagittarius:'fire',
  Taurus:'earth', Virgo:'earth', Capricorn:'earth',
  Gemini:'air', Libra:'air', Aquarius:'air',
  Cancer:'water', Scorpio:'water', Pisces:'water',
};

const ELEMENT_FILLS = {
  fire:  'rgba(255, 90, 30, 0.20)',
  earth: 'rgba(80, 180, 80, 0.17)',
  air:   'rgba(100, 180, 255, 0.17)',
  water: 'rgba(80, 80, 220, 0.20)',
};

// Radii
const R = {
  OUTER: 230, SIGN_TEXT: 195, SIGN_IN: 178,
  HOUSE_TEXT: 165, HOUSE_IN: 148,
  PLT: [120, 95, 70], HUB: 40,
};

const CX = 250, CY = 250;

const ASPECT_COLORS = {
  Conjunction: [200, 169, 81],
  Trine:       [80,  150, 210],
  Sextile:     [60,  170, 110],
  Square:      [210, 70,  70 ],
  Opposition:  [200, 60,  60 ],
};

/**
 * Converts an ecliptic longitude to an SVG angle so that the Ascendant lands
 * at the 9 o'clock (180°) position, matching traditional chart orientation.
 * @param {number} lon - Ecliptic longitude (0–360°).
 * @param {number} ascLon - Ascendant longitude used as the rotation anchor.
 * @returns {number} SVG angle in degrees.
 */
export function lonToSVGAngle(lon, ascLon) {
  return ((180 + ascLon - lon) % 360 + 360) % 360;
}

/**
 * Converts polar coordinates to a Cartesian {x, y} point on the SVG canvas.
 * @param {number} angleDeg - Angle in degrees (0 = right, clockwise).
 * @param {number} r - Radius in SVG units.
 * @param {number} [cx=CX] - Centre x.
 * @param {number} [cy=CY] - Centre y.
 * @returns {{ x: number, y: number }}
 */
export function polar(angleDeg, r, cx = CX, cy = CY) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Reconstructs the ecliptic longitude from a planet's sign + degree fields.
 * @param {{ sign: string, sign_degree: number }} p - Planet data from the ephemeris response.
 * @returns {number} Ecliptic longitude (0–360°).
 */
export function planetLon(p) {
  const idx = ZODIAC_SIGNS.indexOf(p.sign);
  return idx * 30 + (p.sign_degree || 0);
}

/**
 * Builds an SVG arc path string between two angles at a given radius.
 * Uses the large-arc flag automatically based on the angular span.
 * @param {number} startAngle - Start angle in degrees.
 * @param {number} endAngle - End angle in degrees.
 * @param {number} r - Radius.
 * @param {number} [cx=CX] - Centre x.
 * @param {number} [cy=CY] - Centre y.
 * @returns {string} SVG path `d` attribute value.
 */
function arcPath(startAngle, endAngle, r, cx = CX, cy = CY) {
  const s = polar(startAngle, r, cx, cy);
  const e = polar(endAngle, r, cx, cy);
  const diff = ((startAngle - endAngle) + 360) % 360;
  const la = diff > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${la} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/**
 * Builds an SVG path for a filled annular sector (donut slice) representing a house or sign band.
 * Converts ecliptic longitudes to SVG angles internally.
 * @param {number} startLon - Start ecliptic longitude.
 * @param {number} endLon - End ecliptic longitude.
 * @param {number} rOuter - Outer radius.
 * @param {number} rInner - Inner radius.
 * @param {number} ascLon - Ascendant longitude for orientation.
 * @returns {string} SVG path `d` attribute value.
 */
function houseSectorPath(startLon, endLon, rOuter, rInner, ascLon) {
  const aS = lonToSVGAngle(startLon, ascLon);
  const aE = lonToSVGAngle(endLon, ascLon);
  const diff = ((aS - aE) + 360) % 360;
  const la = diff > 180 ? 1 : 0;
  const p1 = polar(aS, rOuter);
  const p2 = polar(aE, rOuter);
  const p3 = polar(aE, rInner);
  const p4 = polar(aS, rInner);
  return [
    `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A${rOuter} ${rOuter} 0 ${la} 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A${rInner} ${rInner} 0 ${la} 1 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}


/**
 * Assigns each planet to one of three radial tiers to prevent glyph overlap.
 * Planets are sorted by SVG angle, then greedily placed into the innermost tier
 * that has at least 8° of clearance from the last planet placed there.
 * @param {Array<{ name: string, glyph: string, lon: number, retro: boolean }>} bodies
 * @param {number} ascLon - Ascendant longitude for SVG angle conversion.
 * @returns {Array} Bodies with `svgAngle`, `tier`, and `r` fields added.
 */
function placePlanets(bodies, ascLon) {
  const items = bodies.map(b => ({
    ...b,
    svgAngle: lonToSVGAngle(b.lon, ascLon),
  })).sort((a, b) => a.svgAngle - b.svgAngle);

  const tierLast = [null, null, null];
  items.forEach(p => {
    const t = R.PLT.findIndex((_, i) => {
      if (tierLast[i] == null) return true;
      const d = Math.abs(p.svgAngle - tierLast[i]);
      return Math.min(d, 360 - d) >= 8;
    });
    p.tier = t < 0 ? 2 : t;
    p.r = R.PLT[p.tier];
    tierLast[p.tier] = p.svgAngle;
  });
  return items;
}

/**
 * Extracts house cusp longitudes as a 12-element array from the ephemeris houses object.
 * @param {{ cusps: Object<string, number> }} houses
 * @returns {number[]} Array of 12 ecliptic longitudes, index 0 = House 1.
 */
export function getCuspLons(houses) {
  const cusps = houses.cusps || {};
  return Array.from({ length: 12 }, (_, i) => parseFloat(cusps[i + 1]) || 0);
}

/**
 * Animated SVG horary wheel shown while Gemini is generating the analysis.
 * Draws zodiac sign band, house sectors with elemental fills, planet glyphs with
 * tier-based collision avoidance, and cardinal angle labels. Significator planets
 * glow gold (querent) or silver (quesited) once the animation completes.
 * @param {{ ephemerisData: Object, houseSignifications: Object }} props
 */
export default function WheelChart({ ephemerisData, houseSignifications, transitData = null, skipAnimation = false, prefs = {} }) {
  const [animStage, setAnimStage] = useState(0);
  const [selectedPlanet, setSelectedPlanet] = useState(null);

  useEffect(() => {
    if (!ephemerisData) return;
    if (skipAnimation) { setAnimStage(5); return; }
    const timers = [
      setTimeout(() => setAnimStage(1), 50),
      setTimeout(() => setAnimStage(2), 1800),
      setTimeout(() => setAnimStage(3), 2800),
      setTimeout(() => setAnimStage(4), 3800),
      setTimeout(() => setAnimStage(5), 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [!!ephemerisData, skipAnimation]); // eslint-disable-line react-hooks/exhaustive-deps

  const derived = useMemo(() => {
    if (!ephemerisData) return null;
    const { houses, planets, nodes } = ephemerisData;
    const ascLon = parseFloat(houses.ascendant) || 0;
    const mcLon  = parseFloat(houses.mc) || 0;
    const cuspLons = getCuspLons(houses);

    // Significators
    const querentHouse = houseSignifications?.querent_house || 1;
    const quesitedHouse = houseSignifications?.quesited_house || 7;
    const cuspSigns = cuspLons.map(lon => ZODIAC_SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)]);
    const querentRuler = SIGN_RULERS[cuspSigns[querentHouse - 1]];
    const quesitedRuler = SIGN_RULERS[cuspSigns[quesitedHouse - 1]];

    // Bodies to place
    const bodies = [];
    Object.entries(planets || {}).forEach(([name, p]) => {
      bodies.push({ name, glyph: planetGlyph(name), lon: planetLon(p), retro: p.is_retrograde });
    });
    // North Node
    if (nodes?.mean_north_node && prefs.showNode !== false) {
      const nn = nodes.mean_north_node;
      bodies.push({ name: 'Node', glyph: planetGlyph('Node'), lon: planetLon(nn), retro: false });
    }
    // Lot of Fortune
    if (prefs.showLotOfFortune !== false) {
      const fortune = getLotOfFortune(ephemerisData);
      if (fortune) {
        bodies.push({ name: 'Fortune', glyph: ASTROSCRIPT_EXTRAS.Fortune, lon: fortune.lon, retro: false });
      }
    }

    const placed = placePlanets(bodies, ascLon);

    return { ascLon, mcLon, cuspLons, cuspSigns, querentHouse, quesitedHouse, querentRuler, quesitedRuler, placed };
  }, [ephemerisData, houseSignifications, prefs.showNode, prefs.showLotOfFortune]); // eslint-disable-line react-hooks/exhaustive-deps

  const transitPlaced = useMemo(() => {
    if (!transitData?.planets || !derived) return [];
    const bodies = [];
    Object.entries(transitData.planets).forEach(([name, p]) => {
      bodies.push({ name, glyph: planetGlyph(name), lon: planetLon(p), retro: p.is_retrograde });
    });
    return placePlanets(bodies, derived.ascLon).map(p => ({
      ...p,
      r: p.tier === 0 ? 276 : 263,
    }));
  }, [transitData, derived]);

  const aspectLines = useMemo(() => {
    if (!derived || !ephemerisData || prefs.showAspectLines === false) return [];
    const aspects = getAspects(ephemerisData);
    const posMap = {};
    derived.placed.forEach(p => { posMap[p.name] = p; });
    const sigSet = new Set([derived.querentRuler, derived.quesitedRuler, 'Moon'].filter(Boolean));
    return aspects.map(a => {
      const pl1 = posMap[a.p1];
      const pl2 = posMap[a.p2];
      if (!pl1 || !pl2) return null;
      return { ...a, pl1, pl2, isSig: sigSet.has(a.p1) && sigSet.has(a.p2) };
    }).filter(Boolean);
  }, [derived, ephemerisData, prefs.showAspectLines]); // eslint-disable-line react-hooks/exhaustive-deps



  if (!ephemerisData || !derived) return null;

  const { ascLon, mcLon, cuspLons, cuspSigns, querentHouse, quesitedHouse, querentRuler, quesitedRuler, placed } = derived;

  // Ring circumferences for dashoffset animation
  const ringCircs = [R.OUTER, R.SIGN_IN, R.HOUSE_IN, R.HUB].map(r => (2 * Math.PI * r).toFixed(2));

  const spinning = animStage >= 4 && !skipAnimation;
  const tilted = animStage >= 5 && !skipAnimation;

  return (
    <div className={`flex flex-col items-center ${skipAnimation ? 'py-2' : 'py-8'} select-none`}>
      {!skipAnimation && (
        <p className="text-silver/70 text-xs uppercase tracking-widest mb-6">
          Reading your chart…
        </p>
      )}

      <div style={{ perspective: 'clamp(400px, 180vw, 900px)', perspectiveOrigin: '50% 50%', width: '100%', maxWidth: '360px', margin: '0 auto' }}>
        <svg
          viewBox="-35 -35 570 570"
          width="100%"
          onClick={() => setSelectedPlanet(null)}
          style={{
            display: 'block',
            overflow: 'visible',
            transform: tilted ? 'rotateX(18deg)' : 'rotateX(0deg)',
            transition: 'transform 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <defs>
            <clipPath id="wc-clip">
              <circle cx={CX} cy={CY} r={R.OUTER} />
            </clipPath>

            {/* Glow filters */}
            <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feColorMatrix type="matrix" in="blur"
                values="1.5 0.8 0 0 0  0.8 0.6 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="gold" />
              <feMerge><feMergeNode in="gold" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="silverGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feColorMatrix type="matrix" in="blur"
                values="0.7 0.7 1 0 0  0.7 0.7 1 0 0  0.7 0.7 1 0 0  0 0 0 1 0"
                result="silver" />
              <feMerge><feMergeNode in="silver" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="earthGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="airGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="waterGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Static rings (outside rotating group, always visible frame) ── */}
          {[R.OUTER, R.SIGN_IN, R.HOUSE_IN, R.HUB].map((r, i) => {
            const circ = ringCircs[i];
            return (
              <circle
                key={r}
                className="wheel-ring"
                cx={CX} cy={CY} r={r}
                fill="none"
                stroke="rgba(200,169,81,0.35)"
                strokeWidth={i === 0 ? 1.5 : 1}
                strokeDasharray={circ}
                strokeDashoffset={animStage >= 1 ? 0 : circ}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{
                  transition: `stroke-dashoffset 1.4s ease-out ${i * 0.22}s`,
                }}
              />
            );
          })}

          {/* ── Rotating group ── */}
          <g
            clipPath="url(#wc-clip)"
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              animation: spinning ? 'wheelSpin 120s linear infinite' : 'none',
            }}
          >
            {/* Zodiac sign band sectors */}
            {animStage >= 2 && ZODIAC_SIGNS.map((sign, i) => {
              const startLon = i * 30;
              const endLon = startLon + 30;
              const startAngle = lonToSVGAngle(startLon, ascLon);
              const endAngle = lonToSVGAngle(endLon, ascLon);
              return (
                <path
                  key={sign}
                  className="zodiac-sector"
                  d={houseSectorPath(startLon, endLon, R.OUTER, R.SIGN_IN, ascLon)}
                  fill={i % 2 === 0 ? 'rgba(200,169,81,0.04)' : 'rgba(200,169,81,0.02)'}
                  stroke="rgba(200,169,81,0.15)"
                  strokeWidth="0.5"
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: 'opacity 0.8s ease' }}
                />
              );
            })}

            {/* 5° degree tick marks on outer ring */}
            {animStage >= 2 && Array.from({ length: 72 }, (_, i) => {
              const lon = i * 5;
              if (lon % 30 === 0) return null; // sign boundaries already drawn
              const angle = lonToSVGAngle(lon, ascLon);
              const o = polar(angle, R.OUTER);
              const inn = polar(angle, R.OUTER - 4);
              return (
                <line key={`tick-${i}`}
                  className="tick-line"
                  x1={o.x.toFixed(2)} y1={o.y.toFixed(2)}
                  x2={inn.x.toFixed(2)} y2={inn.y.toFixed(2)}
                  stroke="rgba(200,169,81,0.30)"
                  strokeWidth="0.4"
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: 'opacity 0.8s ease' }}
                />
              );
            })}

            {/* Zodiac sign glyphs */}
            {animStage >= 2 && ZODIAC_SIGNS.map((sign, i) => {
              const midLon = i * 30 + 15;
              const angle = lonToSVGAngle(midLon, ascLon);
              const pos = polar(angle, R.SIGN_TEXT);
              return (
                <text
                  key={sign}
                  className={`${GLYPH_CLASS} zodiac-glyph`}
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="14"
                  fill="rgba(200,169,81,0.75)"
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: `opacity 0.6s ease ${i * 0.04}s` }}
                >
                  {SIGN_GLYPHS[sign]}
                </text>
              );
            })}

            {/* House sectors with elemental glow */}
            {animStage >= 2 && cuspLons.map((startLon, i) => {
              const endLon = cuspLons[(i + 1) % 12];
              const houseNum = i + 1;
              const isSignificant = houseNum === querentHouse || houseNum === quesitedHouse;
              const element = SIGN_ELEMENT[cuspSigns[i]];
              const fill = (animStage >= 4 && isSignificant && element)
                ? ELEMENT_FILLS[element]
                : 'rgba(200,169,81,0.03)';
              const glowFilter = (animStage >= 4 && !skipAnimation && isSignificant && element)
                ? `url(#${element}Glow)` : undefined;

              return (
                <path
                  key={houseNum}
                  className="house-sector"
                  d={houseSectorPath(startLon, endLon, R.SIGN_IN, R.HOUSE_IN, ascLon)}
                  fill={fill}
                  stroke="rgba(200,169,81,0.25)"
                  strokeWidth="0.75"
                  filter={glowFilter}
                  style={{ transition: 'fill 1.2s ease' }}
                />
              );
            })}

            {/* House cusp lines */}
            {animStage >= 2 && cuspLons.map((lon, i) => {
              const angle = lonToSVGAngle(lon, ascLon);
              const inner = polar(angle, R.HOUSE_IN);
              const outer = polar(angle, R.SIGN_IN);
              const isAngle = i % 3 === 0;
              return (
                <line
                  key={i}
                  className="cusp-line"
                  x1={inner.x} y1={inner.y}
                  x2={outer.x} y2={outer.y}
                  stroke={isAngle ? 'rgba(200,169,81,0.60)' : 'rgba(200,169,81,0.30)'}
                  strokeWidth={isAngle ? 1.2 : 0.75}
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: `opacity 0.5s ease ${i * 0.03}s` }}
                />
              );
            })}

            {/* House numerals */}
            {animStage >= 2 && prefs.showHouseNumerals !== false && cuspLons.map((startLon, i) => {
              const endLon = cuspLons[(i + 1) % 12];
              const span = ((endLon - startLon) + 360) % 360;
              const midLon = startLon + span / 2;
              const angle = lonToSVGAngle(midLon, ascLon);
              const pos = polar(angle, R.HOUSE_TEXT);
              return (
                <text
                  key={i}
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  fill="rgba(200,169,81,0.55)"
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: `opacity 0.6s ease ${i * 0.05}s`, fontFamily: 'system-ui, sans-serif', letterSpacing: '0' }}
                >
                  {ROMAN[i]}
                </text>
              );
            })}

            {/* Spoke lines to hub */}
            {animStage >= 2 && cuspLons.filter((_, i) => i % 3 === 0).map((lon, i) => {
              const angle = lonToSVGAngle(lon, ascLon);
              const inner = polar(angle, R.HUB);
              const outer = polar(angle, R.HOUSE_IN);
              return (
                <line
                  key={i}
                  className="spoke-line"
                  x1={inner.x} y1={inner.y}
                  x2={outer.x} y2={outer.y}
                  stroke="rgba(200,169,81,0.20)"
                  strokeWidth="0.75"
                  style={{ opacity: animStage >= 2 ? 1 : 0, transition: `opacity 0.5s ease` }}
                />
              );
            })}

            {/* Center hub fill */}
            <circle cx={CX} cy={CY} r={R.HUB}
              className="center-hub"
              fill="rgba(13,13,31,0.9)"
              stroke="rgba(200,169,81,0.20)"
              strokeWidth="0.75"
            />
            {animStage >= 3 && (() => {
              const phaseAngle = ephemerisData?.lunar_phase?.moon_phase_angle;
              if (phaseAngle == null) {
                return (
                  <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
                    fontSize="16" fill="rgba(200,169,81,0.40)"
                    style={{ fontFamily: 'system-ui, sans-serif' }}>
                    ✦
                  </text>
                );
              }
              const moonR = 13;
              const p = (((phaseAngle % 360) + 360) % 360) / 360;
              const kx = moonR * Math.cos(2 * Math.PI * p);
              const rx = Math.abs(kx);
              let litPath;
              if (rx < 0.3) {
                litPath = p < 0.5
                  ? `M ${CX} ${CY - moonR} A ${moonR} ${moonR} 0 0 1 ${CX} ${CY + moonR} L ${CX} ${CY - moonR} Z`
                  : `M ${CX} ${CY - moonR} A ${moonR} ${moonR} 0 0 0 ${CX} ${CY + moonR} L ${CX} ${CY - moonR} Z`;
              } else if (p < 0.5) {
                const sw = kx >= 0 ? 1 : 0;
                litPath = `M ${CX} ${CY - moonR} A ${moonR} ${moonR} 0 0 1 ${CX} ${CY + moonR} A ${rx.toFixed(2)} ${moonR} 0 0 ${sw} ${CX} ${CY - moonR} Z`;
              } else {
                const sw = kx < 0 ? 1 : 0;
                litPath = `M ${CX} ${CY - moonR} A ${moonR} ${moonR} 0 0 0 ${CX} ${CY + moonR} A ${rx.toFixed(2)} ${moonR} 0 0 ${sw} ${CX} ${CY - moonR} Z`;
              }
              return (
                <g>
                  <circle cx={CX} cy={CY} r={moonR} fill="rgba(8,10,22,0.95)" />
                  <path d={litPath} fill="rgba(210,185,120,0.55)" />
                  <circle cx={CX} cy={CY} r={moonR} fill="none"
                          stroke="rgba(200,169,81,0.30)" strokeWidth="0.5" />
                </g>
              );
            })()}

            {/* Aspect lines */}
            {animStage >= 5 && prefs.showAspectLines !== false && aspectLines.map((a, i) => {
              const pos1 = polar(a.pl1.svgAngle, a.pl1.r);
              const pos2 = polar(a.pl2.svgAngle, a.pl2.r);
              const [r, g, b] = ASPECT_COLORS[a.aspect] || [150, 150, 150];
              const alpha = a.isSig ? (a.applying ? 0.60 : 0.40) : 0.20;
              const strokeWidth = a.isSig ? (a.applying ? 1.2 : 0.9) : 0.55;
              return (
                <line key={`al-${i}`}
                  className="aspect-line"
                  x1={pos1.x.toFixed(2)} y1={pos1.y.toFixed(2)}
                  x2={pos2.x.toFixed(2)} y2={pos2.y.toFixed(2)}
                  stroke={`rgba(${r},${g},${b},${alpha})`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={a.applying ? undefined : "3 3"}
                />
              );
            })}

            {/* Planet glyphs */}
            {animStage >= 3 && placed.map((p, i) => {
              const pos = polar(p.svgAngle, p.r);
              const isFortune = p.name === 'Fortune';
              const isQuerentSig = !isFortune && (p.name === querentRuler || p.name === 'Moon');
              const isQuesitedSig = !isFortune && p.name === quesitedRuler;
              const glowFilter = animStage >= 5 && !skipAnimation
                ? (isQuerentSig ? 'url(#goldGlow)' : isQuesitedSig ? 'url(#silverGlow)' : undefined)
                : undefined;
              const fill = isFortune
                ? 'rgba(248,228,160,0.72)'
                : animStage >= 5
                  ? (isQuerentSig ? '#f0c96a' : isQuesitedSig ? '#b8ccdc' : 'rgba(200,169,81,0.80)')
                  : 'rgba(200,169,81,0.80)';

              return (
                <g key={p.name} filter={glowFilter}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedPlanet(prev => prev?.name === p.name ? null : p);
                   }}
                   style={{ cursor: 'pointer' }}>
                  {/* Invisible hitbox to enlarge tap target */}
                  <circle cx={pos.x} cy={pos.y} r="10" fill="transparent" />
                  <text
                    className={`${GLYPH_CLASS} planet-glyph`}
                    x={pos.x} y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="13"
                    fill={fill}
                    style={{
                      opacity: animStage >= 3 ? 1 : 0,
                      transition: `opacity 0.5s ease ${i * 0.08}s, fill 1s ease`,
                      pointerEvents: 'none',
                    }}
                  >
                    {p.glyph}
                  </text>
                  {p.retro && (
                    <text
                      className={`${GLYPH_MODE === 'astroscript' ? GLYPH_CLASS : ''} retro-symbol`}
                      x={pos.x + 7} y={pos.y - 5}
                      fontSize={GLYPH_MODE === 'astroscript' ? '8' : '6'}
                      fill="rgba(245,158,11,0.85)"
                      style={GLYPH_MODE === 'astroscript' ? undefined : { fontFamily: 'system-ui, sans-serif' }}
                    >
                      {GLYPH_MODE === 'astroscript' ? ASTROSCRIPT_EXTRAS.Retrograde : '℞'}
                    </text>
                  )}

                </g>
              );
            })}
          </g>

          {/* ── Transit planet ring — unclipped, outside natal wheel ── */}
          {transitData && transitPlaced.length > 0 && (
            <g style={{ animation: spinning ? 'wheelSpin 120s linear infinite' : 'none',
                        transformOrigin: `${CX}px ${CY}px` }}>
              <circle cx={CX} cy={CY} r={234} fill="none"
                      stroke="rgba(100,149,237,0.22)" strokeWidth={0.8} strokeDasharray="3 4" />
              {transitPlaced.map((p) => {
                const pos = polar(p.svgAngle, p.r);
                return (
                  <g key={`t-${p.name}`}>
                    <text className={GLYPH_CLASS} x={pos.x} y={pos.y}
                          textAnchor="middle" dominantBaseline="central"
                          fontSize="11" fill="rgba(100,149,237,0.82)">
                      {p.glyph}
                    </text>
                    {p.retro && (
                      <text x={pos.x + 6} y={pos.y - 4} fontSize="6"
                            fill="rgba(100,149,237,0.70)"
                            style={{ fontFamily: 'system-ui, sans-serif' }}>℞</text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ── Planet tooltip — outside rotating group, static position ── */}
          {selectedPlanet && animStage >= 3 && (() => {
            const name = selectedPlanet.name;
            let info = null;
            if (name === 'Fortune') {
              const f = getLotOfFortune(ephemerisData);
              info = f ? { sign: f.sign, sign_degree: f.degree, house: null, special: 'Lot' } : null;
            } else if (name === 'Node') {
              const n = ephemerisData?.nodes?.mean_north_node;
              info = n ? { sign: n.sign, sign_degree: n.sign_degree, house: null } : null;
            } else {
              info = ephemerisData?.planets?.[name] || null;
            }
            const lines = [{ text: name, bold: true }];
            if (info?.sign != null) {
              const deg = typeof info.sign_degree === 'number'
                ? info.sign_degree.toFixed(1)
                : info.sign_degree;
              lines.push({ text: `${deg}° ${info.sign}` });
            }
            if (info?.house) lines.push({ text: `House ${info.house}` });
            if (selectedPlanet.retro) lines.push({ text: 'Retrograde', dim: true });
            if (info?.daily_speed != null) {
              lines.push({ text: `${info.daily_speed.toFixed(2)}°/day`, dim: true });
            }
            if (info?.special) lines.push({ text: info.special, dim: true });

            const boxW = 96, lineH = 13, padY = 7;
            const boxH = lines.length * lineH + padY * 2;
            const bx = CX - boxW / 2;
            const by = CY - R.HUB - 12 - boxH;

            return (
              <g onClick={(e) => { e.stopPropagation(); setSelectedPlanet(null); }}
                 style={{ cursor: 'pointer' }}>
                <rect x={bx} y={by} width={boxW} height={boxH}
                      fill="rgba(8,10,22,0.96)"
                      stroke="rgba(200,169,81,0.50)"
                      strokeWidth="0.75" rx="4" />
                {lines.map((line, i) => (
                  <text key={i}
                    x={CX} y={by + padY + (i + 0.75) * lineH}
                    textAnchor="middle" fontSize="9"
                    fill={line.bold
                      ? 'rgba(200,169,81,0.95)'
                      : line.dim
                        ? 'rgba(150,150,170,0.70)'
                        : 'rgba(200,200,220,0.88)'}
                    fontWeight={line.bold ? '600' : 'normal'}
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    {line.text}
                  </text>
                ))}
              </g>
            );
          })()}

          {/* ── Cardinal labels — static, outside rotating group ── */}
          {animStage >= 2 && prefs.showCardinalLabels !== false && (() => {
            const ascAngle = lonToSVGAngle(ascLon, ascLon); // always 180
            const dscAngle = (ascAngle + 180) % 360;        // always 0
            const mcAngle  = lonToSVGAngle(mcLon, ascLon);
            const icAngle  = (mcAngle + 180) % 360;
            const labelR   = R.OUTER + 16;
            const useGlyphs = GLYPH_MODE === 'astroscript';
            const labels = [
              { key: 'ASC', angle: ascAngle, text: 'ASC', glyph: ASTROSCRIPT_EXTRAS.ASC },
              { key: 'DSC', angle: dscAngle, text: 'DSC', glyph: null },
              { key: 'MC',  angle: mcAngle,  text: 'MC',  glyph: ASTROSCRIPT_EXTRAS.MC },
              { key: 'IC',  angle: icAngle,  text: 'IC',  glyph: null },
            ];
            return labels.map(({ key, angle, text, glyph }) => {
              const pos = polar(angle, labelR);
              const renderGlyph = useGlyphs && glyph;
              return (
                <text
                  key={key}
                  className={`${renderGlyph ? GLYPH_CLASS : ''} cardinal-label`.trim() || undefined}
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={renderGlyph ? '14' : '8'}
                  fill="rgba(200,169,81,0.85)"
                  fontWeight={renderGlyph ? 'normal' : '600'}
                  letterSpacing={renderGlyph ? '0' : '0.5'}
                  style={renderGlyph ? { opacity: 1 } : { opacity: 1, fontFamily: 'system-ui, sans-serif' }}
                >
                  {renderGlyph ? glyph : text}
                </text>
              );
            });
          })()}
        </svg>
      </div>

      {/* Stage caption */}
      {!skipAnimation && (
        <p className="text-silver/40 text-xs mt-5 tracking-wide" style={{ minHeight: '1em' }}>
          {animStage < 2 && 'Tracing the celestial circles…'}
          {animStage === 2 && 'Placing the houses…'}
          {animStage === 3 && 'Charting the planets…'}
          {animStage >= 4 && 'The stars are speaking…'}
        </p>
      )}
    </div>
  );
}
