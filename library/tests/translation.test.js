// Aevum Library — Translation & Ingestion Quality Test Suite
//
// Performs structural and linguistic alignment testing on all translated manuscript card databases.
// Run using Vitest: npx vitest run library/tests/translation.test.js

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelvesDir = join(__dir, '..', 'shelves');

const MANUSCRIPTS = [
  { tag: 'ibnezra', filename: 'ibnezra-cards.jsonl', lang: 'he' },
  { tag: 'alchabitius', filename: 'alchabitius-cards.jsonl', lang: 'la' },
  { tag: 'naibod', filename: 'naibod-cards.jsonl', lang: 'la' },
  { tag: 'dariot', filename: 'dariot-cards.jsonl', lang: 'la' },
  { tag: 'jacquinot', filename: 'jacquinot-cards.jsonl', lang: 'fr' }
];

// Dictionary of astrological terms for alignment checking
const ALIGNMENT_DICTIONARY = {
  he: {
    planets: [
      { keys: ['שבתי', 'שבתאי'], en: ['saturn'] },
      { keys: ['צדק'], en: ['jupiter'] },
      { keys: ['מאדים', 'משרת השני'], en: ['mars'] },
      { keys: ['חמה', 'שמש'], en: ['sun', 'solar'] },
      { keys: ['נוגה'], en: ['venus'] },
      { keys: ['כוכב'], en: ['mercury', 'planet'] }, // 'kochav' often means mercury or planet
      { keys: ['לבנה', 'ירח'], en: ['moon', 'lunar'] }
    ],
    signs: [
      { keys: ['טלה'], en: ['aries'] },
      { keys: ['שור'], en: ['taurus'] },
      { keys: ['תאומים'], en: ['gemini'] },
      { keys: ['סרטן'], en: ['cancer'] },
      { keys: ['אריה'], en: ['leo'] },
      { keys: ['בתולה'], en: ['virgo'] },
      { keys: ['מאזנים', 'מאזניים'], en: ['libra'] },
      { keys: ['עקרב'], en: ['scorpio'] },
      { keys: ['קשת'], en: ['sagittarius'] },
      { keys: ['גדי'], en: ['capricorn'] },
      { keys: ['דלי'], en: ['aquarius'] },
      { keys: ['דגים'], en: ['pisces'] }
    ]
  },
  la: {
    planets: [
      { keys: ['saturnus', 'saturni', 'saturno'], en: ['saturn'] },
      { keys: ['jupiter', 'jovis', 'jove'], en: ['jupiter'] },
      { keys: ['mars', 'martis', 'marte'], en: ['mars'] },
      { keys: ['sol ', 'solis', ' sole '], en: ['sun', 'solar'] }, // Added spaces to prevent matching 'sole' (alone) or 'sol' inside other words
      { keys: ['venus', 'veneris', 'venere'], en: ['venus'] },
      { keys: ['mercurius', 'mercurii', 'mercurio'], en: ['mercury'] },
      { keys: ['luna', 'lunae', 'lunam'], en: ['moon', 'lunar'] }
    ],
    signs: [
      { keys: ['aries', 'arietis'], en: ['aries'] },
      { keys: ['taurus', 'tauri'], en: ['taurus'] },
      { keys: ['gemini', 'geminorum'], en: ['gemini'] },
      { keys: ['cancer', 'cancri'], en: ['cancer'] },
      { keys: ['leo', 'leonis'], en: ['leo'] },
      { keys: ['virgo', 'virginis'], en: ['virgo'] },
      { keys: ['libra', 'librae'], en: ['libra'] },
      { keys: ['scorpio', 'scorpionis'], en: ['scorpio'] },
      { keys: ['sagittarius', 'sagittarii'], en: ['sagittarius'] },
      { keys: ['capricornus', 'capricorni'], en: ['capricorn'] },
      { keys: ['aquarius', 'aquarii'], en: ['aquarius'] },
      { keys: ['pisces', 'piscium'], en: ['pisces'] }
    ]
  },
  fr: {
    planets: [
      { keys: ['saturne'], en: ['saturn'] },
      { keys: ['jupiter'], en: ['jupiter'] },
      { keys: ['mars'], en: ['mars'] },
      { keys: ['soleil'], en: ['sun', 'solar'] },
      { keys: ['venus'], en: ['venus'] },
      { keys: ['mercure'], en: ['mercury'] },
      { keys: ['lune'], en: ['moon', 'lunar'] }
    ],
    signs: [
      { keys: ['bélier', 'belier'], en: ['aries'] },
      { keys: ['taureau'], en: ['taurus'] },
      { keys: ['gémeaux', 'gemeaux'], en: ['gemini'] },
      { keys: ['cancer'], en: ['cancer'] },
      { keys: ['lion'], en: ['leo'] },
      { keys: ['vierge'], en: ['virgo'] },
      { keys: ['balance'], en: ['libra'] },
      { keys: ['scorpion'], en: ['scorpio'] },
      { keys: ['sagittaire'], en: ['sagittarius'] },
      { keys: ['capricorne'], en: ['capricorn'] },
      { keys: ['verseau'], en: ['aquarius'] },
      { keys: ['poissons', 'poisson'], en: ['pisces'] }
    ]
  }
};

describe('Aevum Historical Library — Translation Database Tests', () => {
  for (const ms of MANUSCRIPTS) {
    const filePath = join(shelvesDir, ms.filename);

    describe(`Manuscript: ${ms.filename}`, () => {
      it('should exist on disk', () => {
        expect(existsSync(filePath)).toBe(true);
      });

      if (!existsSync(filePath)) return;

      const cards = readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line, idx) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            throw new Error(`JSON parse error on line ${idx + 1} of ${ms.filename}: ${e.message}`);
          }
        });

      it('should contain records', () => {
        expect(cards.length).toBeGreaterThan(0);
      });

      it('should have unique card IDs', () => {
        const ids = cards.map(c => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it('should have valid metadata fields for all cards', () => {
        for (const card of cards) {
          expect(card).toHaveProperty('id');
          expect(card).toHaveProperty('author');
          expect(card).toHaveProperty('work');
          expect(card).toHaveProperty('source_edition');
          expect(card).toHaveProperty('language', 'en');
          expect(card).toHaveProperty('license', 'public-domain');
          expect(card).toHaveProperty('section_ref');
          expect(card).toHaveProperty('title');
        }
      });

      it('should have non-empty translations or be marked as placeholders', () => {
        for (const card of cards) {
          if (card._status === 'placeholder') {
            expect(card.translation).toContain('[PLACEHOLDER');
          } else if (card.translation !== null && card.translation !== undefined) {
            expect(typeof card.translation).toBe('string');
            expect(card.translation.trim().length).toBeGreaterThan(0);
          }
        }
      });

      // Linguistic alignment checks
      const dict = ALIGNMENT_DICTIONARY[ms.lang];
      if (dict) {
        it('should align core astrological terminology (planets & signs) between source and translation', () => {
          const alignmentFailures = [];
          const uniqueFailedCards = new Set();

          for (const card of cards) {
            if (card._status === 'placeholder' || !card.text) continue;

            const sourceText = card.text.toLowerCase();
            const translationText = (card.translation || '').toLowerCase();

            // Check planets
            for (const item of dict.planets) {
              const hasSourcePlanet = item.keys.some(k => sourceText.includes(k));
              if (hasSourcePlanet) {
                const hasTranslationPlanet = item.en.some(enKey => translationText.includes(enKey));
                if (!hasTranslationPlanet) {
                  uniqueFailedCards.add(card.id);
                  alignmentFailures.push({
                    cardId: card.id,
                    type: 'planet',
                    sourceKeys: item.keys,
                    expectedEn: item.en,
                    title: card.title
                  });
                }
              }
            }

            // Check zodiac signs
            for (const item of dict.signs) {
              const hasSourceSign = item.keys.some(k => sourceText.includes(k));
              if (hasSourceSign) {
                const hasTranslationSign = item.en.some(enKey => translationText.includes(enKey));
                if (!hasTranslationSign) {
                  uniqueFailedCards.add(card.id);
                  alignmentFailures.push({
                    cardId: card.id,
                    type: 'sign',
                    sourceKeys: item.keys,
                    expectedEn: item.en,
                    title: card.title
                  });
                }
              }
            }
          }

          const failureRate = uniqueFailedCards.size / cards.length;
          
          if (failureRate >= 0.40) {
            console.warn(`⚠️  High terminology mismatch rate in ${ms.filename}: ${(failureRate * 100).toFixed(1)}%`);
            for (const fail of alignmentFailures.slice(0, 10)) {
              console.warn(`   [Mismatch] Card ${fail.cardId} ("${fail.title}"): Source contains "${fail.sourceKeys.join('/')}" but English lacks "${fail.expectedEn.join('/')}"`);
            }
          }

          // Assert that the mismatch rate is within acceptable bounds (< 40%)
          expect(failureRate).toBeLessThan(0.40);
        });
      }
    });
  }
});
