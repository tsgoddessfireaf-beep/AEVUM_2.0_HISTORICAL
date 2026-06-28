// Aevum Library — Gemini-powered extraction for Abraham Ibn Ezra (Vertex AI)
//
// Reads the parallel Hebrew-English OCR text, extracts only the English translation,
// cleans it up, and structures it into JSON cards.
//
// Auth: set GAUTH to a gcloud access token.
// Usage: GAUTH=$(gcloud auth print-access-token) node library/scripts/translate-ezra.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelf = join(__dir, '..', 'shelves', 'ibnezra-wisdom.txt');
const out = join(__dir, '..', 'shelves', 'ibnezra-cards.jsonl');

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Basic cleanup of line wraps
let text = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

// Chunk into ~12k characters
const CHUNK = 12000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 3000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER', description: "Chapter or section number if present" }, 
  title: { type: 'STRING', description: "Short descriptive title in English (<=8 words)" },
  text: { type: 'STRING', description: "The cleaned, original HEBREW text of the section. Do NOT include English characters here." },
  translation: { type: 'STRING', description: "The cleaned English translation of the section. Do NOT include Hebrew characters here." },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['title', 'text', 'translation'] } };

const author = 'Abraham Ibn Ezra';
const work = 'Introductions to Astrology (Beginning of Wisdom & Judgments of the Zodiacal Signs)';
const src = 'Shlomo Sela, Brill 2017';
const tag = 'ibnezra';
const type = 'Chapter';
const urlVal = 'https://archive.org/details/abraham-ibn-ezras-introductions-to-astrology';

const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = `You are an expert translator and astrologer. You are translating and restoring a historical horary astrology text (Abraham Ibn Ezra's Introductions to Astrology, 12th Century Hebrew) from a parallel Hebrew-English OCR scan.
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

let existingCards = [];
if (existsSync(out)) {
  existingCards = readFileSync(out, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.error(`Loaded ${existingCards.length} existing cards from ${out}`);
}
let completedChunks = 0;
const totalChunks = chunks.length;

function writeProgress(status = 'PROCESSING') {
  const percent = totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0;
  const progressData = {
    tag,
    work,
    percent: Math.min(100, percent),
    completed: completedChunks,
    total: totalChunks,
    status
  };
  try {
    writeFileSync(`library/progress-${tag}.js`, `window.translationProgress_${tag} = ${JSON.stringify(progressData)};`);
  } catch (e) {
    console.error(`Failed to write progress file: ${e.message}`);
  }
}

writeProgress();

const cards = [...existingCards];
const CONCURRENCY = 6;

// Build a set of already-processed chunk fingerprints (first 80 chars of source chunk)
const processedFingerprints = new Set(existingCards.map(c => c.chunk_ref || '').filter(Boolean));

async function processAll() {
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (chunk, idx) => {
      const c = i + idx;
      const fingerprint = chunk.slice(0, 80);
      
      // Skip if already processed in previous runs
      if (processedFingerprints.has(fingerprint)) {
        completedChunks++;
        return;
      }

      const body = {
        contents: [
          { role: 'user', parts: [{ text: chunk }] }
        ],
        systemInstruction: { parts: [{ text: sys }] },
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          const j = await res.json();
          const arr = JSON.parse(j.candidates[0].content.parts[0].text);
          // Tag each card with its source chunk fingerprint and index for reliable alignment
          for (const card of arr) {
            card.chunk_idx = c;
            card.chunk_ref = fingerprint;
          }
          cards.push(...arr);
          processedFingerprints.add(fingerprint);
          completedChunks++;
          console.log(`Chunk ${c+1}/${totalChunks} success: generated ${arr.length} cards.`);
          writeProgress();
          break;
        } catch (e) {
          attempts--;
          console.error(`Chunk ${c+1} error: ${e.message} (attempts left: ${attempts})`);
          if (attempts === 0) {
            console.error(`Chunk ${c+1} FAILED permanently.`);
            completedChunks++; 
          } else {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    });

    await Promise.all(promises);
    
    // Intermediate save
    writeFileSync(out, cards.map(c => JSON.stringify(c)).join('\n') + '\n');
  }

  console.log(`DONE: ${cards.length} cards -> ${out}`);
  
  // Post-process mapping: sort by chunk_idx first, then sequential position
  const slugWork = 'wisdom';
  const sorted = [...cards].sort((a, b) => {
    const ai = typeof a.chunk_idx === 'number' ? a.chunk_idx : 9999;
    const bi = typeof b.chunk_idx === 'number' ? b.chunk_idx : 9999;
    return ai - bi;
  });
  const recs = sorted.map((a, i) => {
    if (a.id && a.author && a.chunk_ref) return a; // already mapped from a previous run
    const num = a.number || (i + 1);
    return {
      id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
      author, tradition_tag: tag, work,
      source_edition: src, language: 'en', license: 'public-domain',
      section_ref: a.number ? `${type} ${a.number}` : `${type} ${num}`,
      title: a.title || null,
      text: a.text ? a.text.replace(/\s+/g, ' ').trim() : null,
      translation: a.translation ? a.translation.replace(/\s+/g, ' ').trim() : null,
      topics: a.topics || [],
      condition_keys: (a.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
      chunk_idx: a.chunk_idx,
      chunk_ref: a.chunk_ref,
      source_url: urlVal, retrieved_at: '2026-06-28', _status: 'gemini_cleaned',
    };
  });

  writeFileSync(out, recs.map(c => JSON.stringify(c)).join('\n') + '\n');
  console.log(`Successfully wrote ${recs.length} mapped cards to ${out}`);

  // Write out English and Latin-cleaned text files
  const englishPath = out.replace('-cards.jsonl', '-english.txt');
  const englishText = recs.map(c => `[${c.title}]\n${c.translation}`).join('\n\n');
  writeFileSync(englishPath, englishText);
  console.log(`Wrote full English text to ${englishPath}`);

  writeProgress('COMPLETED');
}

processAll().catch(console.error);
