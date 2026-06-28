// Insert placeholder cards for failed Ibn Ezra chunks 80, 83, 103, 104
// These keep the sequence intact — marked _status: 'placeholder' for later review

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelf = join(__dir, '..', 'shelves', 'ibnezra-wisdom.txt');
const cardsPath = join(__dir, '..', 'shelves', 'ibnezra-cards.jsonl');

// Rebuild chunks identically
let text = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const CHUNK = 12000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 3000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}

const FAILED_CHUNKS = [79, 82, 102, 103]; // 0-indexed: chunks 80, 83, 103, 104

const author = 'Abraham Ibn Ezra';
const work = 'Introductions to Astrology (Beginning of Wisdom & Judgments of the Zodiacal Signs)';
const src = 'Shlomo Sela, Brill 2017';
const tag = 'ibnezra';
const type = 'Chapter';
const urlVal = 'https://archive.org/details/abraham-ibn-ezras-introductions-to-astrology';
const slugWork = 'wisdom';

// Load existing cards
const existingCards = readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
console.log(`Loaded ${existingCards.length} existing cards`);

// Check which failed chunks already have cards
const covered = new Set(existingCards.map(c => c.chunk_idx).filter(x => x !== undefined));
const needPlaceholders = FAILED_CHUNKS.filter(idx => !covered.has(idx));
console.log(`Need placeholders for chunk indices: ${needPlaceholders.map(i => i+1).join(', ')}`);

// Create placeholder cards
const placeholders = needPlaceholders.map(idx => {
  const chunk = chunks[idx];
  const fingerprint = chunk.slice(0, 80);
  const num = idx + 1;
  
  // Detect if it's an index/glossary or prose content
  const isIndex = /[§]|\d{2,}\s+\d{2,}/.test(chunk.slice(0, 500));
  const isGlossary = /[א-ת]\s+[a-z].*\d{2,}/.test(chunk.slice(0, 500));
  const chunkType = (isIndex || isGlossary) ? 'index/glossary back-matter' : 'prose content';
  
  return {
    id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
    author, tradition_tag: tag, work,
    source_edition: src, language: 'en', license: 'public-domain',
    section_ref: `${type} ${num}`,
    title: `[Chunk ${num} — Translation Pending]`,
    text: chunk.slice(0, 500).replace(/\s+/g, ' ').trim(),
    translation: `[PLACEHOLDER — This section (chunk ${num}, ${chunkType}) failed to translate automatically due to JSON output truncation. The source text is preserved in the 'text' field for manual translation or re-processing.]`,
    topics: ['placeholder', 'needs-review'],
    condition_keys: [],
    chunk_idx: idx,
    chunk_ref: fingerprint,
    source_url: urlVal,
    retrieved_at: '2026-06-28',
    _status: 'placeholder',
  };
});

console.log(`Created ${placeholders.length} placeholder cards`);

// Merge and sort by chunk_idx
const allCards = [...existingCards, ...placeholders];
const sorted = allCards.sort((a, b) => {
  const ai = typeof a.chunk_idx === 'number' ? a.chunk_idx : 99999;
  const bi = typeof b.chunk_idx === 'number' ? b.chunk_idx : 99999;
  return ai - bi;
});

writeFileSync(cardsPath, sorted.map(c => JSON.stringify(c)).join('\n') + '\n');
console.log(`✅ Wrote ${sorted.length} cards (including ${placeholders.length} placeholders) to ${cardsPath}`);

// Write English text — placeholders show as [PLACEHOLDER] in the text
const englishPath = cardsPath.replace('-cards.jsonl', '-english.txt');
writeFileSync(englishPath, sorted.map(c => `[${c.title}]\n${c.translation}`).join('\n\n'));
console.log(`✅ English text written to ${englishPath}`);

// Summary
const placeholderCount = sorted.filter(c => c._status === 'placeholder').length;
const translatedCount = sorted.filter(c => c._status === 'gemini_cleaned').length;
console.log(`\n📊 Summary:`);
console.log(`   Translated: ${translatedCount} cards`);
console.log(`   Placeholders: ${placeholderCount} cards`);
console.log(`   Total: ${sorted.length} cards`);
