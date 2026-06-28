// Aevum Library — shelve a full book text in Firestore library_shelves
//
// Usage: GAUTH=$(gcloud auth print-access-token) node shelve-book.mjs <text_file> <shelf_id>
// Example: GAUTH=$(gcloud auth print-access-token) node shelve-book.mjs library/shelves/dariot-english.txt dariot-ad-astrorum

import { readFileSync } from 'node:fs';

const PROJECT = 'flutter-ai-playground-f880c', DB = '(default)';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const [filePath, shelfId] = process.argv.slice(2);
if (!filePath || !shelfId) {
  console.error('Usage: node shelve-book.mjs <text_file> <shelf_id>');
  process.exit(1);
}

const fullText = readFileSync(filePath, 'utf8');
const MAX_CHUNK_SIZE = 900000;

async function uploadDocument(id, text) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/library_shelves/${id}`;
  const body = {
    fields: {
      fullText: { stringValue: text },
      loadedAt: { stringValue: new Date().toISOString() }
    }
  };

  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    throw new Error(`Upload failed for ${id}: ${r.status} ${await r.text()}`);
  }
  console.log(`Successfully shelved -> library_shelves/${id} (${text.length} chars)`);
}

if (fullText.length <= MAX_CHUNK_SIZE) {
  console.log(`Uploading ${filePath} to library_shelves/${shelfId}...`);
  try {
    await uploadDocument(shelfId, fullText);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else {
  console.log(`File is larger than 900KB (${fullText.length} chars). Splitting into parts...`);
  const chunks = [];
  for (let i = 0; i < fullText.length; i += MAX_CHUNK_SIZE) {
    chunks.push(fullText.slice(i, i + MAX_CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const partId = `${shelfId}-part${i + 1}`;
    try {
      await uploadDocument(partId, chunks[i]);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
}

