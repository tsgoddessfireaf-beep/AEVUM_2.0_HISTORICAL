// Aevum Library — verify completeness & auto-backfill seam-drops
//
// Long items that straddle a cleanup chunk boundary get dropped by the
// fragment-skip guard (e.g. Anima #143). This script: (1) finds missing /
// duplicate / out-of-order numbers in a cleaned cards file, (2) locates each
// missing item in the shelf text, (3) re-runs Gemini cleanup on a window
// centered on it, (4) merges and re-verifies — until the set is complete and
// correctly ordered.
//
// Auth: GAUTH = gcloud access token. Asserts the active GCP project first.
// Usage: GAUTH=$(gcloud auth print-access-token) node verify-and-backfill.mjs <shelf.txt> <cards.jsonl> --total 146
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PROJECT = 'flutter-ai-playground-f880c'; // Aevum 2.0 Historical — guard against wrong-project runs
const __dir = dirname(fileURLToPath(import.meta.url));
const [shelf, cardsPath, ...rest] = process.argv.slice(2);
const total = parseInt(rest[rest.indexOf('--total') + 1] || '0', 10);
if (!shelf || !cardsPath || !total) { console.error('usage: <shelf> <cards.jsonl> --total N'); process.exit(1); }
if (!process.env.GAUTH) { console.error('set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

// --- project guard ---
try {
  const active = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
  if (active !== EXPECTED_PROJECT) { console.error(`WRONG PROJECT: active=${active}, expected=${EXPECTED_PROJECT}. Aborting.`); process.exit(2); }
  console.error(`project OK: ${active}`);
} catch { console.error('could not confirm active gcloud project — aborting'); process.exit(2); }

const num = c => +String(c.section_ref || '').replace(/\D/g, '');
const load = () => readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// Normalized shelf text (same normalization as the cleaner) for locating headings.
const norm = readFileSync(shelf, 'utf8')
  .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2').replace(/\s*\n\s*\n\s*/g, '¶')
  .replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/¶/g, '\n\n');

const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
function locate(n) {
  for (const re of [new RegExp(`The\\s+${n}(st|nd|rd|th)?\\b`, 'i'), ORD[n] && new RegExp(`The\\s+${ORD[n]}\\b`, 'i')].filter(Boolean)) {
    const i = norm.search(re); if (i >= 0) return i;
  }
  return -1;
}

function report(cards) {
  const nums = cards.map(num).sort((a, b) => a - b);
  const missing = []; for (let i = 1; i <= total; i++) if (!nums.includes(i)) missing.push(i);
  const dups = [...new Set(nums.filter((n, i) => nums[i + 1] === n))];
  const ids = cards.map(c => c.id);
  const ordered = ids.every((v, i) => i === 0 || v >= ids[i - 1]); // zero-padded ids sort lexically = numerically
  return { count: cards.length, missing, dups, ordered };
}

let cards = load();
for (let pass = 0; pass < 4; pass++) {
  const r = report(cards);
  console.error(`pass ${pass}: count=${r.count} missing=[${r.missing.join(',')}] dups=[${r.dups.join(',')}] ordered=${r.ordered}`);
  if (!r.missing.length) break;
  const have = new Set(cards.map(c => c.section_ref));
  for (const n of r.missing) {
    const off = locate(n);
    if (off < 0) { console.error(`  #${n}: heading not found in shelf — skip`); continue; }
    const tmp = join(__dir, `.bf_${n}.jsonl`);
    spawnSync('node', [join(__dir, 'gemini-clean.mjs'), shelf, tmp, '--from', String(Math.max(0, off - 300)), '--max', '1'],
      { stdio: 'ignore', env: process.env });
    if (!existsSync(tmp)) { console.error(`  #${n}: backfill produced no file`); continue; }
    const got = readFileSync(tmp, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find(x => num(x) === n);
    rmSync(tmp);
    if (got && !have.has(got.section_ref)) { cards.push(got); have.add(got.section_ref); console.error(`  #${n}: backfilled (${got.text.length} chars)`); }
    else console.error(`  #${n}: not recovered`);
  }
  cards = cards.sort((a, b) => num(a) - num(b));
}

cards.sort((a, b) => num(a) - num(b));
writeFileSync(cardsPath, cards.map(c => JSON.stringify(c)).join('\n') + '\n');
const f = report(cards);
console.error(`\nFINAL: count=${f.count}/${total} missing=[${f.missing.join(',')}] dups=[${f.dups.join(',')}] ordered=${f.ordered}`);
process.exit(f.missing.length || f.dups.length || !f.ordered ? 1 : 0);
