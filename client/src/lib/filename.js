// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

// Builds a descriptive filename for the saved horary reading PDF.
// Browsers use document.title as the default save-as filename for window.print().
//
// Example output:
//   "Aevum 2026-05-16 1430 Tampa [You, romantic partner, relationship] Horary Report"

/**
 * Strips characters that are illegal in Windows/Mac filenames and truncates.
 * @param {string} s
 * @param {number} [maxLen=40]
 * @returns {string}
 */
function sanitize(s, maxLen = 40) {
  return (s || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')   // characters that break filenames on Win/Mac
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Builds a descriptive filename for the saved horary reading PDF.
 * Used by setting document.title before window.print() so the browser suggests it as the save-as name.
 * @param {{ dateTimeData: Object, houseSignifications: Object }} params
 * @returns {string} e.g. "Aevum 2026-05-16 1430 Tampa [You, romantic partner, relationship] Horary Report"
 */
export function buildReadingFilename({ dateTimeData, houseSignifications }) {
  const { date = '', time = '', location = '' } = dateTimeData || {};
  const compactTime = (time || '').replace(':', '');
  const city = sanitize(location.split(',')[0], 30);

  const subject    = 'You';
  const directObj  = sanitize(houseSignifications?.quesited_label, 40) || 'matter';
  const indirectObj = sanitize(houseSignifications?.question_type, 30);

  const tags = [subject, directObj, indirectObj].filter(Boolean).join(', ');

  const parts = [
    'Aevum',
    date,
    compactTime,
    city,
    `[${tags}]`,
    'Horary Report',
  ].filter(Boolean);

  return parts.join(' ');
}
