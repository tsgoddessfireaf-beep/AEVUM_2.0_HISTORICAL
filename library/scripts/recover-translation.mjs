import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const [file, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+(.+)/).slice(0, 2)).map(([k, v]) => [k, (v || '').replace(/^"|"$/g, '')]));

if (!file || !out) {
  console.error('Usage: node recover-translation.mjs <input_txt> <output_jsonl> --tag <tag> --author <author> --work <work>');
  process.exit(1);
}

const tag = opt.tag || 'naibod';
const author = opt.author || 'Valentin Naibod';
const work = opt.work || 'Enarratio elementorum';
const src = opt.source || 'Google Books 1573';

const PROJECT = 'flutter-ai-playground-f880c';
const LOC = 'us-central1';
const MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH || '';

if (!TOKEN) {
  console.error('Error: GAUTH environment variable not set.');
  process.exit(1);
}

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Load original text and chunk it
let text = readFileSync(file, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const CHUNK = 8000;
const chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end);
  if (br > i + 2000) end = br;
  chunks.push(text.slice(i, end));
  i = end;
}

console.log(`Original book chunked into ${chunks.length} chunks.`);

// Load existing cards
let cards = [];
if (existsSync(out)) {
  cards = readFileSync(out, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.log(`Loaded ${cards.length} existing cards from ${out}`);
}

// Map existing cards to chunk indices
const completedIndices = new Set();
for (const card of cards) {
  const idx = chunks.indexOf(card.text);
  if (idx !== -1) {
    completedIndices.add(idx);
  } else {
    // Try fuzzy matching (in case of whitespace changes)
    const clean = (t) => t.replace(/\s+/g, ' ').trim();
    const cardClean = clean(card.text);
    const fIdx = chunks.findIndex(c => clean(c) === cardClean);
    if (fIdx !== -1) {
      completedIndices.add(fIdx);
    }
  }
}

const missingIndices = [];
for (let i = 0; i < chunks.length; i++) {
  if (!completedIndices.has(i)) {
    missingIndices.push(i);
  }
}

console.log(`Missing ${missingIndices.length} chunks:`, missingIndices);

if (missingIndices.length === 0) {
  console.log('All chunks are already translated!');
  process.exit(0);
}

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER' }, 
  title: { type: 'STRING' },
  translation: { type: 'STRING' },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['title', 'translation'] } };

const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = `You are translating and restoring a historical horary astrology text (${author}'s ${work}, ${src}) from noisy Latin OCR.
For the input text, output exactly one card:
- number: the section number (if explicitly numbered).
- title: a short (<=8 word) descriptive title in English.
- translation: The FULL English translation of the entire input text. Translate accurately, preserving the astrological meaning.
- topics: 1-4 lowercase free tags in English.
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.
Do NOT output the original Latin text in your response. Only output the English translation and metadata.`;

async function translateChunkDirect(chunk, label) {
  const body = {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: chunk }] }],
    generationConfig: { 
      responseMimeType: 'application/json', 
      responseSchema: schema, 
      temperature: 0.2, 
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 }
    },
  };

  let attempts = 3;
  while (attempts > 0) {
    try {
      const res = await fetch(url, { 
        method: 'POST', 
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        console.error(`  [${label}] HTTP ${res.status} (attempts left: ${attempts - 1})`);
        attempts--;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const j = await res.json();
      const arr = JSON.parse(j.candidates[0].content.parts[0].text);
      for (const card of arr) {
        card.text = chunk;
      }
      return arr;
    } catch (e) {
      console.error(`  [${label}] Error: ${e.message} (attempts left: ${attempts - 1})`);
      attempts--;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function translateChunkWithSplit(chunk, label) {
  console.log(`Translating chunk ${label} (${chunk.length} chars)...`);
  let cardsResult = await translateChunkDirect(chunk, label);
  
  if (cardsResult) {
    console.log(`  [${label}] Success: generated ${cardsResult.length} cards.`);
    return cardsResult;
  }
  
  // If it failed permanently, split it in half and retry each half
  console.error(`  [${label}] FAILED permanently. Splitting in half and retrying...`);
  const mid = Math.floor(chunk.length / 2);
  let splitIdx = chunk.lastIndexOf('\n\n', mid);
  if (splitIdx === -1 || splitIdx < 500) splitIdx = chunk.lastIndexOf('\n', mid);
  if (splitIdx === -1 || splitIdx < 500) splitIdx = mid;
  
  const part1 = chunk.slice(0, splitIdx);
  const part2 = chunk.slice(splitIdx);
  
  console.log(`  [${label}] Part A: ${part1.length} chars, Part B: ${part2.length} chars`);
  
  const res1 = await translateChunkWithSplit(part1, `${label}A`);
  const res2 = await translateChunkWithSplit(part2, `${label}B`);
  
  return [...res1, ...res2];
}

// Process missing chunks sequentially to avoid rate limits
const recoveredCards = [];
for (const idx of missingIndices) {
  const chunk = chunks[idx];
  const chunkCards = await translateChunkWithSplit(chunk, `${idx}`);
  for (const card of chunkCards) {
    recoveredCards.push({ idx, card });
  }
}

// Add recovered cards to existing ones
for (const item of recoveredCards) {
  cards.push(item.card);
}

// Sort all cards by their original chunk index so the book is in order!
const cardWithIndex = cards.map(card => {
  const idx = chunks.indexOf(card.text);
  return { idx: idx !== -1 ? idx : 9999, card };
});
cardWithIndex.sort((a, b) => a.idx - b.idx);
const sortedCards = cardWithIndex.map(x => x.card);

// Map and fill in missing metadata
const slugWork = work.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
const type = opt.type || 'Chapter';
const urlVal = opt.url || '';

const recs = sortedCards.map((a, i) => {
  if (a.id && a.author) {
    // Keep existing metadata but normalize text/translation spacing
    return {
      ...a,
      text: a.text.replace(/\s+/g, ' ').trim(),
      translation: a.translation ? a.translation.replace(/\s+/g, ' ').trim() : null
    };
  }
  
  const num = a.number || (i + 1);
  return {
    id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
    author, 
    tradition_tag: tag, 
    work,
    source_edition: src, 
    language: 'en', 
    license: 'public-domain',
    section_ref: a.number ? `${type} ${a.number}` : `${type} ${num}`, 
    title: a.title || null, 
    text: a.text.replace(/\s+/g, ' ').trim(),
    translation: a.translation ? a.translation.replace(/\s+/g, ' ').trim() : null, 
    topics: a.topics || [], 
    condition_keys: (a.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
    source_url: urlVal, 
    retrieved_at: '2026-06-27', 
    _status: 'gemini_cleaned',
  };
});

// Write back sorted and mapped cards
writeFileSync(out, recs.map(c => JSON.stringify(c)).join('\n') + '\n');
console.log(`Successfully wrote ${recs.length} sorted and mapped cards to ${out}`);

// Write out English and Latin text files
const englishPath = out.replace('-cards.jsonl', '-english.txt');
const latinPath = out.replace('-cards.jsonl', '-latin-cleaned.txt');

const englishText = recs.map(c => `[${c.title}]\n${c.translation}`).join('\n\n');
const latinText = recs.map(c => c.text).join('\n\n');

writeFileSync(englishPath, englishText);
writeFileSync(latinPath, latinText);

console.log(`Wrote full English text to ${englishPath}`);
console.log(`Wrote full Latin text to ${latinPath}`);
