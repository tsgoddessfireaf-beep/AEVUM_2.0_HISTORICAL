// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

const SIGN_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

function toLon(planet) {
  const idx = ZODIAC_SIGNS.indexOf(planet.sign);
  return ((idx < 0 ? 0 : idx) * 30) + (planet.sign_degree || 0);
}

/**
 * Calculates the Lot (Part) of Fortune from an ephemeris snapshot.
 *
 * Day chart (Sun above the horizon): ASC + Moon − Sun
 * Night chart (Sun below the horizon): ASC + Sun − Moon
 *
 * Day/night determined by the Sun's position relative to the ASC:
 * ((sunLon − ascLon + 180) % 360 + 360) % 360 < 180  →  day
 *
 * Returns { lon, sign, degree, isDay, lord } or null if data is missing.
 */
export function getLotOfFortune(ephemerisData) {
  if (!ephemerisData?.houses || !ephemerisData?.planets) return null;
  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const sun  = ephemerisData.planets.Sun;
  const moon = ephemerisData.planets.Moon;
  if (!sun?.sign || !moon?.sign) return null;

  const sunLon  = toLon(sun);
  const moonLon = toLon(moon);

  const isDay = ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;

  const raw = isDay
    ? ascLon + moonLon - sunLon
    : ascLon + sunLon  - moonLon;
  const lon = ((raw % 360) + 360) % 360;

  const signIndex = Math.floor(lon / 30);
  const sign  = ZODIAC_SIGNS[signIndex];
  const degree = parseFloat((lon % 30).toFixed(2));
  const lord  = SIGN_RULERS[sign];

  return { lon, sign, degree, isDay, lord };
}

/**
 * Calculates the Lot (Part) of Spirit — the inverse of Fortune.
 *
 * Day chart:   ASC + Sun  − Moon
 * Night chart: ASC + Moon − Sun
 *
 * Returns { lon, sign, degree, isDay, lord } or null if data is missing.
 */
export function getLotOfSpirit(ephemerisData) {
  if (!ephemerisData?.houses || !ephemerisData?.planets) return null;
  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const sun  = ephemerisData.planets.Sun;
  const moon = ephemerisData.planets.Moon;
  if (!sun?.sign || !moon?.sign) return null;

  const sunLon  = toLon(sun);
  const moonLon = toLon(moon);
  const isDay = ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;

  // Spirit is the inverse formula of Fortune
  const raw = isDay
    ? ascLon + sunLon  - moonLon   // day:   ASC + Sun  − Moon
    : ascLon + moonLon - sunLon;   // night: ASC + Moon − Sun
  const lon = ((raw % 360) + 360) % 360;

  const signIndex = Math.floor(lon / 30);
  const sign  = ZODIAC_SIGNS[signIndex];
  const degree = parseFloat((lon % 30).toFixed(2));
  const lord  = SIGN_RULERS[sign];

  return { lon, sign, degree, isDay, lord };
}
