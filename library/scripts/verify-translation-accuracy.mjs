// Aevum Library — Translation Accuracy Verification & Audit
//
// Performs two layers of verification on the generated JSONL cards:
// 1. Programmatic Astrological Alignment: Verifies that planets and zodiac signs
//    mentioned in the Hebrew text are correctly present in the English translation.
// 2. LLM-based Translation Audit: Uses Gemini to evaluate a sample (or specific flagged cards)
//    by comparing the Hebrew and English, scoring it (0-100), and providing feedback.
//
// Usage: GAUTH=$(gcloud auth print-access-token) node library/scripts/verify-translation-accuracy.mjs <cards.jsonl> [--sample N]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cardsPath, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+(.+)/).slice(0, 2)).map(([k, v]) => [k, (v || '').replace(/^"|"$/g, '')]));

if (!cardsPath) {
  console.error('Usage: node verify-translation-accuracy.mjs <cards.jsonl> [--sample N]');
  process.exit(1);
}

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;

const PLANET_MAP = [
  { he: 'שבתי', en: 'saturn' },
  { he: 'צדק', en: 'jupiter' },
  { he: 'מאדים', en: 'mars' },
  { he: 'חמה', en: 'sun' }, // or solar
  { he: 'נוגה', en: 'venus' },
  { he: 'כוכב', en: 'mercury' }, // Note: 'kochav' can mean star, but in this context often mercury
  { he: 'לבנה', en: 'moon' }
];

const SIGN_MAP = [
  { he: 'טלה', en: 'aries' },
  { he: 'שור', en: 'taurus' },
  { he: 'תאומים', en: 'gemini' },
  { he: 'סרטן', en: 'cancer' },
  { he: 'אריה', en: 'leo' },
  { he: 'בתולה', en: 'virgo' },
  { he: 'מאזנים', en: 'libra' },
  { he: 'עקרב', en: 'scorpio' },
  { he: 'קשת', en: 'sagittarius' },
  { he: 'גדי', en: 'capricorn' },
  { he: 'דלי', en: 'aquarius' },
  { he: 'דגים', en: 'pisces' }
];

async function audit() {
  const cards = readFileSync(cardsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.log(`Loaded ${cards.length} cards for verification from ${cardsPath}`);

  console.log('\n--- Phase 1: Programmatic Alignment Check ---');
  const flagged = [];

  for (const card of cards) {
    const heText = card.text || '';
    const enText = (card.translation || '').toLowerCase();
    const missing = [];

    // Check planets
    for (const p of PLANET_MAP) {
      if (heText.includes(p.he)) {
        // Special check for sun/solar and mercury/star
        if (p.en === 'sun' && !enText.includes('sun') && !enText.includes('solar')) {
          missing.push(`Planet: ${p.en} (${p.he})`);
        } else if (p.en === 'mercury' && !enText.includes('mercury') && !enText.includes('planet')) {
          // 'kochav' sometimes translated as 'the planet' or 'mercury'
          missing.push(`Planet: ${p.en} (${p.he})`);
        } else if (p.en !== 'sun' && p.en !== 'mercury' && !enText.includes(p.en)) {
          missing.push(`Planet: ${p.en} (${p.he})`);
        }
      }
    }

    // Check signs
    for (const s of SIGN_MAP) {
      if (heText.includes(s.he) && !enText.includes(s.en)) {
        missing.push(`Sign: ${s.en} (${s.he})`);
      }
    }

    if (missing.length > 0) {
      flagged.push({ id: card.id, title: card.title, missing });
    }
  }

  console.log(`Alignment check finished. Flagged ${flagged.length} cards with potential omissions:`);
  for (const item of flagged) {
    console.log(`  [FLAGGED] ${item.id} ("${item.title}"): Missing equivalents in English: ${item.missing.join(', ')}`);
  }

  if (TOKEN) {
    console.log('\n--- Phase 2: LLM-based Translation Audit ---');
    const sampleSize = parseInt(opt.sample || '5', 10);
    // Select a mix of flagged cards and random cards
    const toAudit = [];
    const flaggedCards = cards.filter(c => flagged.some(f => f.id === c.id));
    const normalCards = cards.filter(c => !flagged.some(f => f.id === c.id));

    // Take up to half of the sample from flagged cards
    const flaggedSample = flaggedCards.slice(0, Math.min(flaggedCards.length, Math.ceil(sampleSize / 2)));
    toAudit.push(...flaggedSample);

    // Fill the rest with normal cards
    const normalSample = normalCards.sort(() => 0.5 - Math.random()).slice(0, sampleSize - toAudit.length);
    toAudit.push(...normalSample);

    console.log(`Auditing a sample of ${toAudit.length} cards using ${MODEL}...`);

    for (const card of toAudit) {
      console.log(`\nAuditing card: ${card.id} ("${card.title}")...`);
      const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
      
      const prompt = `You are an expert academic auditor. Evaluate the accuracy of this English translation of Abraham Ibn Ezra's 12th-century Hebrew astrological text.
Compare the original Hebrew text with the English translation.

Hebrew Original:
"""
${card.text}
"""

English Translation:
"""
${card.translation}
"""

Provide your evaluation in the following JSON format:
{
  "accuracy_score": <integer from 0 to 100>,
  "errors_found": ["list of specific translation errors, omissions, or mistranslations, or empty array"],
  "astrological_terminology_check": "evaluation of whether technical terms (planets, houses, aspects, reception, etc.) were translated correctly",
  "overall_critique": "short summary of the translation quality"
}`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const evalResult = JSON.parse(j.candidates[0].content.parts[0].text);
        
        console.log(`  Accuracy Score: ${evalResult.accuracy_score}/100`);
        console.log(`  Terminology: ${evalResult.astrological_terminology_check}`);
        if (evalResult.errors_found.length > 0) {
          console.log(`  Errors Found:`, evalResult.errors_found);
        } else {
          console.log(`  Errors Found: None`);
        }
        console.log(`  Critique: ${evalResult.overall_critique}`);
      } catch (e) {
        console.error(`  Audit failed: ${e.message}`);
      }
    }
  } else {
    console.log('\n[INFO] Set GAUTH env var to run Phase 2 (LLM-based Translation Audit).');
  }
}

audit().catch(console.error);
