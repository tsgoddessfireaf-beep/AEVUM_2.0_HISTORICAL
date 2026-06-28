// Aevum Library — Shelve All Books
//
// Uploads the full text of all historical works to the `library_shelves` collection
// in Firestore. This ensures that the full books are available in the database,
// not just the individual indexed cards.
//
// Usage: GAUTH=$(gcloud auth print-access-token) node library/scripts/shelve-all-books.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

const PROJECT = 'flutter-ai-playground-f880c';
const DB = '(default)';
const TOKEN = process.env.GAUTH;

if (!TOKEN) {
  console.error('Error: GAUTH environment variable not set.');
  process.exit(1);
}

const BOOKS = [
  { id: 'ibnezra-wisdom', path: join(__dir, '..', 'shelves', 'ibnezra-wisdom.txt') },
  { id: 'alchabitius-libellus', path: join(__dir, '..', 'shelves', 'alchabitius-libellus.txt') },
  { id: 'naibod-enarratio', path: join(__dir, '..', 'shelves', 'naibod-enarratio.txt') },
  { id: 'dariot-ad-astrorum', path: join(__dir, '..', 'shelves', 'dariot-ad-astrorum.txt') },
  { id: 'jacquinot-astrolabe', path: join(__dir, '..', 'shelves', 'jacquinot-astrolabe.txt') },
  { id: 'bonatti-anima', path: join(__dir, '..', 'shelves', 'bonatti-anima-raw.txt') },
  { id: 'culpeper-opus', path: join(__dir, '..', 'shelves', 'culpeper-opus.txt') },
  { id: 'lilly-christian', path: join(__dir, '..', 'shelves', 'lilly-christian-astrology-raw.txt') }
];

const MAX_CHUNK_SIZE = 500000;

async function uploadBook(book) {
  if (!existsSync(book.path)) {
    console.warn(`⚠️  Skipping ${book.id}: File not found at ${book.path}`);
    return;
  }

  const fullText = readFileSync(book.path, 'utf8');

  async function uploadDocument(id, text) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/library_shelves/${id}`;
    const body = {
      fields: {
        fullText: { stringValue: text },
        loadedAt: { stringValue: new Date().toISOString() }
      }
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error(`❌ Failed to shelve ${id}: ${res.status} ${await res.text()}`);
    } else {
      console.log(`✅ Successfully shelved ${id} (${text.length} chars)`);
    }
  }

  if (fullText.length <= MAX_CHUNK_SIZE) {
    await uploadDocument(book.id, fullText);
  } else {
    console.log(`Book ${book.id} is larger than 900KB (${fullText.length} chars). Splitting into parts...`);
    const chunks = [];
    for (let i = 0; i < fullText.length; i += MAX_CHUNK_SIZE) {
      chunks.push(fullText.slice(i, i + MAX_CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await uploadDocument(`${book.id}-part${i + 1}`, chunks[i]);
    }
  }
}

async function main() {
  console.log('Starting to shelve all books in Firestore...');
  for (const book of BOOKS) {
    await uploadBook(book);
  }
  console.log('Done shelving books.');
}

main().catch(console.error);
