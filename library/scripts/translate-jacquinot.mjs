// Aevum Library — Translation pipeline for Jacquinot's L'usage de l'astrolabe (1625)
// Old French OCR → cleaned English cards
// Auth: set GAUTH to a gcloud access token.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const shelf = join(__dir, '..', 'shelves', 'jacquinot-astrolabe.txt');
const out = join(__dir, '..', 'shelves', 'jacquinot-cards.jsonl');

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Clean up OCR artifacts from old French printing
let text = readFileSync(shelf, 'utf8')
  // Fix long-s (ſ printed as f) — common in 17th century French
  .replace(/\bf([aeiouyéèêàâùûôîï])/g, 's$1')
  // Fix v→u substitution in old French
  .replace(/\bv([aeiouyéèêàâùûôîï])/gi, 'u$1')
  // Clean up hyphenation across line breaks
  .replace(/([a-zéèêàâùûôîï])-\s*\n\s*([a-zéèêàâùûôîï])/gi, '$1$2')
  // Normalize whitespace
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n')
  // Remove OCR junk characters
  .replace(/[^\x20-\x7E\u00C0-\u024F\u0300-\u036F\n¶]/g, ' ')
  .replace(/[ \t]{2,}/g, ' ');

// Chunk into ~8000 chars (smaller than Hebrew — French OCR is denser)
const CHUNK = 8000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 2000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}

const author = 'Dominique Jacquinot';
const work = "L'usage de l'astrolabe (L'vsage de l'vn et l'avtre astrolabe)";
const src = 'Paris, 1625 (ed. Jean Moreau)';
const tag = 'jacquinot';
const type = 'Chapter';
const urlVal = 'https://archive.org/details/lvsagedelvnetlav00jacq';

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER', description: 'Chapter or section number if present' },
  title: { type: 'STRING', description: 'Short descriptive title in English (<=8 words)' },
  translation: { type: 'STRING', description: 'Full English translation of the French text' },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['title', 'translation'] } };

const apiUrl = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = `You are an expert translator specializing in 16th-17th century French scientific and astrological texts.
You are translating Dominique Jacquinot's "L'usage de l'astrolabe" (1625 edition, edited by Jean Moreau) from Old French into clear, fluent modern English.
The input text is OCR'd from an early printed book — expect archaic spelling (u/v swaps, long-s), abbreviations, and OCR noise.

Your task:
1. Interpret and correct the OCR'd Old French text.
2. Produce a clear, accurate English translation preserving the astrological and astronomical meaning.
3. If a section is purely decorative (title pages, privilege notices, publisher marks) with no substantive content, output an empty array [].

For each section in the input, output an array of cards:
- number: the chapter or section number (if present).
- title: a short (<=8 word) descriptive title in English.
- translation: Full, accurate English translation of the French content.
- topics: 1-4 lowercase tags in English (e.g. "astrolabe", "house calculation", "planetary hours").
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.`;

let existingCards = [];
if (existsSync(out)) {
  existingCards = readFileSync(out, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.error(`Loaded ${existingCards.length} existing cards from ${out}`);
}

const processedFingerprints = new Set(existingCards.map(c => c.chunk_ref || '').filter(Boolean));
let completedChunks = existingCards.length > 0 
  ? new Set(existingCards.map(c => c.chunk_idx).filter(x => x !== undefined)).size 
  : 0;
const totalChunks = chunks.length;

console.error(`Total chunks: ${totalChunks}, already completed: ${completedChunks}`);

function writeProgress(status = 'PROCESSING') {
  const percent = totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0;
  try {
    writeFileSync(`library/progress-${tag}.js`,
      `window.translationProgress_${tag} = ${JSON.stringify({ tag, work, percent: Math.min(100, percent), completed: completedChunks, total: totalChunks, status })};`);
  } catch (e) { /* ignore */ }
}
writeProgress();

const cards = [...existingCards];
const CONCURRENCY = 5;

async function processAll() {
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (chunk, idx) => {
      const c = i + idx;
      const fingerprint = chunk.slice(0, 80);

      if (processedFingerprints.has(fingerprint)) {
        completedChunks++;
        return;
      }

      const body = {
        contents: [{ role: 'user', parts: [{ text: chunk }] }],
        systemInstruction: { parts: [{ text: sys }] },
        generationConfig: {
          responseMimeType: 'application/json', responseSchema: schema,
          temperature: 0.2, maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 }
        },
      };

      let attempts = 3;
      while (attempts > 0) {
        try {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
            body: JSON.stringify(body)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          const arr = JSON.parse(j.candidates[0].content.parts[0].text);
          for (const card of arr) {
            card.chunk_idx = c;
            card.chunk_ref = fingerprint;
          }
          cards.push(...arr);
          processedFingerprints.add(fingerprint);
          completedChunks++;
          console.log(`Chunk ${c + 1}/${totalChunks} success: ${arr.length} cards.`);
          writeProgress();
          break;
        } catch (e) {
          attempts--;
          console.error(`Chunk ${c + 1} error: ${e.message} (attempts left: ${attempts})`);
          if (attempts === 0) {
            console.error(`Chunk ${c + 1} FAILED permanently.`);
            completedChunks++;
          } else {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    });

    await Promise.all(promises);
    writeFileSync(out, cards.map(c => JSON.stringify(c)).join('\n') + '\n');
  }

  console.log(`DONE: ${cards.length} raw cards`);

  // Post-process — sort and assign stable IDs
  const slugWork = 'astrolabe';
  const sorted = [...cards].sort((a, b) => {
    const ai = typeof a.chunk_idx === 'number' ? a.chunk_idx : 99999;
    const bi = typeof b.chunk_idx === 'number' ? b.chunk_idx : 99999;
    return ai - bi;
  });

  const recs = sorted.map((a, i) => {
    if (a.id && a.author && a.chunk_ref) return a;
    const num = a.number || (i + 1);
    return {
      id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(num).padStart(4, '0')}`,
      author, tradition_tag: tag, work,
      source_edition: src, language: 'en', license: 'public-domain',
      section_ref: a.number ? `${type} ${a.number}` : `${type} ${num}`,
      title: a.title || null,
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

  const englishPath = out.replace('-cards.jsonl', '-english.txt');
  writeFileSync(englishPath, recs.map(c => `[${c.title}]\n${c.translation}`).join('\n\n'));
  console.log(`Wrote English text to ${englishPath}`);

  writeProgress('COMPLETED');
}

processAll().catch(console.error);
