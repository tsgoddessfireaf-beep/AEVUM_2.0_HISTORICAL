import { readFileSync, writeFileSync } from 'node:fs';

const PROJECT = 'flutter-ai-playground-f880c', LOC = 'us-central1', MODEL = 'gemini-2.5-flash';
const TOKEN = process.env.GAUTH;
if (!TOKEN) { console.error('Set GAUTH=$(gcloud auth print-access-token)'); process.exit(1); }

const [pdfPath, outPath] = process.argv.slice(2);
if (!outPath) { console.error('Usage: node ocr-scan.mjs <input.pdf> <output.txt>'); process.exit(1); }

const pdfData = readFileSync(pdfPath).toString('base64');

const sys = "You are an expert transcriber of historical manuscripts. Extract all text from this scanned document verbatim. Maintain original spelling and paragraph breaks. Do NOT translate or summarize. Output ONLY the raw transcribed text.";

const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${MODEL}:generateContent`;

const body = {
  system_instruction: { parts: [{ text: sys }] },
  contents: [{ 
    role: 'user', 
    parts: [
      { text: "Extract the text from this entire document." },
      { inlineData: { mimeType: 'application/pdf', data: pdfData } }
    ] 
  }],
  generationConfig: { temperature: 0 },
};

console.error(`Sending PDF to Gemini OCR... (${Math.round(pdfData.length / 1024)} KB base64)`);

try {
  const res = await fetch(url, { 
    method: 'POST', 
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, 
    body: JSON.stringify(body) 
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
    process.exit(1);
  }
  const j = await res.json();
  const text = j.candidates[0].content.parts[0].text;
  writeFileSync(outPath, text);
  console.error(`DONE: ${text.length} characters written to ${outPath}`);
} catch (e) {
  console.error("Fetch failed:", e);
}
