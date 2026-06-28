// Aevum Library — Audit & Recover missing Ibn Ezra chunks
//
// 1. Re-chunks the source text identically to translate-ezra.mjs
// 2. For each chunk, checks whether at least one card's text starts with the chunk's first 100 chars
// 3. Reports which chunks have cards and which are missing
// 4. Retranslates missing chunks and appends them in the correct order
// 5. Re-sorts and rewrites the full JSONL

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelf  = join(__dir, '..', 'shelves', 'ibnezra-wisdom.txt');
const cardsPath = join(__dir, '..', 'shelves', 'ibnezra-cards.jsonl');

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Step 1: Re-chunk the source text (EXACT same logic as translate-ezra.mjs)
console.log('--- Step 1: Rebuilding source chunks ---');
let text = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const CHUNK = 12000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 3000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}
console.log(`Source text divided into ${chunks.length} chunks.`);

// Step 2: Load existing cards
console.log('\n--- Step 2: Loading existing cards ---');
const existingCards = readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
console.log(`Loaded ${existingCards.length} existing cards.`);

// Step 3: Alignment audit — for each chunk, find its cards
console.log('\n--- Step 3: Alignment Audit ---');
const chunkToCards = chunks.map((chunk, i) => {
  const prefix = chunk.slice(0, 100);
  const matched = existingCards.filter(card => card.text && card.text.slice(0, 100) === prefix);
  return { chunkIdx: i, chunkLen: chunk.length, cardCount: matched.length, cards: matched };
});

const missing = chunkToCards.filter(c => c.cardCount === 0);
const covered = chunkToCards.filter(c => c.cardCount > 0);

console.log(`Coverage: ${covered.length}/${chunks.length} chunks have cards.`);
if (missing.length === 0) {
  console.log('✅ All chunks are covered — no misalignment detected.');
} else {
  console.log(`❌ Missing cards for ${missing.length} chunk(s):`);
  for (const m of missing) {
    console.log(`  Chunk ${m.chunkIdx + 1} (${m.chunkLen} chars)`);
  }
}

// Step 4: Check for duplicates
console.log('\n--- Step 4: Duplicate Detection ---');
const idCounts = {};
for (const card of existingCards) {
  if (card.id) idCounts[card.id] = (idCounts[card.id] || 0) + 1;
}
const dups = Object.entries(idCounts).filter(([, n]) => n > 1);
if (dups.length === 0) {
  console.log('✅ No duplicate card IDs found.');
} else {
  console.log(`⚠️  Found ${dups.length} duplicate card IDs:`);
  for (const [id, count] of dups) console.log(`  ${id} appears ${count} times`);
}

if (missing.length === 0) {
  console.log('\nNothing to recover. All chunks are accounted for.');
  process.exit(0);
}

// Step 5: Translate missing chunks
console.log(`\n--- Step 5: Recovering ${missing.length} missing chunks ---`);

const author = 'Abraham Ibn Ezra';
const work = 'Introductions to Astrology (Beginning of Wisdom & Judgments of the Zodiacal Signs)';
const src = 'Shlomo Sela, Brill 2017';
const tag = 'ibnezra';
const type = 'Chapter';
const urlVal = 'https://archive.org/details/abraham-ibn-ezras-introductions-to-astrology';

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER', description: 'Chapter or section number if present' },
  title: { type: 'STRING', description: 'Short descriptive title in English (<=8 words)' },
  text: { type: 'STRING', description: 'The cleaned, original HEBREW text of the section. Do NOT include English characters here.' },
  translation: { type: 'STRING', description: 'Your new English translation of the Hebrew text (no Hebrew characters).' },
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
- text: The cleaned, original HEBREW text of the section (no English characters).
- translation: Your new English translation of the Hebrew text (no Hebrew characters).
- topics: 1-4 lowercase free tags in English.
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.`;

async function translateChunk(chunk, label, maxAttempts = 3) {
  for (let attempt = maxAttempts; attempt > 0; attempt--) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: chunk }] }],
          systemInstruction: { parts: [{ text: sys }] },
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return JSON.parse(j.candidates[0].content.parts[0].text);
    } catch (e) {
      console.error(`  [Chunk ${label}] Error: ${e.message} (attempts left: ${attempt - 1})`);
      if (attempt > 1) await new Promise(r => setTimeout(r, 2500));
    }
  }
  // Split in half and retry each half
  console.warn(`  [Chunk ${label}] Failed 3 times. Splitting and retrying...`);
  const mid = chunk.lastIndexOf('\n\n', Math.floor(chunk.length / 2)) || Math.floor(chunk.length / 2);
  const [p1, p2] = [chunk.slice(0, mid), chunk.slice(mid)];
  return [...(await translateChunk(p1, `${label}a`)), ...(await translateChunk(p2, `${label}b`))];
}

const recoveredCards = [];
for (const m of missing) {
  console.log(`Translating chunk ${m.chunkIdx + 1}/${chunks.length} (${m.chunkLen} chars)...`);
  const newCards = await translateChunk(chunks[m.chunkIdx], m.chunkIdx + 1);
  console.log(`  ✅ Chunk ${m.chunkIdx + 1}: generated ${newCards.length} cards.`);
  recoveredCards.push(...newCards);
}

// Step 6: Merge and re-sort all cards by chunk order
console.log('\n--- Step 6: Merging and re-sorting all cards ---');
const allCards = [...existingCards, ...recoveredCards];

// Assign chunk index to each card using the first 100 chars of its text field
const sorted = allCards.map(card => {
  const prefix = (card.text || '').slice(0, 100);
  const idx = chunks.findIndex(ch => ch.slice(0, 100) === prefix);
  return { idx: idx !== -1 ? idx : 99999, card };
}).sort((a, b) => a.idx - b.idx);

const slugWork = 'wisdom';
const finalCards = sorted.map(({ card }, i) => {
  if (card.id && card.author) return card; // preserve existing mapped cards
  const num = card.number || (i + 1);
  return {
    id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
    author, tradition_tag: tag, work,
    source_edition: src, language: 'en', license: 'public-domain',
    section_ref: card.number ? `${type} ${card.number}` : `${type} ${num}`,
    title: card.title || null,
    text: (card.text || '').replace(/\s+/g, ' ').trim(),
    translation: card.translation ? card.translation.replace(/\s+/g, ' ').trim() : null,
    topics: card.topics || [],
    condition_keys: (card.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
    source_url: urlVal, retrieved_at: '2026-06-28', _status: 'gemini_cleaned',
  };
});

writeFileSync(cardsPath, finalCards.map(c => JSON.stringify(c)).join('\n') + '\n');
console.log(`✅ Wrote ${finalCards.length} sorted cards to ${cardsPath}`);

const englishPath = cardsPath.replace('-cards.jsonl', '-english.txt');
writeFileSync(englishPath, finalCards.map(c => `[${c.title}]\n${c.translation}`).join('\n\n'));
console.log(`✅ Wrote full English text to ${englishPath}`);

console.log('\n--- Final Coverage Verification ---');
const finalChunkMap = chunks.map((chunk, i) => {
  const prefix = chunk.slice(0, 100);
  const matched = finalCards.filter(card => card.text && card.text.slice(0, 100) === prefix);
  return { chunkIdx: i + 1, cardCount: matched.length };
});
const stillMissing = finalChunkMap.filter(c => c.cardCount === 0);
if (stillMissing.length === 0) {
  console.log(`✅ All ${chunks.length} chunks are now covered.`);
} else {
  console.log(`⚠️  Still missing coverage for chunks: ${stillMissing.map(c => c.chunkIdx).join(', ')}`);
}
