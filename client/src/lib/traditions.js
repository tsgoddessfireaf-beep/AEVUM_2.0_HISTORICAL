// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

export const TRADITIONS = [
  {
    id: 'classic',
    name: 'Classic',
    era: 'Synthesis',
    description: `A balanced synthesis of traditional horary methods. Planets, dignities, aspects, and the Moon's testimony.`,
    houseSystem: 'Regiomontanus',
  },
  {
    id: 'lilly',
    name: 'William Lilly',
    era: 'England, 1647',
    description: `Christian Astrology — the definitive English horary text. Fixed stars, antiscia, strict dignities, and Lilly's direct aphoristic voice.`,
    houseSystem: 'Regiomontanus',
  },
  {
    id: 'bonatti',
    name: 'Guido Bonatti',
    era: 'Italy, c. 1277',
    description: 'Liber Astronomiae — methodical Latin scholasticism. The 146 Considerations Before Judgment, hayz, and almuten reckoning.',
    houseSystem: 'Regiomontanus',
  },
  {
    id: 'arabic',
    name: 'Medieval Arabic',
    era: 'Baghdad, c. 800–1100',
    description: `The Persian-Arabic synthesis of Māshā'allāh and Abū Ma'shar. Sect is primary; lots, almuten, and fate-ordained decree.`,
    houseSystem: 'Regiomontanus',
  },
  {
    id: 'dorotheus',
    name: 'Dorotheus of Sidon',
    era: 'Alexandria, c. 75 AD',
    description: 'Carmen Astrologicum — the oldest surviving horary tradition. Triplicity lords, whole signs, elemental reasoning, and sect.',
    houseSystem: 'Whole Sign',
  },
];

export const DEFAULT_TRADITION = TRADITIONS[0];

export function getTradition(id) {
  return TRADITIONS.find(t => t.id === id) ?? DEFAULT_TRADITION;
}
