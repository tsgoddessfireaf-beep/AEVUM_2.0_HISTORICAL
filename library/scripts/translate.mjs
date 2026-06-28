// Aevum Library — Gemini-powered cleanup (Vertex AI)
//
// Reads a messy OCR "shelf" file, sends it to Gemini in chunks, and gets back
// clean, VERBATIM-corrected, segmented, condition-tagged cards. Gemini fixes scan
// errors (tlie->the, v/ith->with) and strips page headers/footnote artifacts, but
// is instructed NOT to paraphrase — the wording stays the author's.
//
// Auth: set GAUTH to a gcloud access token. Spends the expiring GCP credit.
// Usage: GAUTH=$(gcloud auth print-access-token) node gemini-clean.mjs <shelf.txt> <out.jsonl> [--max N] [--from CHARS]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [shelf, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+(.+)/).slice(0, 2)).map(([k, v]) => [k, (v || '').replace(/^"|"$/g, '')]));

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Normalize OCR line-wrapping.
let text = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const from = parseInt(opt.from || '0', 10);
text = text.slice(from);

// Chunk on paragraph boundaries, ~8k chars each to prevent output token truncation
const CHUNK = 8000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 2000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}
const maxChunks = parseInt(opt.max || String(chunks.length), 10);

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER', description: "Original numbering if present in text, otherwise omit" }, 
  title: { type: 'STRING' },
  translation: { type: 'STRING', description: "English translation of the entire input text" },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['title', 'translation'] } };

const author = opt.author || 'Bonatti';
const work = opt.work || 'Anima Astrologiae (146 Considerations)';
const src = opt.source || 'Henry Coley tr., London 1676 (Redway 1886 reprint)';
const tag = opt.tag || 'bonatti';
const type = opt.type || 'Consideration';
const urlVal = opt.url || 'https://archive.org/details/astrologersguide00lill';

const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = opt.prompt || `You are translating and restoring a historical horary astrology text (${author}'s ${work}, ${src}) from noisy Latin OCR.
For the input text, output exactly one card:
- number: the section number (if explicitly numbered).
- title: a short (<=8 word) descriptive title in English.
- translation: The FULL English translation of the entire input text. Translate accurately, preserving the astrological meaning.
- topics: 1-4 lowercase free tags in English.
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.
Do NOT output the original Latin text in your response. Only output the English translation and metadata.`;

let existingCards = [];
if (existsSync(out)) {
  existingCards = readFileSync(out, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.error(`Loaded ${existingCards.length} existing cards from ${out}`);
}
let completedChunks = 0;
const totalChunks = Math.min(chunks.length, maxChunks);

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

// Write initial 0% progress
writeProgress();

const cards = [...existingCards];
const CONCURRENCY = 8;
for (let i = 0; i < Math.min(chunks.length, maxChunks); i += CONCURRENCY) {
  const batch = chunks.slice(i, i + CONCURRENCY);
  const promises = batch.map(async (chunk, idx) => {
    const c = i + idx;
    const body = {
      system_instruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: chunk }] }],
      generationConfig: { 
        responseMimeType: 'application/json', 
        responseSchema: schema, 
        temperature: 0, 
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 }
      },
    };
    
    let attempts = 3;
    while (attempts > 0) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 mins
      try {
        const res = await fetch(url, { 
          method: 'POST', 
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, 
          body: JSON.stringify(body), 
          signal: controller.signal 
        });
        
        if (!res.ok) {
          console.error(`chunk ${c} HTTP ${res.status} (attempts left: ${attempts - 1}): ${(await res.text()).slice(0, 150)}`);
          attempts--;
          if (attempts > 0) await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
          continue;
        }
        
        const j = await res.json();
        const arr = JSON.parse(j.candidates[0].content.parts[0].text);
        
        // Inject the original Latin chunk into each card
        for (const card of arr) {
          card.text = chunk;
        }
        
        console.error(`chunk ${c + 1}/${Math.min(chunks.length, maxChunks)}: +${arr.length} (Success)`);
        
        completedChunks++;
        writeProgress();
        
        clearTimeout(timeout);
        return arr;
      } catch (e) {
        console.error(`chunk ${c} error: ${e.message} (attempts left: ${attempts - 1})`);
        attempts--;
        clearTimeout(timeout);
        if (attempts > 0) await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.error(`chunk ${c} FAILED permanently after 3 attempts.`);
    return [];
  });
  const results = await Promise.all(promises);
  for (const arr of results) {
    for (const a of arr) cards.push(a);
  }
}

// Dedupe and build final records.
const seen = new Map();
let autoInc = 1;
for (const a of cards) {
  if (a.text?.length > 30) {
    const key = a.number || (a.title + a.text.substring(0,20));
    if (!seen.has(key)) {
      a._num = a.number || autoInc++;
      seen.set(key, a);
    }
  }
}
const slugWork = work.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
const recs = [...seen.values()].sort((x, y) => x._num - y._num).map(a => ({
  id: `${tag}-${slugWork}-${type[0].toLowerCase()}${String(a._num).padStart(4, '0')}`,
  author, tradition_tag: tag, work,
  source_edition: src, language: 'en', license: 'public-domain',
  section_ref: a.number ? `${type} ${a.number}` : `${type} ${a._num}`, 
  title: a.title || null, text: a.text.replace(/\s+/g, ' ').trim(),
  translation: a.translation ? a.translation.replace(/\s+/g, ' ').trim() : null, topics: a.topics || [], condition_keys: (a.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
  source_url: urlVal, retrieved_at: '2026-06-27', _status: 'gemini_cleaned',
}));
writeFileSync(out, recs.map(r => JSON.stringify(r)).join('\n') + '\n');
const englishFile = out.replace('-cards.jsonl', '-english.txt');
const latinCleanedFile = out.replace('-cards.jsonl', '-latin-cleaned.txt');
writeFileSync(englishFile, recs.map(r => r.translation).filter(Boolean).join('\n\n') + '\n');
writeFileSync(latinCleanedFile, recs.map(r => r.text).filter(Boolean).join('\n\n') + '\n');

writeProgress('DONE');

console.error(`\nDONE: ${recs.length} cards -> ${out}`);
console.error(`      Full English translation -> ${englishFile}`);
console.error(`      Full Cleaned Latin     -> ${latinCleanedFile}`);
