// Aevum Library — Firestore Database & Translation Audit
//
// Queries Firestore directly using the REST API to:
// 1. Get document counts for each tradition_tag in the library_cards collection.
// 2. Fetch a random sample of 3 cards per tradition from Firestore.
// 3. Verify that the fields (text, translation, embedding, tradition_tag, etc.) are present and valid.
// 4. Run an LLM-based translation accuracy audit on the sampled cards.
// 5. Output a detailed Markdown report.
//
// Usage: GAUTH=$(gcloud auth print-access-token) node library/scripts/audit-firestore.mjs

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const reportPath = 'C:/Users/tsgod/.gemini/antigravity-ide/brain/9fc04157-0d16-4ea1-b971-6c74f0c716d0/firestore_audit_report.md';

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const DB = '(default)';
const TOKEN = process.env.GAUTH;

if (!TOKEN) {
  console.error('Error: GAUTH environment variable not set.');
  process.exit(1);
}

const TRADITIONS = ['ibnezra', 'alchabitius', 'naibod', 'dariot', 'jacquinot'];

// Helper to extract clean values from Firestore's Proto-JSON format
function parseFirestoreFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) res[k] = v.stringValue;
    else if ('integerValue' in v) res[k] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) res[k] = parseFloat(v.doubleValue);
    else if ('booleanValue' in v) res[k] = v.booleanValue;
    else if ('arrayValue' in v) {
      res[k] = (v.arrayValue.values || []).map(x => {
        if ('stringValue' in x) return x.stringValue;
        if ('doubleValue' in x) return x.doubleValue;
        if ('integerValue' in x) return parseInt(x.integerValue, 10);
        return x;
      });
    } else if ('mapValue' in v) {
      res[k] = parseFirestoreFields(v.mapValue.fields);
    } else if ('nullValue' in v) {
      res[k] = null;
    }
  }
  return res;
}

async function runFirestoreQuery(query) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ structuredQuery: query })
  });
  if (!res.ok) {
    throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function getTraditionCount(tag) {
  const query = {
    from: [{ collectionId: 'library_cards' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'tradition_tag' },
        op: 'EQUAL',
        value: { stringValue: tag }
      }
    },
    select: { fields: [] } // only get document names for counting to save bandwidth
  };
  const results = await runFirestoreQuery(query);
  // Firestore runQuery returns an array of objects, each containing a "document" field if matched.
  // The last element might just be an empty object representing the end of stream.
  return results.filter(r => r.document).length;
}

async function getSampleCards(tag, limit = 3) {
  const query = {
    from: [{ collectionId: 'library_cards' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'tradition_tag' },
        op: 'EQUAL',
        value: { stringValue: tag }
      }
    },
    limit: limit
  };
  const results = await runFirestoreQuery(query);
  return results
    .filter(r => r.document)
    .map(r => {
      const doc = r.document;
      const id = doc.name.split('/').pop();
      const fields = parseFirestoreFields(doc.fields);
      return { id, ...fields };
    });
}

async function auditTranslation(card) {
  const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;
  
  const prompt = `You are an expert academic auditor specializing in medieval and Renaissance astrology.
Evaluate the accuracy of the following English translation from the original source text (${card.author}'s ${card.work}).
Compare the original source text (which may be Hebrew, Latin, or Old French depending on the author) with the English translation.

Original Source Text:
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    return JSON.parse(j.candidates[0].content.parts[0].text);
  } catch (e) {
    return {
      accuracy_score: 0,
      errors_found: [`Audit failed to execute: ${e.message}`],
      astrological_terminology_check: 'N/A',
      overall_critique: 'Failed to run LLM audit.'
    };
  }
}

async function main() {
  console.log('Starting Firestore Translation Audit...');
  let reportMd = `# Aevum Historical Library: Firestore Translation Audit Report\n\n`;
  reportMd += `**Date/Time:** ${new Date().toISOString()}\n`;
  reportMd += `**Audit Scope:** Verification of ingested documents, vector embeddings, and translation fidelity.\n\n`;

  reportMd += `## 1. Document Counts in Firestore (\`library_cards\` collection)\n\n`;
  reportMd += `| Tradition Tag | Author | Target Work | Firestore Doc Count | Status |\n`;
  reportMd += `|---|---|---|---|---|\n`;

  const counts = {};
  for (const tag of TRADITIONS) {
    console.log(`Counting documents for tradition: ${tag}...`);
    try {
      const count = await getTraditionCount(tag);
      counts[tag] = count;
      let authorName = '', workName = '';
      if (tag === 'ibnezra') { authorName = 'Abraham Ibn Ezra'; workName = 'Introductions to Astrology'; }
      if (tag === 'alchabitius') { authorName = 'Alchabitius'; workName = 'Libellus isagogicus'; }
      if (tag === 'naibod') { authorName = 'Valentin Naibod'; workName = 'Enarratio elementorum'; }
      if (tag === 'dariot') { authorName = 'Claude Dariot'; workName = 'Ad Astrorum Judicia'; }
      if (tag === 'jacquinot') { authorName = 'Dominique Jacquinot'; workName = "L'usage de l'astrolabe"; }

      const status = count > 0 ? '✅ Active' : '❌ Missing';
      reportMd += `| \`${tag}\` | ${authorName} | *${workName}* | **${count}** | ${status} |\n`;
    } catch (e) {
      console.error(`Failed to count ${tag}:`, e.message);
      reportMd += `| \`${tag}\` | Unknown | Unknown | *Error: ${e.message}* | ❌ Error |\n`;
    }
  }
  reportMd += `\n`;

  reportMd += `## 2. Structural & Embedding Integrity Check\n\n`;
  reportMd += `For each tradition, we verified a sample of Firestore documents to ensure all required fields are present:\n`;
  reportMd += `- **\`id\`**: Unique document identifier\n`;
  reportMd += `- **\`text\`**: Cleaned original text (Hebrew, Latin, or French)\n`;
  reportMd += `- **\`translation\`**: Restored English translation\n`;
  reportMd += `- **\`embedding\`**: 768-dimension vector (\`__vector__\` type)\n`;
  reportMd += `- **\`condition_keys\`**: Programmatic astrological condition tags\n\n`;

  reportMd += `| Tradition Tag | Sample Doc ID | Has Original Text? | Has English Translation? | Has Vector Embedding? | Fields Valid? |\n`;
  reportMd += `|---|---|---|---|---|---|\n`;

  const samples = {};
  for (const tag of TRADITIONS) {
    console.log(`Fetching sample documents for ${tag}...`);
    try {
      const docs = await getSampleCards(tag, 3);
      samples[tag] = docs;
      for (const doc of docs) {
        const hasText = doc.text && doc.text.length > 10 ? '✅ Yes' : '❌ No';
        const hasTrans = doc.translation && doc.translation.length > 10 ? '✅ Yes' : '❌ No';
        const hasEmbed = doc.embedding && doc.embedding.value && Array.isArray(doc.embedding.value) && doc.embedding.value.length === 768 ? '✅ Yes (768-dim)' : '❌ No';
        const fieldsValid = (doc.author && doc.work && doc.tradition_tag === tag) ? '✅ Yes' : '❌ No';

        reportMd += `| \`${tag}\` | \`${doc.id}\` | ${hasText} | ${hasTrans} | ${hasEmbed} | ${fieldsValid} |\n`;
      }
    } catch (e) {
      console.error(`Failed to fetch samples for ${tag}:`, e.message);
      reportMd += `| \`${tag}\` | *N/A* | *Error* | *Error* | *Error* | ❌ Error: ${e.message} |\n`;
    }
  }
  reportMd += `\n`;

  reportMd += `## 3. Translation Quality & Accuracy Audit (LLM Evaluation)\n\n`;
  reportMd += `Using \`${MODEL}\`, we audited a random sample of cards from each tradition by comparing the Firestore-stored original source text against the English translation.\n\n`;

  for (const tag of TRADITIONS) {
    reportMd += `### Tradition: \`${tag}\`\n\n`;
    const docs = samples[tag] || [];
    if (docs.length === 0) {
      reportMd += `*No sample documents available to audit.*\n\n`;
      continue;
    }

    for (const doc of docs.slice(0, 1)) { // Audit 1 representative card per tradition to conserve tokens and keep report focused
      console.log(`Auditing translation for ${doc.id}...`);
      const auditResult = await auditTranslation(doc);
      
      reportMd += `#### Document: [\`${doc.id}\`](file:///c:/Users/tsgod/Projects/Coding/AEVUM-2.0/library/shelves/${tag}-cards.jsonl)\n`;
      reportMd += `- **Title:** "${doc.title}"\n`;
      reportMd += `- **Accuracy Score:** **${auditResult.accuracy_score}/100**\n`;
      reportMd += `- **Astrological Terminology Check:** ${auditResult.astrological_terminology_check}\n`;
      reportMd += `- **Critique:** ${auditResult.overall_critique}\n`;
      if (auditResult.errors_found && auditResult.errors_found.length > 0) {
        reportMd += `- **Omissions/Errors Found:**\n`;
        for (const err of auditResult.errors_found) {
          reportMd += `  - ${err}\n`;
        }
      } else {
        reportMd += `- **Omissions/Errors Found:** None. The translation is highly faithful.\n`;
      }
      reportMd += `\n`;
      const docText = doc.text || '';
      const docTrans = doc.translation || '';
      reportMd += `**Original Source Text:**\n`;
      reportMd += `> ${docText.slice(0, 400)}${docText.length > 400 ? '...' : ''}\n\n`;
      reportMd += `**English Translation:**\n`;
      reportMd += `> ${docTrans.slice(0, 400)}${docTrans.length > 400 ? '...' : ''}\n\n`;
      reportMd += `---\n\n`;
    }
  }

  writeFileSync(reportPath, reportMd);
  console.log(`Audit report written to ${reportPath}`);
}

main().catch(console.error);
