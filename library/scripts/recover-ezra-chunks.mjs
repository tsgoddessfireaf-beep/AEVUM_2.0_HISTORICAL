// Targeted recovery for Ibn Ezra failed chunks 80, 83 (split in half)
// Chunks 103, 104 are back-matter index pages — skipped intentionally

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelf = join(__dir, '..', 'shelves', 'ibnezra-wisdom.txt');
const cardsPath = join(__dir, '..', 'shelves', 'ibnezra-cards.jsonl');

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

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
console.log(`Total chunks: ${chunks.length}`);

// Chunks 103 and 104 (indices 102, 103) are pure index/glossary back-matter — skip them
const SKIP_CHUNKS = new Set([102, 103]); // 0-indexed = chunks 103, 104
const RECOVER_CHUNKS = [79, 82]; // 0-indexed = chunks 80, 83

const author = 'Abraham Ibn Ezra';
const work = 'Introductions to Astrology (Beginning of Wisdom & Judgments of the Zodiacal Signs)';
const src = 'Shlomo Sela, Brill 2017';
const tag = 'ibnezra';
const type = 'Chapter';
const urlVal = 'https://archive.org/details/abraham-ibn-ezras-introductions-to-astrology';
const slugWork = 'wisdom';

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER' },
  title: { type: 'STRING' },
  text: { type: 'STRING' },
  translation: { type: 'STRING' },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['title', 'text', 'translation'] } };

const apiUrl = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = `You are an expert translator and astrologer. You are translating a historical horary astrology text (Abraham Ibn Ezra's Introductions to Astrology, 12th Century Hebrew) from a parallel Hebrew-English OCR scan.
The input text contains Hebrew text mixed with its modern English translation.
Your task is:
1. Extract the original HEBREW text of the section.
2. Translate the HEBREW text into clear, accurate, and fluent English. Do NOT copy the modern English translation from the input; you must translate the Hebrew text yourself to produce a new, copyright-free translation.
For the input text, output an array of cards:
- number: the chapter or section number (if present).
- title: a short (<=8 word) descriptive title in English.
- text: The cleaned, original HEBREW text (no English characters). Keep it SHORT — max 500 characters.
- translation: Your new English translation (no Hebrew characters). Keep it CONCISE — max 800 characters per card.
- topics: 1-4 lowercase free tags in English.
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.
IMPORTANT: If the input contains only an index, glossary, or reference table (no prose content), output an empty array [].`;

async function translateHalf(chunk, label) {
  for (let attempt = 3; attempt > 0; attempt--) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: chunk }] }],
          systemInstruction: { parts: [{ text: sys }] },
          generationConfig: { 
            responseMimeType: 'application/json', responseSchema: schema, 
            temperature: 0.2, 
            maxOutputTokens: 4096, // Halved to prevent truncation
            thinkingConfig: { thinkingBudget: 0 } 
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return JSON.parse(j.candidates[0].content.parts[0].text);
    } catch (e) {
      console.error(`  [${label}] Error: ${e.message} (attempts left: ${attempt - 1})`);
      if (attempt > 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function recoverChunk(chunkIdx) {
  const chunk = chunks[chunkIdx];
  const fingerprint = chunk.slice(0, 80);
  
  // Split in half at paragraph boundary
  const mid = chunk.lastIndexOf('\n\n', Math.floor(chunk.length / 2));
  const splitAt = mid > 1000 ? mid : Math.floor(chunk.length / 2);
  const part1 = chunk.slice(0, splitAt);
  const part2 = chunk.slice(splitAt);
  
  console.log(`Chunk ${chunkIdx + 1}: splitting at ${splitAt}/${chunk.length} chars`);
  console.log(`  Part A: ${part1.length} chars`);
  const cards1 = await translateHalf(part1, `${chunkIdx + 1}A`);
  console.log(`  Part A: ${cards1.length} cards`);
  
  console.log(`  Part B: ${part2.length} chars`);
  const cards2 = await translateHalf(part2, `${chunkIdx + 1}B`);
  console.log(`  Part B: ${cards2.length} cards`);
  
  const combined = [...cards1, ...cards2];
  // Tag with chunk metadata
  for (const card of combined) {
    card.chunk_idx = chunkIdx;
    card.chunk_ref = fingerprint;
  }
  return combined;
}

// Load existing cards
const existingCards = readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
console.log(`Loaded ${existingCards.length} existing cards`);

// Recover
const newCards = [];
for (const idx of RECOVER_CHUNKS) {
  const cards = await recoverChunk(idx);
  newCards.push(...cards);
  console.log(`✅ Chunk ${idx + 1}: recovered ${cards.length} cards`);
}

// Mark skipped chunks as intentionally empty (back-matter)
for (const idx of SKIP_CHUNKS) {
  console.log(`⏭  Chunk ${idx + 1}: skipped (index/glossary back-matter)`);
}

// Merge all: existing + recovered, sort by chunk_idx
const allCards = [...existingCards, ...newCards];
const sorted = allCards.sort((a, b) => {
  const ai = typeof a.chunk_idx === 'number' ? a.chunk_idx : 99999;
  const bi = typeof b.chunk_idx === 'number' ? b.chunk_idx : 99999;
  return ai - bi;
});

const finalCards = sorted.map((a, i) => {
  if (a.id && a.author && a.chunk_ref) return a; // already mapped
  const num = a.number || (i + 1);
  return {
    id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
    author, tradition_tag: tag, work,
    source_edition: src, language: 'en', license: 'public-domain',
    section_ref: a.number ? `${type} ${a.number}` : `${type} ${num}`,
    title: a.title || null,
    text: (a.text || '').replace(/\s+/g, ' ').trim(),
    translation: a.translation ? a.translation.replace(/\s+/g, ' ').trim() : null,
    topics: a.topics || [],
    condition_keys: (a.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
    chunk_idx: a.chunk_idx,
    chunk_ref: a.chunk_ref,
    source_url: urlVal, retrieved_at: '2026-06-28', _status: 'gemini_cleaned',
  };
});

writeFileSync(cardsPath, finalCards.map(c => JSON.stringify(c)).join('\n') + '\n');
console.log(`\n✅ Final: ${finalCards.length} cards written to ${cardsPath}`);

const englishPath = cardsPath.replace('-cards.jsonl', '-english.txt');
writeFileSync(englishPath, finalCards.map(c => `[${c.title}]\n${c.translation}`).join('\n\n'));
console.log(`✅ English text written to ${englishPath}`);
