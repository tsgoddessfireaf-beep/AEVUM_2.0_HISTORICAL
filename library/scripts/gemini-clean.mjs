// Aevum Library — Gemini-powered cleanup (Vertex AI)
//
// Reads a messy OCR "shelf" file, sends it to Gemini in chunks, and gets back
// clean, VERBATIM-corrected, segmented, condition-tagged cards. Gemini fixes scan
// errors (tlie->the, v/ith->with) and strips page headers/footnote artifacts, but
// is instructed NOT to paraphrase — the wording stays the author's.
//
// Auth: set GAUTH to a gcloud access token. Spends the expiring GCP credit.
// Usage: GAUTH=$(gcloud auth print-access-token) node gemini-clean.mjs <shelf.txt> <out.jsonl> [--max N] [--from CHARS]
import { readFileSync, writeFileSync } from 'node:fs';

const [shelf, out, ...rest] = process.argv.slice(2);
const flag = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const PROJECT = 'gen-lang-client-0022917921', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const CONDITION_VOCAB = ['via_combusta','voc_moon','saturn_1st','saturn_7th','retrograde','combust','cazimi',
  'reception','translation','refranation','hayz','detriment','fixed_star','malefic','benefic','prohibition',
  'collection','frustration','moon_application','moon_separation','almuten','part_of_fortune','dignity','mutual_reception'];

// Normalize OCR line-wrapping.
let text = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const from = parseInt(flag('--from', '0'), 10);
text = text.slice(from);

// Chunk on paragraph boundaries, ~22k chars each.
const CHUNK = 22000, chunks = [];
for (let i = 0; i < text.length; ) {
  let end = Math.min(i + CHUNK, text.length);
  const br = text.lastIndexOf('\n\n', end); if (br > i + 5000) end = br;
  chunks.push(text.slice(i, end)); i = end;
}
const maxChunks = parseInt(flag('--max', String(chunks.length)), 10);

const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  number: { type: 'INTEGER' }, title: { type: 'STRING' }, text: { type: 'STRING' },
  topics: { type: 'ARRAY', items: { type: 'STRING' } },
  condition_keys: { type: 'ARRAY', items: { type: 'STRING' } },
}, required: ['number', 'title', 'text'] } };

const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
const sys = `You are restoring a public-domain horary astrology text (Bonatti's 146 Considerations, Henry Coley's 1676 English translation) from noisy OCR.
For each numbered "Consideration" in the input, output one card:
- number: the consideration's number.
- title: a short (<=8 word) descriptive title you write.
- text: the FULL consideration, VERBATIM. Fix obvious OCR scan errors (e.g. "tlie"->"the", "v/ith"->"with", "wdiich"->"which") and remove page headers, running titles, page numbers, and footnote artifacts. DO NOT modernize, paraphrase, summarize, or add words. Preserve the author's exact wording, spelling of names (Zael, Bonatus), and punctuation style.
- topics: 1-4 lowercase free tags.
- condition_keys: 0-3 from EXACTLY this list (else empty): ${CONDITION_VOCAB.join(', ')}.
Only output complete considerations fully present in the input; skip fragments cut off at the edges.`;

const cards = [];
for (let c = 0; c < Math.min(chunks.length, maxChunks); c++) {
  const body = {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: chunks[c] }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 },
  };
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { console.error(`chunk ${c} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`); continue; }
  const j = await res.json();
  let arr; try { arr = JSON.parse(j.candidates[0].content.parts[0].text); } catch { console.error(`chunk ${c} parse fail`); continue; }
  for (const a of arr) cards.push(a);
  console.error(`chunk ${c + 1}/${Math.min(chunks.length, maxChunks)}: +${arr.length} (total ${cards.length})`);
}

// Dedupe by consideration number, build final records.
const seen = new Map();
for (const a of cards) if (a.number && a.text?.length > 30) seen.set(a.number, a);
const recs = [...seen.values()].sort((x, y) => x.number - y.number).map(a => ({
  id: `bonatti-anima-c${String(a.number).padStart(3, '0')}`,
  author: 'Bonatti', tradition_tag: 'bonatti', work: 'Anima Astrologiae (146 Considerations)',
  source_edition: 'Henry Coley tr., London 1676 (Redway 1886 reprint)', language: 'en', license: 'public-domain',
  section_ref: `Consideration ${a.number}`, title: a.title || null, text: a.text.replace(/\s+/g, ' ').trim(),
  translation: null, topics: a.topics || [], condition_keys: (a.condition_keys || []).filter(k => CONDITION_VOCAB.includes(k)),
  source_url: 'https://archive.org/details/astrologersguide00lill', retrieved_at: '2026-06-27', _status: 'gemini_cleaned',
}));
writeFileSync(out, recs.map(r => JSON.stringify(r)).join('\n') + '\n');
console.error(`\nDONE: ${recs.length} considerations -> ${out}`);
