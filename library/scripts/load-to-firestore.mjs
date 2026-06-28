// Aevum Library — loader (cards -> Firestore, the "card catalogue")
//
// Stores TWO layers in Firestore:
//   library_shelves/{id}  — the full text of a work (Layer 1, the books)
//   library_cards/{id}    — one passage + its embedding vector (Layer 2, the smart index)
//
// The embedding (the "find by meaning" vector) is produced by a pluggable
// provider so the model choice isn't baked in. Wire EMBED to your chosen model
// (Vertex AI text-embedding-* is the natural fit on this Firebase project).
//
// Usage: node load-to-firestore.mjs <cards.jsonl> [--shelf <shelf.txt> --shelf-id bonatti-anima]
// Requires: GOOGLE_APPLICATION_CREDENTIALS (ADC) + a chosen embedding endpoint.
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// --- pluggable embedding provider (REPLACE with your chosen model) -----------
async function EMBED(text) {
  // TODO: call Vertex AI text-embedding-004 (or similar) and return number[].
  // Left unimplemented on purpose so we lock the provider decision first.
  throw new Error('EMBED() not wired yet — choose an embedding model (see library README).');
}
// -----------------------------------------------------------------------------

const [cardsPath, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+(.+)/).slice(0, 2)).map(([k, v]) => [k, v]));

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Layer 1 — shelve the full book
if (opt.shelf && opt['shelf-id']) {
  const fullText = readFileSync(opt.shelf, 'utf8');
  await db.collection('library_shelves').doc(opt['shelf-id']).set({ fullText, loadedAt: FieldValue.serverTimestamp() });
  console.log(`shelved full text -> library_shelves/${opt['shelf-id']} (${fullText.length} chars)`);
}

// Layer 2 — index the cards (skip any still pending_cleanup; never index unverified quotes)
const cards = readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
let loaded = 0, skipped = 0;
for (const c of cards) {
  if (c._status === 'pending_cleanup') { skipped++; continue; }
  const passage = c.translation || c.text;        // index our translation if present, else the English
  const embedding = FieldValue.vector(await EMBED(passage));
  const { _status, ...doc } = c;
  await db.collection('library_cards').doc(c.id).set({ ...doc, embedding });
  loaded++;
}
console.log(`cards indexed: ${loaded} | skipped (pending_cleanup): ${skipped}`);
console.log('Next: create the Firestore vector index on library_cards.embedding, then query with findNearest().');
