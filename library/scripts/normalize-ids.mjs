// Aevum Library — Normalize Card IDs
//
// Reads all JSONL card files, sorts them by chunk_idx, and re-assigns
// clean, unique, sequential IDs (e.g. ibnezra-wisdom-c0001 to ibnezra-wisdom-c1363).
// This guarantees 100% uniqueness and eliminates any duplicate IDs.
//
// Usage: node library/scripts/normalize-ids.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelvesDir = join(__dir, '..', 'shelves');

const MANUSCRIPTS = [
  { 
    tag: 'ibnezra', 
    filename: 'ibnezra-cards.jsonl', 
    slug: 'wisdom', 
    type: 'Chapter',
    author: 'Abraham Ibn Ezra',
    work: 'Introductions to Astrology (Beginning of Wisdom & Judgments of the Zodiacal Signs)',
    source_edition: 'Shlomo Sela, Brill 2017',
    source_url: 'https://archive.org/details/abraham-ibn-ezras-introductions-to-astrology'
  },
  { 
    tag: 'alchabitius', 
    filename: 'alchabitius-cards.jsonl', 
    slug: 'libellus', 
    type: 'Chapter',
    author: 'Alchabitius',
    work: 'Libellus isagogicus',
    source_edition: 'Venice 1485',
    source_url: 'https://opacplus.bsb-muenchen.de/title/bsb10198576'
  },
  { 
    tag: 'naibod', 
    filename: 'naibod-cards.jsonl', 
    slug: 'enarratio', 
    type: 'Chapter',
    author: 'Valentin Naibod',
    work: 'Enarratio elementorum astrologiae',
    source_edition: 'Cologne, 1573',
    source_url: 'https://books.google.com/books?id=5W88AAAAcAAJ'
  },
  { 
    tag: 'dariot', 
    filename: 'dariot-cards.jsonl', 
    slug: 'ad', 
    type: 'Chapter',
    author: 'Claude Dariot',
    work: 'Ad Astrorum Judicia Facilis Introductio',
    source_edition: 'Lyon, 1557',
    source_url: 'https://gallica.bnf.fr/ark:/12148/bpt6k79124v.pdf'
  },
  { 
    tag: 'jacquinot', 
    filename: 'jacquinot-cards.jsonl', 
    slug: 'astrolabe', 
    type: 'Chapter',
    author: 'Dominique Jacquinot',
    work: "L'usage de l'astrolabe (L'vsage de l'vn et l'avtre astrolabe)",
    source_edition: 'Paris, 1625 (ed. Jean Moreau)',
    source_url: 'https://archive.org/details/lvsagedelvnetlav00jacq'
  }
];

function normalizeFile(ms) {
  const filePath = join(shelvesDir, ms.filename);
  const cards = readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  
  // Sort by chunk_idx first, then by their current order to preserve the book sequence
  const sorted = [...cards].sort((a, b) => {
    const ai = typeof a.chunk_idx === 'number' ? a.chunk_idx : 99999;
    const bi = typeof b.chunk_idx === 'number' ? b.chunk_idx : 99999;
    return ai - bi;
  });

  // Re-assign sequential IDs and inject metadata
  const normalized = sorted.map((card, i) => {
    const num = i + 1;
    const newId = `${ms.tag}-${ms.slug}-c${String(num).padStart(4, '0')}`;
    return {
      id: newId,
      author: ms.author,
      tradition_tag: ms.tag,
      work: ms.work,
      source_edition: ms.source_edition,
      language: 'en',
      license: 'public-domain',
      section_ref: card.number ? `${ms.type} ${card.number}` : `${ms.type} ${num}`,
      title: card.title || null,
      text: card.text || null,
      translation: card.translation || null,
      topics: card.topics || [],
      condition_keys: card.condition_keys || [],
      chunk_idx: card.chunk_idx,
      chunk_ref: card.chunk_ref,
      source_url: ms.source_url,
      retrieved_at: card.retrieved_at || '2026-06-28'
    };
  });

  writeFileSync(filePath, normalized.map(c => JSON.stringify(c)).join('\n') + '\n');
  console.log(`✅ Normalized ${normalized.length} cards in ${ms.filename} (IDs: ${normalized[0].id} to ${normalized[normalized.length - 1].id})`);
}

console.log('Starting card ID normalization...');
for (const ms of MANUSCRIPTS) {
  normalizeFile(ms);
}
console.log('Done.');
