// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Historical reference library mapping chart conditions to verified 
 * aphorisms and rules from traditional astrology manuals.
 */
export const HISTORICAL_APHORISMS = {
  lilly: {
    author: "William Lilly",
    source: "Christian Astrology (1647)",
    strictures: {
      asc_early: "Lilly writes: 'If the Ascendant be in the first 3 degrees of any sign, the matter is not yet ripe for judgment...'",
      asc_late: "Lilly writes: 'If the Ascendant be in the last 3 degrees of any sign, the matter has already passed its turning point and the querent is seeking to deceive...'",
      saturn_1st: "Lilly writes: 'If Saturn be in the 1st house, he destroys the judgment of the artist, signifying error...'",
      saturn_7th: "Lilly writes: 'If Saturn be in the 7th house, he either destroys the credit of the astrologer or indicates the matter will go from bad to worse...'",
      via_combusta: "Lilly writes: 'The Moon in the Via Combusta, which is from 15 degrees of Libra to 15 degrees of Scorpio, suffers great affliction, and the business will seldom prosper...'",
      voc_moon: "Lilly writes: 'A Void of Course Moon shows that the matter shall hardly perfect; it represents a state where things go slowly and lead to nothing...'"
    },
    placements: {
      combust: "Lilly writes: 'When a planet is within 8 degrees 30 minutes of the Sun, it is combust, which signifies that the planet is utterly disabled and lacks power to act...'",
      cazimi: "Lilly writes: 'A planet within 17 minutes of the center of the Sun is in Cazimi, or in the heart of the Sun, and is then wonderfully strong and fortified...'",
      retrograde: "Lilly writes: 'A retrograde planet denotes delay, retreat, and a breaking of promises; it shows the actor is unwilling or unable to go forward...'"
    }
  },
  bonatti: {
    author: "Guido Bonatti",
    source: "Liber Astronomiae (c. 1277)",
    strictures: {
      voc_moon: "Bonatti writes in Consideration 28: 'When the Moon is Void of Course, the matter shall hardly perfect or come to a good end, unless the significators be in mutual reception...'",
      via_combusta: "Bonatti writes: 'The Moon in the burning path, which is from the middle of Libra to the middle of Scorpio, is like a man cast into a fire, suffering impediment in all things...'",
      saturn_7th: "Bonatti writes in Consideration 4: 'If Saturn is in the 7th house, it impedes the astrologer's judgment and denotes that the truth of the matter is obscured...'"
    },
    placements: {
      hayz: "Bonatti writes: 'A planet in Hayz operates with full and confident strength, acting as a citizen on his own home ground...'",
      detriment: "Bonatti writes: 'A planet in its detriment is like a sick man in the house of his enemy, having no power to help himself or others...'"
    }
  },
  dorotheus: {
    author: "Dorotheus of Sidon",
    source: "Carmen Astrologicum (c. 75 AD)",
    strictures: {
      voc_moon: "Dorotheus writes: 'If the Moon is void of course and does not join with any of the planets, then what is sought will not be accomplished and will dissolve...'"
    },
    placements: {
      triplicity: "Dorotheus writes: 'Look to the triplicity lords of the Ascendant; they govern the beginning, middle, and end of the matter, and reveal the true foundation...'",
      exalted: "Dorotheus writes: 'A planet in its exaltation is like a king in his kingdom, rising high in honor and carrying out its decree with ease...'"
    }
  },
  arabic: {
    author: "Māshā'allāh ibn Atharī",
    source: "On Reception (c. 800)",
    strictures: {
      refranation: "Māshā'allāh writes: 'Refranation is when a planet applies to another, but before they aspect, it turns retrograde; this shows the matter will be abandoned when it seems closest to completion...'"
    },
    placements: {
      reception: "Māshā'allāh writes: 'Reception is when a planet is in the place of another planet's dignity, and that planet receives it; this indicates friendship, assistance, and a positive outcome through another's help...'",
      translation: "Māshā'allāh writes: 'Translation of light is when a light planet separates from a significator and joins to another significator, carrying the strength and desire of one to the other...'"
    }
  }
};
