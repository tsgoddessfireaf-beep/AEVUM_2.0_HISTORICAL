// Aevum Library — chunker (Layer 1 shelf -> Layer 2 draft cards)
//
// Reads a full-text "shelf" file and splits it into draft "cards" (passages).
// OCR'd sources are messy, so output is marked _status: "pending_cleanup" — a
// human/LLM verification pass must confirm each card is VERBATIM before it is
// shown to clients. Clean, born-digital sources (e.g. Wikisource) can skip that.
//
// Usage: node chunk.mjs <shelf.txt> <out.jsonl> --author Bonatti --work "Anima Astrologiae" --tag bonatti
import { readFileSync, writeFileSync } from 'node:fs';

const [shelf, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+(.+)/).slice(0, 2)).map(([k, v]) => [k, (v || '').replace(/^"|"$/g, '')]));

const raw = readFileSync(shelf, 'utf8');

// Normalize OCR: rejoin hyphenated line breaks, soft-wraps -> spaces, keep paragraph gaps.
const norm = raw
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
  .replace(/\s*\n\s*\n\s*/g, '¶')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/¶/g, '\n\n');

// Split on "The <Ordinal> Consideration" headings (primary boundary for Anima).
const boundary = /\bThe\s+[A-Z][a-z-]+(?:[\s-][A-Za-z]+){0,3}\s+Consideration\b/g;
const idxs = [...norm.matchAll(boundary)].map(m => m.index);
const slug = (opt.author || 'src').toLowerCase().replace(/[^a-z]/g, '') + '-' + (opt.work || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

const cards = [];
for (let i = 0; i < idxs.length; i++) {
  const text = norm.slice(idxs[i], idxs[i + 1] ?? norm.length).trim().replace(/\s+/g, ' ');
  if (text.length < 40) continue;
  cards.push({
    id: `${slug}-c${String(i + 1).padStart(3, '0')}`,
    author: opt.author || null,
    tradition_tag: opt.tag || null,
    work: opt.work || null,
    language: 'en',
    license: 'public-domain',
    section_ref: `Consideration ~${i + 1} (provisional)`,
    title: null,
    text,
    translation: null,
    topics: [],
    condition_keys: [],
    source_url: opt.url || null,
    retrieved_at: opt.date || null,
    _status: 'pending_cleanup',
  });
}

writeFileSync(out, cards.map(c => JSON.stringify(c)).join('\n') + '\n');
console.log(`shelf chars: ${raw.length}`);
console.log(`draft cards written: ${cards.length} -> ${out}`);
console.log(`(NOTE: pending_cleanup — verify verbatim + finish segmentation before client use)`);
