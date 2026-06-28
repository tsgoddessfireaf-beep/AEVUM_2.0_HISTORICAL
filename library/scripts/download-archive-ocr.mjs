import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dir = dirname(fileURLToPath(import.meta.url));
const [itemId, outFilename] = process.argv.slice(2);

if (!itemId || !outFilename) {
  console.error('Usage: node download-archive-ocr.mjs <archive-item-id> <out-filename>');
  process.exit(1);
}

const outPath = join(__dir, '..', 'shelves', outFilename);

async function download() {
  console.log(`Fetching metadata for item: ${itemId}...`);
  const metaRes = await fetch(`https://archive.org/metadata/${itemId}`);
  const meta = await metaRes.json();
  
  const textFile = meta.files.find(f => f.format === 'OCR Search Text' || (f.name.endsWith('.txt') && !f.name.includes('_djvu.txt')));
  if (!textFile) {
    console.error('No suitable text file found in item.');
    process.exit(1);
  }

  const url = `https://archive.org/download/${itemId}/${textFile.name}`;
  console.log(`Downloading text from: ${url}`);
  
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  
  let text;
  if (textFile.name.endsWith('.gz')) {
    text = zlib.gunzipSync(buffer).toString('utf-8');
  } else {
    text = Buffer.from(buffer).toString('utf-8');
  }
  
  // Basic cleanup of hOCR or raw text artifacts
  text = text.replace(/<[^>]*>?/gm, ''); // Remove any HTML/XML tags if it's hOCR wrapped in txt
  
  writeFileSync(outPath, text);
  console.log(`Saved ${text.length} characters to ${outPath}`);
}

download().catch(console.error);
