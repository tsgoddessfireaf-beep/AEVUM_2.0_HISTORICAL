// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Parses the AI's ---SECTION--- delimited analysis into structured fields.
 * @param {string} text - Raw analysis string from the server.
 * @returns {{ answer: string|null, meaning: string|null, stars: string|null, next: string|null }}
 */
export function parseSections(text) {
  const result = { answer: null, meaning: null, stars: null, next: null };
  if (!text) return result;

  const parts = text.split(/^---(\w+)---\s*$/m);
  for (let i = 1; i < parts.length - 1; i += 2) {
    const key = parts[i].toLowerCase();
    const value = (parts[i + 1] || '').trim();
    if (key in result) result[key] = value || null;
  }
  return result;
}

/**
 * Converts **bold** and *italic* markdown to HTML inline elements.
 * Escapes HTML entities first to prevent XSS via prompt-injected content.
 * @param {string} text
 * @returns {string} Safe HTML string.
 */
export function formatInline(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/**
 * Splits bullet text (• or -) into an array of plain strings.
 * @param {string} text
 * @returns {string[]}
 */
export function parseBullets(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Extracts numbered list items ("1. ...", "2. ...") into an array of plain strings.
 * @param {string} text
 * @returns {string[]}
 */
export function parseNumbered(text) {
  if (!text) return [];
  return text
    .split('\n')
    .filter((l) => /^\d+\./.test(l.trim()))
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Returns Tailwind CSS classes for the answer card based on YES/NO/MAYBE/WAIT.
 * @param {string} answer
 * @returns {{ ring: string, text: string, glow: string }}
 */
export function answerStyle(answer) {
  const a = (answer || '').toUpperCase().trim();
  if (a === 'YES')   return { ring: 'ring-emerald-400/40', text: 'text-emerald-300', glow: 'shadow-emerald-400/20' };
  if (a === 'NO')    return { ring: 'ring-red-400/40',     text: 'text-red-300',     glow: 'shadow-red-400/20' };
  if (a === 'MAYBE') return { ring: 'ring-amber-300/40',   text: 'text-amber-200',   glow: 'shadow-amber-300/20' };
  if (a === 'WAIT')            return { ring: 'ring-amber-300/40',   text: 'text-amber-200',   glow: 'shadow-amber-300/20' };
  if (a === 'CHARACTER READ') return { ring: 'ring-violet-400/40',  text: 'text-violet-300',  glow: 'shadow-violet-400/20' };
  return { ring: 'ring-copper-400/40', text: 'text-copper-300', glow: 'shadow-copper-400/20' };
}
