// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Astrological glyph mappings.
//
// Three modes:
//   "unicode"     — built-in glyphs (☉ ☽ ♀ etc). Always available, blockier look.
//   "astroscript" — AstroScript font by Jason Davies (in client/public/fonts/).
//                   ASCII letter positions remap to traditional astrology glyphs.
//   "astronomicon"— Daniel Eskridge's Astronomicon webfont (different keyboard map).
//
// To switch: change GLYPH_MODE below.

export const GLYPH_MODE = 'astroscript'; // 'unicode' | 'astroscript' | 'astronomicon'

const ASTROSCRIPT_PLANETS = {
  Sun: 'A', Moon: 'B', Mercury: 'C', Venus: 'D', Mars: 'E',
  Jupiter: 'F', Saturn: 'G', Uranus: 'H', Neptune: 'I', Pluto: 'J',
  Node: 'n', SouthNode: 'u',
};

const ASTROSCRIPT_SIGNS = {
  Aries: 'a', Taurus: 'b', Gemini: 'c', Cancer: 'd', Leo: 'e', Virgo: 'f',
  Libra: 'g', Scorpio: 'h', Sagittarius: 'i', Capricorn: 'j', Aquarius: 'k', Pisces: 'l',
};

// Extra glyphs available in AstroScript beyond the standard planet/sign set.
// Exposed as a separate map so callers can opt in.
export const ASTROSCRIPT_EXTRAS = {
  ASC: 'X',
  MC: 'Z',
  Fortune: 'O',     // Lot of Fortune ⊕
  Vertex: 'V',
  Retrograde: 'R',  // ℞
};

const ASTRONOMICON_PLANETS = {
  Sun: 'Q', Moon: 'W', Mercury: 'E', Venus: 'R', Mars: 'T',
  Jupiter: 'Y', Saturn: 'U', Uranus: 'I', Neptune: 'O', Pluto: 'P',
  Node: '{', SouthNode: '}',
};

const ASTRONOMICON_SIGNS = {
  Aries: 'A', Taurus: 'S', Gemini: 'D', Cancer: 'F', Leo: 'G', Virgo: 'H',
  Libra: 'J', Scorpio: 'K', Sagittarius: 'L', Capricorn: 'Z', Aquarius: 'X', Pisces: 'C',
};

const UNICODE_PLANETS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Node: '☊', SouthNode: '☋',
};

const UNICODE_SIGNS = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

const PLANET_MAPS = {
  unicode: UNICODE_PLANETS,
  astroscript: ASTROSCRIPT_PLANETS,
  astronomicon: ASTRONOMICON_PLANETS,
};
const SIGN_MAPS = {
  unicode: UNICODE_SIGNS,
  astroscript: ASTROSCRIPT_SIGNS,
  astronomicon: ASTRONOMICON_SIGNS,
};

export const PLANET_GLYPHS = PLANET_MAPS[GLYPH_MODE];
export const SIGN_GLYPHS   = SIGN_MAPS[GLYPH_MODE];

// CSS class to apply on any element that renders a glyph from these maps.
// In font modes this binds the font-family; in unicode it's a no-op.
const CLASS_MAP = {
  unicode: 'astro-glyph-unicode',
  astroscript: 'astro-glyph',     // CSS sets font-family: 'AstroScript'
  astronomicon: 'astro-glyph',    // (single .astro-glyph class — change CSS if both fonts ever co-exist)
};
export const GLYPH_CLASS = CLASS_MAP[GLYPH_MODE];

/**
 * Returns the glyph character for a planet in the active font mode.
 * Falls back to the first letter of the name, then '?' if the name is empty.
 * @param {string} name - Planet name, e.g. "Sun", "Moon", "Mars".
 * @returns {string}
 */
export function planetGlyph(name) {
  return PLANET_GLYPHS[name] || name?.[0] || '?';
}

/**
 * Returns the glyph character for a zodiac sign in the active font mode.
 * Falls back to the first letter of the name, then '?' if the name is empty.
 * @param {string} name - Sign name, e.g. "Aries", "Scorpio".
 * @returns {string}
 */
export function signGlyph(name) {
  return SIGN_GLYPHS[name] || name?.[0] || '?';
}
