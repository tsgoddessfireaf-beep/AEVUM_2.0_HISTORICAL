// Aevum Library — embed + load to Firestore Vector Search
//
// For each card: get a 768-dim embedding (Vertex text-embedding-005), then write
// the card to Firestore collection `library_cards` with the embedding stored as a
// native Firestore Vector value. Auth: GAUTH = gcloud access token (used for both
// Vertex and Firestore). Spends the expiring GCP credit.
//
// Usage: GAUTH=$(gcloud auth print-access-token) node embed-load.mjs <cards.jsonl> [maxN]
import { readFileSync } from 'node:fs';

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1';
const DB = '(default)'; // Aevum 2.0 Historical Firestore (per .firebaserc)
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const cards = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const max = parseInt(process.argv[3] || String(cards.length), 10);
const EMB = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/text-embedding-005:predict`;

async function embed(text) {
  const r = await fetch(EMB, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ content: text }] }) });
  if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).predictions[0].embeddings.values;
}
const fval = v => v == null ? { nullValue: null }
  : Array.isArray(v) ? { arrayValue: { values: v.map(fval) } }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : { stringValue: String(v) };
const vec = a => ({ mapValue: { fields: { __type__: { stringValue: '__vector__' }, value: { arrayValue: { values: a.map(x => ({ doubleValue: x })) } } } } });

let n = 0;
for (const c of cards.slice(0, max)) {
  const textToEmbed = c.translation || c.text || c.title || "[empty]";
  const e = await embed(textToEmbed);
  const fields = {};
  for (const [k, v] of Object.entries(c)) { if (k === '_status') continue; fields[k] = fval(v); }
  fields.embedding = vec(e);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/library_cards/${c.id}`;
  const r = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) { console.error(`write fail ${c.id}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
  if (++n % 20 === 0) console.error(`written ${n}`);
}
console.error(`DONE: ${n} docs -> library_cards`);
