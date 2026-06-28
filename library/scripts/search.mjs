// Aevum Library — semantic search (Firestore Vector Search, findNearest)
//
// Embeds a query and returns the nearest cards by meaning. This is the retrieval
// the reading flow will use. Auth: GAUTH = gcloud access token.
//
// Usage: GAUTH=$(gcloud auth print-access-token) node search.mjs "what does Bonatti say about a retrograde significator?"
const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1';
const DB = '(default)';
const TOKEN = process.env.GAUTH;
const query = process.argv.slice(2).join(' ');
if (!TOKEN || !query) { console.error('GAUTH + a query string required'); process.exit(1); }

const EMB = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/text-embedding-005:predict`;
const er = await fetch(EMB, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ instances: [{ content: query }] }) });
const qv = (await er.json()).predictions[0].embeddings.values;

const body = { structuredQuery: { from: [{ collectionId: 'library_cards' }], findNearest: {
  vectorField: { fieldPath: 'embedding' },
  queryVector: { mapValue: { fields: { __type__: { stringValue: '__vector__' }, value: { arrayValue: { values: qv.map(x => ({ doubleValue: x })) } } } } },
  distanceMeasure: 'COSINE', limit: 5, distanceResultField: '_distance',
} } };
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents:runQuery`;
const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
if (!r.ok) { console.error(`query ${r.status}: ${(await r.text()).slice(0, 400)}`); process.exit(1); }
const rows = (await r.json()).filter(x => x.document);
console.log(`\nQ: "${query}"\n`);
for (const x of rows) {
  const f = x.document.fields;
  const dist = f._distance?.doubleValue ?? '?';
  console.log(`• ${f.section_ref.stringValue} — ${f.title.stringValue}  (cosine dist ${(+dist).toFixed(4)})`);
  console.log(`  ${f.text.stringValue.slice(0, 200)}...\n`);
}
