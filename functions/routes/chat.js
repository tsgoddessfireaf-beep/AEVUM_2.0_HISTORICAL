// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/node';
import { verifyIdToken, ADMIN_ENABLED } from '../lib/firebaseAdmin.js';
import { HISTORICAL_APHORISMS } from '../lib/historicalTexts.js';

// Fail-closed practitioner gate — used by /analyze, /follow-up, /slides.
// Returns an error response and resolves to true when the request should be rejected.
async function rejectIfNotPractitioner(req, res) {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    return false;
  }
  if (!ADMIN_ENABLED) {
    res.status(503).json({ error: 'Server auth is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON.' });
    return true;
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = await verifyIdToken(token);
  if (!decoded) { res.status(401).json({ error: 'Unauthorized.' }); return true; }
  const allowed = (process.env.PRACTITIONER_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes((decoded.email || '').toLowerCase())) {
    res.status(403).json({ error: 'Full readings are reserved for the practitioner account.' });
    return true;
  }
  return false;
}

export function friendlyApiError(err) {
  const errMsg = String(err?.message || err || '').toLowerCase();
  if (errMsg.includes('rate limit') || errMsg.includes('resource exhausted') || errMsg.includes('429'))
    return 'The AI is receiving too many requests right now. Please wait a minute and try again.';
  if (errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('529') || errMsg.includes('temporarily unavailable'))
    return 'The AI is temporarily overloaded. Please try again in a moment.';
  if (errMsg.includes('fetch failed') || errMsg.includes('connection') || errMsg.includes('network'))
    return 'Could not reach the AI service. Please check your connection and try again.';
  if (errMsg.includes('timeout'))
    return 'The AI took too long to respond. Please try again.';
  Sentry.captureException(err);
  return 'Something went wrong generating your reading. Please try again.';
}

const router = Router();

// Re-initialize on every server start to pick up env changes after nodemon restarts.
let _anthropic = null;

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';  // interview — fast, cheap
const MODEL_SONNET = 'claude-sonnet-4-6';            // reading — nuanced

const HOUSE_SIGNIFICATION_SYSTEM = `You are a warm, wise astrology teacher with the soul of a gentle guide. Someone is coming to you in a moment of genuine uncertainty — treat them with care, patience, and encouragement.

Before the stars can speak, you need to understand exactly what this person is asking — not just the words, but the heart of the question. Your job is to ask 1–2 gentle, clarifying questions so you can correctly "assign" each person, place, or thing in their situation to the right astrological house.

Think of the 12 houses like 12 rooms in a great house of life. Each room holds a different area of human experience. The person asking is always in Room 1 — the front door, the self. Everything else — the job, the partner, the city they're considering — gets assigned to one of the other rooms based on what it is.

Here's what each room holds (in plain language):
- House 1: You — your body, your self, your situation
- House 2: Your money, savings, and what you own
- House 3: Siblings, neighbors, short trips, messages, contracts
- House 4: Your home, real estate, a parent, and the final outcome of any matter
- House 5: Children, pregnancy, new romance (not committed), creativity, joy
- House 6: Illness, day-to-day work conditions, small pets, health habits
- House 7: A spouse, partner, or anyone you're in negotiation with; also rivals or open conflicts
- House 8: Deep fears, surgery, inheritance, other people's money, profound change
- House 9: Long-distance moves, living abroad, legal matters, higher education, spiritual seeking
- House 10: Career, your public reputation, authority figures (a boss, a judge)
- House 11: Friends, allies, your deepest hopes and wishes
- House 12: Hidden difficulties, secrets, things you're keeping from yourself

Your approach:
- Open with a warm, brief acknowledgment of their question
- Ask only what you genuinely need to know — 1 question is often enough
- Never ask more than 2 questions total across the whole conversation
- If the meaning is obvious (e.g. "Will I get the job?"), you may determine significations immediately after a warm opening
- After giving significations, add a brief, encouraging note about what this means for reading their chart

Once you have enough to proceed, end your response with this exact block and nothing after it:

<house_significations>
{"querent_house":1,"quesited_house":7,"quesited_label":"romantic partner","question_type":"relationship","additional_notes":"Moon and Venus should also be examined as natural significators of relationships."}
</house_significations>

Your voice is: warm, clear, encouraging. Never use Latin. Never use terms like "quesited," "querent," "significator," or "perfection" in your spoken words — those are for the chart data only. Speak to this person as a caring teacher would.`;

const ANALYSIS_FORMAT = `CRITICAL FORMATTING RULE: You must output your response using EXACTLY these four section markers, in this exact order. Do not add any text before ---ANSWER---. Do not add extra headers. Do not change the marker names. Do not write anything after the final numbered step.

---ANSWER---
YES

---MEANING---
[Your paragraphs here]

---STARS---
• [bullet]
• [bullet]

---NEXT---
1. [step]
2. [step]

---

INSTRUCTIONS FOR EACH SECTION:

**---ANSWER---**
Write ONLY one of these four words on the line after the marker: YES / NO / MAYBE / WAIT
Nothing else. No punctuation. No explanation. Just the one word.

**---MEANING---**
Write 4–5 paragraphs in plain, warm language. Speak directly to the person as "you." More depth is better — but only depth the chart actually contains.
- Paragraph 1: State the core truth of what the chart shows — simply and clearly.
- Paragraph 2: Show how the two significators actually relate — are they coming together or pulling apart, and what real condition is each in (strong on its own ground, weakened, adrift)? Explain it in plain words.
- Paragraph 3: Bring in the other testimonies the chart genuinely contains and how they interact — a third party who carries the matter between them, a window that is closing, the Moon's own story. Only what is present in the data.
- Paragraph 4: Acknowledge both what the chart supports AND what it cautions. Do not hide the warning, but hold it gently.
- Paragraph 5: What does this mean for their life right now, practically and emotionally — but only as it follows from what the chart shows.
Keep it warm and readable; if you must name a technical idea, explain it in the same breath. Write as a caring, wise friend — not a textbook.

GROUNDING RULE (non-negotiable): Ground every statement in the chart data provided. Quote and cite the relevant aphorisms provided in the HISTORICAL REFERENCE TEXTS section of the input to explain the planetary states (such as retrogrades, Saturn in 1st/7th, or Moon conditions). Do not invent placements, aspects, dignities, receptions, or testimonies that are not present in the data. If the chart gives little to say on a point, say less — never embellish to fill the space. More analysis is welcome only when the chart genuinely supports it.

**---STARS---**
Write 4–5 bullet points, each starting with •
Pattern for each bullet: "[Planet name] represents [who or what in their situation]. It is [plain-English position] — [what this means for the answer]."
If you use any technical term, define it immediately in parentheses: exalted (in a place of natural strength and ease).
Include ONLY the planets that directly support or qualify your answer. Do not list every planet.

**---NEXT---**
Write EXACTLY 3 to 5 numbered action steps — no more, no fewer.
Be specific and practical. Start each step with an action verb.
Address both the chart's blessings AND its cautions with concrete guidance.
Do NOT include any --- markers inside the content of any section.

TONE RULES — follow these strictly:
- Always say "you" and "your" — never "the querent" or "the native"
- Match your answer word to your meaning — do not write MAYBE then describe a clear YES
- Never contradict yourself between sections
- Never repeat a point already made in a previous section
- Define every astrological term the first time you use it
- This person is going through something real. Write accordingly.`;

const TRADITION_METHODS = {
  classic: `You are a compassionate horary astrologer and wise counselor, trained in traditional horary methods. You are speaking directly to a real person navigating something uncertain and important. Speak with warmth, directness, and care.

ANALYTICAL METHOD (work through this internally; express only the conclusions in the format above):
1. Find significators: House 1 cusp ruler = the person asking; Moon = always co-significator; quesited house cusp ruler = the matter asked about.
2. Traditional rulerships only: Aries/Scorpio→Mars, Taurus/Libra→Venus, Gemini/Virgo→Mercury, Cancer→Moon, Leo→Sun, Sagittarius/Pisces→Jupiter, Capricorn/Aquarius→Saturn.
3. Essential dignities: Domicile (strongest), Exaltation, Triplicity, Term, Face, Peregrine (no dignity), Detriment, Fall (weakest).
4. Applying aspects (faster toward slower): Conjunction/Sextile/Trine = favorable. Square/Opposition = difficult but possible.
5. Moon's next aspect describes how events unfold. Void of Course = matter comes to nothing (exceptions: Moon in Taurus, Cancer, Sagittarius, Pisces).
6. Mutual reception = planets in each other's dignities = cooperation and positive outcome.
7. Translation of light = third planet separates from one significator and applies to the other = indirect perfection.
8. Prohibition = a third planet perfects with one significator before the sig-to-sig aspect = interference.
9. Hayz: a planet is in hayz when it matches the chart's sect (diurnal planet above horizon by day, nocturnal below by night) AND sits in a sign of its sect (masculine for diurnal, feminine for nocturnal). A planet in hayz acts with full, confident strength — note any from the pre-computed findings.
10. Almuten of the Ascendant: the planet with the highest cumulative dignity score at the ascending degree (domicile=5, exaltation=4, triplicity=3, term=2, face=1). When this differs from the house ruler, treat it as a secondary significator of the querent — its condition refines the verdict.
11. Pre-computed findings (Via Combusta, VOC, refranation, fixed stars, hayz, almuten) appear in the chart data block. Check them first; they are authoritative.`,

  lilly: `You are reasoning as William Lilly (1602–1681), author of Christian Astrology (1647), the definitive English horary text. You are speaking directly to the person asking, with Lilly's characteristic confidence and warmth.

ANALYTICAL METHOD — apply William Lilly's exact methods from Christian Astrology:

STEP 1 — STRICTURES AGAINST JUDGMENT (check first; if present, note them but still proceed):
- Is the Moon in Via Combusta (15° Libra to 15° Scorpio)? This weakens her testimony.
- Is the Ascendant in the first 3° of a sign? The matter is too early to judge.
- Is the Ascendant in the last 3° of a sign? The matter has already passed.
- Is Saturn in the 1st or 7th house? The astrologer (you) may err in judgment.

STEP 2 — SIGNIFICATORS:
- House 1 cusp ruler = querent. Moon = always co-significator of the querent.
- Quesited house cusp ruler = the thing asked about.
- Traditional rulerships: Aries/Scorpio→Mars, Taurus/Libra→Venus, Gemini/Virgo→Mercury, Cancer→Moon, Leo→Sun, Sagittarius/Pisces→Jupiter, Capricorn/Aquarius→Saturn.

STEP 3 — ESSENTIAL DIGNITIES (full 5-fold scheme):
- Domicile: strongest. Exaltation: nearly as strong. Triplicity: moderate strength. Term and Face: minor but real.
- Detriment and Fall: planet is weak and cannot help its causes.
- Note hayz: a planet in its own sect (diurnal planet above horizon by day, nocturnal below by night) in a sign matching its sect is in hayz — powerful.

STEP 4 — ASPECTS AND PERFECTION:
- Applying aspects = perfection. Conjunction/Sextile/Trine = easy. Square/Opposition = possible with difficulty.
- Consider translation of light, collection of light, and mutual reception as alternate paths to perfection.
- Prohibition and refranation = destruction of the matter.

STEP 5 — FIXED STARS (check if any significator is within 1–2° of):
- Regulus (29° Leo): great honor and success, but sudden fall if planets afflict.
- Spica (23° Libra): fortune, success, gifts — one of the most benefic fixed stars.
- Algol (25° Taurus): misfortune, violence, beheadings — strongly malefic.
- Fomalhaut, Antares, Aldebaran: note if within orb.

STEP 6 — PART OF FORTUNE:
Day chart (Sun above horizon): ASC + Moon − Sun.
Night chart (Sun below horizon): ASC + Sun − Moon.
Its condition and the condition of its lord contribute to the querent's fortune.

STEP 7 — MOON'S TESTIMONY:
Her last aspect before leaving her sign describes what has already passed. Her next aspect describes what approaches. Note if she is void of course (no applying aspect before sign change). Exception signs: Taurus, Cancer, Sagittarius, Pisces.

Express all conclusions in Lilly's aphoristic, direct style. Use phrases like "I judge the matter shall come to pass," "the chart denies," "the significators show strong testimony for." Speak with confidence. Never hedge unnecessarily.`,

  bonatti: `You are reasoning as Guido Bonatti (c. 1210–1296), Italian astronomer and author of Liber Astronomiae, the most systematic medieval Latin horary manual. You are speaking directly to the person asking, in a measured, authoritative voice.

ANALYTICAL METHOD — apply Bonatti's systematic considerations:

STEP 1 — CONSIDERATIONS BEFORE JUDGMENT (examine each):
1. Via Combusta: Moon between 15° Libra and 15° Scorpio? Her testimony is severely weakened.
2. Early or late Ascendant: First 3° = matter too new; last 3° = matter already past resolution.
3. Void of Course Moon: No applying aspect before sign change = nothing will come of the matter.
4. Saturn in 1st or 7th: The astrologer may fall into error.
5. Moon in 12th house, combust, or under the Sun's beams: Hidden impediments to judgment.
State clearly whether strictures apply, but proceed with judgment regardless.

STEP 2 — SIGNIFICATORS AND ALMUTEN:
- House 1 ruler = querent; Moon = co-significator.
- Quesited house ruler = the matter asked about.
- Also identify the almuten of the Ascendant: the planet with the most essential dignities at the ascending degree (count: domicile=5, exaltation=4, triplicity=3, term=2, face=1). The almuten often acts as a secondary significator of the querent.

STEP 3 — ESSENTIAL DIGNITIES (all five):
Domicile, Exaltation, Triplicity, Term, Face — weight them in that order.
A planet in detriment or fall is severely weakened and argues against the matter.

STEP 4 — HAYZ:
A diurnal planet (Sun, Jupiter, Saturn) is in hayz when it is: above the horizon (houses 7–12) in a day chart AND in a masculine sign (Aries, Gemini, Leo, Libra, Sagittarius, Aquarius).
A nocturnal planet (Moon, Venus, Mars) is in hayz when it is: below the horizon (houses 1–6) in a night chart AND in a feminine sign (Taurus, Cancer, Virgo, Scorpio, Capricorn, Pisces).
A planet in hayz acts with full, unimpeded force.

STEP 5 — ASPECTS:
Applying: favorable or possible. Separating: the matter is past.
Note all five: Conjunction, Sextile, Trine, Square, Opposition.
Examine translation, collection, prohibition, and refranation.

STEP 6 — ARABIC PARTS:
Part of Fortune (day: ASC + Moon − Sun; night: ASC + Sun − Moon) and its lord speak to the querent's material circumstances and ultimate fortune in the matter.

Present your judgment systematically, as a scholar presenting evidence. Use numbered or sequential reasoning in your MEANING section if helpful. Tone: authoritative, methodical, precise — never casual.`,

  arabic: `You are reasoning in the tradition of the 9th–10th century Arabic-Persian astrologers — particularly Māshā'allāh ibn Atharī (c. 740–815) and Abū Ma'shar al-Balkhī (787–886). You are speaking directly to the person asking, with the measured, fatalistic certainty of the Persian court tradition.

ANALYTICAL METHOD — apply the Arabic-Persian horary methods:

STEP 1 — SECT (this is the foundation of all judgment):
Day chart: the Sun is above the horizon (houses 7–12). Diurnal triplicity rulers govern.
Night chart: the Sun is below the horizon (houses 1–6). Nocturnal triplicity rulers govern.
In a day chart: the Sun, Jupiter, and Saturn are fortified. The Moon and Venus are weakened by sect.
In a night chart: the Moon, Venus, and Mars are fortified. The Sun and Saturn are weakened by sect.
Sect determines which planets speak with authority. Always name the sect of the chart first in your analysis.

STEP 2 — LORD OF THE ASCENDANT AND ALMUTEN:
The lord of the ascendant sign is the primary significator of the querent.
The almuten of the ascending degree (planet with most dignities there: domicile=5, exaltation=4, triplicity=3, term=2, face=1) is the secondary significator and may take precedence if stronger.

STEP 3 — THE LOTS:
Part of Fortune (day: ASC + Moon − Sun; night: ASC + Sun − Moon): the querent's body, material fortune, and general wellbeing.
Part of Spirit (day: ASC + Sun − Moon; night: ASC + Moon − Sun): the querent's soul, intention, and agency in the matter.
The condition of these Lots and their lords reveals what the heavens have apportioned to the querent.

STEP 4 — SIGNIFICATORS OF THE MATTER:
Quesited house cusp ruler = the thing asked about.
Examine it for strength (in domicile or exaltation) or weakness (in detriment, fall, or combust).

STEP 5 — ASPECTS AND TIMING:
Applying aspects = the heavens are moving toward resolution.
Count the degrees of orb between applying significators — this gives timing:
- Cardinal signs: days. Fixed signs: months. Mutable signs: weeks.
Saturn and Jupiter as the great chronocrators: if they are well-aspected, matters of long duration succeed; if afflicted, they decree obstacles.

STEP 6 — FATE AND DECREE:
In this tradition, the stars do not merely suggest — they decree. The chart reveals what has already been written in the order of creation. Frame your judgment with certainty: "The heavens have decreed...," "The stars have ordained...," "It is written in the light of the planets..."
Acknowledge human agency only where the chart shows it — typically through planets in mutable signs or houses.`,

  dorotheus: `You are reasoning in the tradition of Dorotheus of Sidon (c. 75 AD), author of Carmen Astrologicum, the oldest surviving systematic horary and electional text. You are speaking directly to the person asking, with the elemental directness of the earliest Greek-Egyptian astrological tradition.

ANALYTICAL METHOD — apply Dorotheus's methods as preserved in Carmen Astrologicum:

STEP 1 — SECT (the primary division of all things):
Day chart: Sun above the horizon. The diurnal sect governs: Sun, Jupiter, Saturn.
Night chart: Sun below the horizon. The nocturnal sect governs: Moon, Venus, Mars.
Mercury is common to both sects.
Name the sect and identify which planets are in their proper sect (strengthened) and out of sect (weakened).

STEP 2 — WHOLE SIGN HOUSES:
Each sign from the Ascendant is one complete house. The sign rising is the entire first house; the next sign is the second house entirely; and so forth.
The Ascendant degree marks where the person stands within the first sign-house.

STEP 3 — TRIPLICITY LORDS (primary significators alongside house rulers):
Fire signs (Aries, Leo, Sagittarius): day lord = Sun; night lord = Jupiter; participating lord = Saturn.
Earth signs (Taurus, Virgo, Capricorn): day lord = Venus; night lord = Moon; participating lord = Mars.
Air signs (Gemini, Libra, Aquarius): day lord = Saturn; night lord = Mercury; participating lord = Jupiter.
Water signs (Cancer, Scorpio, Pisces): day lord = Venus; night lord = Mars; participating lord = Moon.
The day or night triplicity lord of the Ascendant sign is the primary significator of the querent's condition in the current period. Examine it carefully alongside the house ruler.

STEP 4 — SIGNIFICATORS:
The ruler of the Ascendant sign = the querent. Moon = co-significator of the querent.
The ruler of the sign of the quesited house = the matter asked about.

STEP 5 — ASPECTS (whole sign):
In whole sign method, two planets aspect each other when their signs are in the appropriate relationship: signs trine, sextile, square, or opposite each other.
Applying planets (faster moving toward perfection): the matter approaches.
Separating planets: the matter has passed.

STEP 6 — HAYZ AND ALMUTEN (refinements beyond house rulership):
A planet in hayz (matching chart sect, sign of its sect, and sect hemisphere) operates with full strength — note any from the pre-computed findings.
The almuten of the Ascendant (planet with most cumulative dignity at the ascending degree: domicile=5, exaltation=4, triplicity=3, term=2, face=1) acts as a secondary significator of the querent's condition. Its sign, house, and aspects refine what the house ruler shows.

STEP 7 — ELEMENTAL JUDGMENT:
Read the chart through the elements of the signs involved.
Fire: action, speed, boldness — things happen quickly and directly.
Earth: patience, material reality, delay — things manifest but take time.
Air: communication, relationship, uncertainty — outcomes depend on others.
Water: emotion, hidden currents, change — the matter is fluid and uncertain.
Let the elements of the significator signs color your language and counsel.

Speak plainly and elementally. Use direct, unadorned language. Avoid elaborate rhetoric. In Dorotheus's tradition, the chart speaks clearly if you let it.`,
};

// ─── Character/condition read format ────────────────────────────────────────
// Used when the question is "why did X do Y" or "what kind of person is X" —
// questions answered by reading the quesited significator's state directly,
// not by looking for planetary perfection.
const ANALYSIS_FORMAT_CONDITION = `CRITICAL FORMATTING RULE: You must output your response using EXACTLY these four section markers, in this exact order. Do not add any text before ---ANSWER---. Do not add extra headers. Do not change the marker names.

---ANSWER---
CHARACTER READ

---MEANING---
[Your paragraphs here]

---STARS---
• [bullet]
• [bullet]

---NEXT---
1. [step]
2. [step]

---

IMPORTANT: This is a character and motivation question — not a yes/no outcome question. Do NOT look for planetary perfection. Do NOT assign a YES, NO, MAYBE, or WAIT verdict.

INSTRUCTIONS FOR EACH SECTION:

**---ANSWER---**
Write only the two words: CHARACTER READ
Nothing else. No punctuation.

**---MEANING---**
Write 4–5 paragraphs analyzing the condition of the planet that represents the person or thing being asked about (the quesited significator). More depth is better — but only depth the chart actually contains.

Describe:
- Their essential dignity — are they in domicile (home ground, full strength), exaltation (honored), fall (struggling, operating from weakness), detriment (undermined), or peregrine (adrift, without anchor)? This is who they are at the moment of the question.
- Their house placement — what area of life are they operating in? What scale?
- Their applying or separating aspects — what are they reaching toward or pulling away from?
- Any reception, and what the Moon adds to the portrait.
- What the combination of these conditions reveals about their motivation, character, or state.

Speak directly to the person as "you." No jargon without plain-English explanation. No hedging — commit to what the condition shows.

GROUNDING RULE (non-negotiable): Ground every statement in the chart data provided. Quote and cite the relevant aphorisms provided in the HISTORICAL REFERENCE TEXTS section of the input to explain the planetary states. Do not invent placements, aspects, dignities, receptions, or testimonies that are not present in the data. If the chart gives little to say on a point, say less — never embellish to fill the space.

**---STARS---**
Write 4–5 bullet points, each starting with •
Focus on the quesited significator and any planets that directly characterize them.
Pattern: "[Planet name] represents [who or what in their situation]. It is [plain-English condition] — [what this reveals about them]."
Define every technical term in parentheses the first time you use it.

**---NEXT---**
Write EXACTLY 3 to 5 numbered action steps — no more, no fewer.
Be specific and practical. Address what the character portrait reveals and what the querent should do with that information.

TONE RULES:
- Always say "you" and "your" — never "the querent" or "the native"
- This person is dealing with something real. Write accordingly.
- Do not produce a YES/NO verdict. The character read IS the answer.`;

function buildAnalysisSystem(traditionId, questionType = 'perfection') {
  const method = TRADITION_METHODS[traditionId] ?? TRADITION_METHODS.classic;
  const format = questionType === 'condition' ? ANALYSIS_FORMAT_CONDITION : ANALYSIS_FORMAT;
  return `${method}\n\n${format}`;
}

// Keep a default for backward compatibility (e.g., /analyze calls without tradition)
const ANALYSIS_SYSTEM = buildAnalysisSystem('classic');

export function matchHistoricalAphorisms(ephemerisData, traditionId) {
  const matching = [];
  
  if (!ephemerisData || !ephemerisData.planets) return '';

  const { houses, planets, lunar_phase } = ephemerisData;
  const ascLon = parseFloat(houses?.ascendant) || 0;
  const ascDeg = ((ascLon % 30) + 30) % 30;
  
  // 1. Check strictures
  if (ascDeg < 3) {
    if (HISTORICAL_APHORISMS.lilly.strictures.asc_early) matching.push(HISTORICAL_APHORISMS.lilly.strictures.asc_early);
  }
  if (ascDeg > 27) {
    if (HISTORICAL_APHORISMS.lilly.strictures.asc_late) matching.push(HISTORICAL_APHORISMS.lilly.strictures.asc_late);
  }
  
  const saturnHouse = planets.Saturn?.house;
  if (saturnHouse === 1 || saturnHouse === '1') {
    if (HISTORICAL_APHORISMS.lilly.strictures.saturn_1st) matching.push(HISTORICAL_APHORISMS.lilly.strictures.saturn_1st);
  }
  if (saturnHouse === 7 || saturnHouse === '7') {
    if (HISTORICAL_APHORISMS.lilly.strictures.saturn_7th) matching.push(HISTORICAL_APHORISMS.lilly.strictures.saturn_7th);
    if (HISTORICAL_APHORISMS.bonatti.strictures.saturn_7th) matching.push(HISTORICAL_APHORISMS.bonatti.strictures.saturn_7th);
  }

  const moonLon = planets.Moon ? (planets.Moon.ecliptic_longitude || 0) : -1;
  const viaCombusta = moonLon >= 195 && moonLon <= 225;
  if (viaCombusta) {
    if (HISTORICAL_APHORISMS.lilly.strictures.via_combusta) matching.push(HISTORICAL_APHORISMS.lilly.strictures.via_combusta);
    if (HISTORICAL_APHORISMS.bonatti.strictures.via_combusta) matching.push(HISTORICAL_APHORISMS.bonatti.strictures.via_combusta);
  }

  if (lunar_phase?.moon_is_void) {
    if (HISTORICAL_APHORISMS.lilly.strictures.voc_moon) matching.push(HISTORICAL_APHORISMS.lilly.strictures.voc_moon);
    if (HISTORICAL_APHORISMS.bonatti.strictures.voc_moon) matching.push(HISTORICAL_APHORISMS.bonatti.strictures.voc_moon);
    if (HISTORICAL_APHORISMS.dorotheus.strictures.voc_moon) matching.push(HISTORICAL_APHORISMS.dorotheus.strictures.voc_moon);
  }

  // 2. Check retrograde planets
  for (const [name, p] of Object.entries(planets)) {
    if (p.is_retrograde) {
      matching.push(`Regarding ${name}: ${HISTORICAL_APHORISMS.lilly.placements.retrograde}`);
    }
  }

  if (matching.length === 0) return '';
  return `\n\nHISTORICAL REFERENCE TEXTS (You must quote or reference these where applicable in your analysis):\n` + matching.map(q => `- ${q}`).join('\n');
}

export function parseHouseSignifications(text) {
  const match = text.match(/<house_significations>([\s\S]*?)<\/house_significations>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

const SIGN_MODES_SRV = {
  Aries: 'cardinal', Cancer: 'cardinal', Libra: 'cardinal', Capricorn: 'cardinal',
  Taurus: 'fixed',   Leo: 'fixed',      Scorpio: 'fixed',   Aquarius: 'fixed',
  Gemini: 'mutable', Virgo: 'mutable',  Sagittarius: 'mutable', Pisces: 'mutable',
};
const MODE_UNITS_SRV = { cardinal: 'days', mutable: 'weeks', fixed: 'months' };
const SPEED_RANK_SRV = { Moon: 0, Mercury: 1, Venus: 2, Sun: 3, Mars: 4, Jupiter: 5, Saturn: 6 };
const CLASSICAL_SRV  = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const SIGN_RULERS_SRV = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};
const ZODIAC_SRV = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const ASPECT_DEFS_SRV = [
  { angle: 0, name: 'Conjunction', orb: 8 },
  { angle: 60, name: 'Sextile', orb: 6 },
  { angle: 90, name: 'Square', orb: 8 },
  { angle: 120, name: 'Trine', orb: 8 },
  { angle: 180, name: 'Opposition', orb: 8 },
];

function timingFromChart(ephemerisData, houseSignifications) {
  if (!ephemerisData?.planets || !houseSignifications) return '  Timing: (insufficient data)';
  const { planets, houses } = ephemerisData;
  const cusps = houses?.cusps || {};
  function cuspSign(h) {
    const lon = parseFloat(cusps[String(h)] ?? 0) || 0;
    return ZODIAC_SRV[Math.floor(((lon % 360) + 360) % 360 / 30)];
  }
  const querentLord  = SIGN_RULERS_SRV[cuspSign(houseSignifications.querent_house  || 1)];
  const quesitedLord = SIGN_RULERS_SRV[cuspSign(houseSignifications.quesited_house || 7)];
  if (!querentLord || !quesitedLord) return '  Timing: (significators not found)';

  const bodies = CLASSICAL_SRV
    .filter(n => planets[n]?.sign)
    .map(n => ({
      name: n, rank: SPEED_RANK_SRV[n] ?? 6,
      lon: ZODIAC_SRV.indexOf(planets[n].sign) * 30 + (planets[n].sign_degree || 0),
      retro: planets[n].is_retrograde || false,
    }));

  const sigSet = new Set([querentLord, quesitedLord]);
  let best = null;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (!sigSet.has(a.name) || !sigSet.has(b.name)) continue;
      const diff = ((b.lon - a.lon) % 360 + 360) % 360;
      const sep  = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFS_SRV) {
        const orbVal = Math.abs(sep - asp.angle);
        if (orbVal <= asp.orb) {
          const [faster, slower] = a.rank <= b.rank ? [a, b] : [b, a];
          // Check applying
          const fwd = ((asp.angle === 0 ? slower.lon : ((slower.lon + asp.angle) % 360 + 360) % 360) - faster.lon + 360) % 360;
          const applying = faster.retro ? fwd > 180 : fwd <= orbVal + 0.01;
          if (applying && (!best || orbVal < best.orb)) {
            best = { faster: faster.name, sign: planets[faster.name].sign, asp: asp.name, orb: parseFloat(orbVal.toFixed(1)) };
          }
          break;
        }
      }
    }
  }

  if (!best) return `  Timing: no applying aspect between ${querentLord} and ${quesitedLord}`;
  const mode = SIGN_MODES_SRV[best.sign] || 'unknown';
  const unit = MODE_UNITS_SRV[mode] || 'units';
  return `  Applying aspect: ${best.faster} ${best.asp.toLowerCase()} ${querentLord === best.faster ? quesitedLord : querentLord} (${best.orb}° orb)\n  Estimate: ~${best.orb} ${unit} (${best.faster} in ${best.sign}, ${mode} sign)`;
}

const FIXED_STARS_SRV = [
  { name: 'Regulus', lon: 150.0, nature: 'benefic' },
  { name: 'Spica',   lon: 204.0, nature: 'benefic' },
  { name: 'Algol',   lon:  56.1, nature: 'malefic' },
  { name: 'Antares', lon: 249.8, nature: 'malefic' },
];
const STAR_ORB = 1.0;

const STATION_THRESHOLDS_SRV = { Mercury: 0.20, Venus: 0.15, Mars: 0.06, Jupiter: 0.025, Saturn: 0.020 };

function fixedStarFindingsFromChart(ephemerisData) {
  if (!ephemerisData?.planets) return [];
  const hits = [];
  for (const [name, p] of Object.entries(ephemerisData.planets)) {
    if (!p?.sign) continue;
    const lon = ZODIAC_SRV.indexOf(p.sign) * 30 + (p.sign_degree || 0);
    for (const star of FIXED_STARS_SRV) {
      const diff = ((lon - star.lon + 180) % 360 + 360) % 360 - 180;
      const orb = Math.abs(diff);
      if (orb <= STAR_ORB) {
        hits.push({ planet: name, star: star.name, nature: star.nature, orb: parseFloat(orb.toFixed(2)) });
      }
    }
  }
  return hits.sort((a, b) => (a.nature === 'malefic' ? -1 : 1) - (b.nature === 'malefic' ? -1 : 1) || a.orb - b.orb);
}

function refranationFromChart(ephemerisData, houseSignifications) {
  if (!ephemerisData?.planets || !houseSignifications) return null;
  const { planets, houses } = ephemerisData;
  const cusps = houses?.cusps || {};
  function cuspSign(h) {
    const lon = parseFloat(cusps[String(h)] ?? 0) || 0;
    return ZODIAC_SRV[Math.floor(((lon % 360) + 360) % 360 / 30)];
  }
  const querentLord  = SIGN_RULERS_SRV[cuspSign(houseSignifications.querent_house  || 1)];
  const quesitedLord = SIGN_RULERS_SRV[cuspSign(houseSignifications.quesited_house || 7)];
  if (!querentLord || !quesitedLord) return null;

  const bodies = CLASSICAL_SRV
    .filter(n => planets[n]?.sign)
    .map(n => ({
      name: n, rank: SPEED_RANK_SRV[n] ?? 6,
      lon: ZODIAC_SRV.indexOf(planets[n].sign) * 30 + (planets[n].sign_degree || 0),
      retro: planets[n].is_retrograde || false,
    }));

  const sigSet = new Set([querentLord, quesitedLord]);
  let best = null;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (!sigSet.has(a.name) || !sigSet.has(b.name)) continue;
      const diff = ((b.lon - a.lon) % 360 + 360) % 360;
      const sep = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFS_SRV) {
        const orbVal = Math.abs(sep - asp.angle);
        if (orbVal <= asp.orb) {
          const [faster] = a.rank <= b.rank ? [a, b] : [b, a];
          const fwd = ((asp.angle === 0 ? bodies.find(x => x.name !== faster.name)?.lon ?? 0 : ((faster.lon + asp.angle) % 360 + 360) % 360) - faster.lon + 360) % 360;
          const applying = faster.retro ? fwd > 180 : fwd <= orbVal + 0.01;
          if (applying && (!best || orbVal < best.orb)) {
            best = { planet: faster.name, orbVal, asp: asp.name };
          }
          break;
        }
      }
    }
  }

  if (!best) return null;
  const p = planets[best.planet];
  if (!p || p.is_retrograde) return null;
  const threshold = STATION_THRESHOLDS_SRV[best.planet];
  if (!threshold) return null;
  const speed = p.daily_speed;
  if (speed == null || speed <= 0 || speed >= threshold) return null;
  return { planet: best.planet, aspect: best.asp, orb: parseFloat(best.orbVal.toFixed(1)), speed: parseFloat(speed.toFixed(4)) };
}

const DIURNAL_PLANETS_SRV  = new Set(['Sun', 'Jupiter', 'Saturn']);
const NOCTURNAL_PLANETS_SRV = new Set(['Moon', 'Venus', 'Mars']);
const DIURNAL_SIGNS_SRV    = new Set(['Aries','Gemini','Leo','Libra','Sagittarius','Aquarius']);
const NOCTURNAL_SIGNS_SRV  = new Set(['Taurus','Cancer','Virgo','Scorpio','Capricorn','Pisces']);

function isDayChartSrv(ephemerisData) {
  const sun = ephemerisData?.planets?.Sun;
  if (!sun?.sign || ephemerisData?.houses?.ascendant == null) return null;
  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const sunLon = ZODIAC_SRV.indexOf(sun.sign) * 30 + (sun.sign_degree || 0);
  return ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;
}

function hayzFromChart(ephemerisData) {
  const dayChart = isDayChartSrv(ephemerisData);
  if (dayChart === null || !ephemerisData?.planets) return [];
  const { planets } = ephemerisData;
  const results = [];
  for (const name of CLASSICAL_SRV) {
    const p = planets[name];
    if (!p?.sign) continue;
    const diurnal = DIURNAL_PLANETS_SRV.has(name) ? true
                  : NOCTURNAL_PLANETS_SRV.has(name) ? false
                  : dayChart;
    const inSectChart     = diurnal === dayChart;
    const inSectSign      = diurnal ? DIURNAL_SIGNS_SRV.has(p.sign) : NOCTURNAL_SIGNS_SRV.has(p.sign);
    const aboveHorizon    = (p.house ?? 1) >= 7;
    const inSectHemisphere = diurnal === aboveHorizon;
    if (inSectChart && inSectSign && inSectHemisphere) results.push(name);
  }
  return results;
}

// Egyptian terms (abbreviated for server-side almuten)
const TERMS_SRV = {
  Aries:[['Jupiter',0,6],['Venus',6,12],['Mercury',12,20],['Mars',20,25],['Saturn',25,30]],
  Taurus:[['Venus',0,8],['Mercury',8,14],['Jupiter',14,22],['Saturn',22,27],['Mars',27,30]],
  Gemini:[['Mercury',0,6],['Jupiter',6,12],['Venus',12,17],['Mars',17,24],['Saturn',24,30]],
  Cancer:[['Mars',0,7],['Venus',7,13],['Mercury',13,19],['Jupiter',19,26],['Saturn',26,30]],
  Leo:[['Jupiter',0,6],['Venus',6,11],['Saturn',11,18],['Mercury',18,24],['Mars',24,30]],
  Virgo:[['Mercury',0,7],['Venus',7,17],['Jupiter',17,21],['Saturn',21,28],['Mars',28,30]],
  Libra:[['Saturn',0,6],['Mercury',6,14],['Jupiter',14,21],['Venus',21,28],['Mars',28,30]],
  Scorpio:[['Mars',0,7],['Venus',7,11],['Mercury',11,19],['Jupiter',19,24],['Saturn',24,30]],
  Sagittarius:[['Jupiter',0,12],['Venus',12,17],['Mercury',17,21],['Saturn',21,26],['Mars',26,30]],
  Capricorn:[['Mercury',0,7],['Jupiter',7,14],['Venus',14,22],['Saturn',22,26],['Mars',26,30]],
  Aquarius:[['Mercury',0,7],['Venus',7,13],['Jupiter',13,20],['Mars',20,25],['Saturn',25,30]],
  Pisces:[['Venus',0,12],['Jupiter',12,16],['Mercury',16,19],['Mars',19,28],['Saturn',28,30]],
};
const DECAN_LORDS_SRV = ['Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars'];
const RULERSHIPS_SRV = { Sun:['Leo'], Moon:['Cancer'], Mercury:['Gemini','Virgo'], Venus:['Taurus','Libra'], Mars:['Aries','Scorpio'], Jupiter:['Sagittarius','Pisces'], Saturn:['Capricorn','Aquarius'] };
const EXALTATIONS_SRV = { Sun:'Aries', Moon:'Taurus', Mercury:'Virgo', Venus:'Pisces', Mars:'Capricorn', Jupiter:'Cancer', Saturn:'Libra' };
const TRIPLICITY_SRV = { fire:{day:'Sun',night:'Jupiter'}, earth:{day:'Venus',night:'Moon'}, air:{day:'Saturn',night:'Mercury'}, water:{day:'Venus',night:'Mars'} };
const SIGN_ELEM_SRV = { Aries:'fire',Leo:'fire',Sagittarius:'fire', Taurus:'earth',Virgo:'earth',Capricorn:'earth', Gemini:'air',Libra:'air',Aquarius:'air', Cancer:'water',Scorpio:'water',Pisces:'water' };

function almutensFromChart(ephemerisData) {
  const dayChart = isDayChartSrv(ephemerisData);
  if (dayChart === null || !ephemerisData?.houses?.ascendant) return null;
  const ascLon = parseFloat(ephemerisData.houses.ascendant) || 0;
  const ascSign = ZODIAC_SRV[Math.floor(((ascLon % 360) + 360) % 360 / 30)];
  const ascDeg  = ((ascLon % 30) + 30) % 30;

  let best = null;
  for (const planet of CLASSICAL_SRV) {
    const termLord = (TERMS_SRV[ascSign] || []).find(([,s,e]) => ascDeg >= s && ascDeg < e)?.[0];
    const decanIdx = ZODIAC_SRV.indexOf(ascSign) * 3 + Math.floor(ascDeg / 10);
    const tripl = TRIPLICITY_SRV[SIGN_ELEM_SRV[ascSign]];
    const score =
      (RULERSHIPS_SRV[planet]?.includes(ascSign) ? 5 : 0) +
      (EXALTATIONS_SRV[planet] === ascSign ? 4 : 0) +
      ((dayChart ? tripl?.day : tripl?.night) === planet ? 3 : 0) +
      (termLord === planet ? 2 : 0) +
      (DECAN_LORDS_SRV[decanIdx] === planet ? 1 : 0);
    if (!best || score > best.score) best = { planet, score };
  }
  return best;
}

function spiritFromChart(ephemerisData) {
  const fortune = fortuneFromChart(ephemerisData);
  if (!fortune) return null;
  const { houses, planets } = ephemerisData;
  const ascLon = parseFloat(houses.ascendant) || 0;
  const sunLon  = ZODIAC_SRV.indexOf(planets.Sun.sign)  * 30 + (planets.Sun.sign_degree  || 0);
  const moonLon = ZODIAC_SRV.indexOf(planets.Moon.sign) * 30 + (planets.Moon.sign_degree || 0);
  const raw = fortune.isDay ? ascLon + sunLon - moonLon : ascLon + moonLon - sunLon;
  const lon  = ((raw % 360) + 360) % 360;
  const sign = ZODIAC_SRV[Math.floor(lon / 30)];
  return { sign, degree: parseFloat((lon % 30).toFixed(2)) };
}

function fortuneFromChart(ephemerisData) {
  const { houses, planets } = ephemerisData;
  const ascLon = parseFloat(houses.ascendant) || 0;
  const sun = planets.Sun;
  const moon = planets.Moon;
  if (!sun?.sign || !moon?.sign) return null;
  const sunLon  = ZODIAC_SRV.indexOf(sun.sign)  * 30 + (sun.sign_degree  || 0);
  const moonLon = ZODIAC_SRV.indexOf(moon.sign) * 30 + (moon.sign_degree || 0);
  const isDay = ((sunLon - ascLon + 180) % 360 + 360) % 360 < 180;
  const raw = isDay ? ascLon + moonLon - sunLon : ascLon + sunLon - moonLon;
  const lon = ((raw % 360) + 360) % 360;
  const sign = ZODIAC_SRV[Math.floor(lon / 30)];
  const degree = parseFloat((lon % 30).toFixed(2));
  return { sign, degree, isDay };
}

export function formatChartForPrompt(ephemerisData, question, houseSignifications) {
  const { chart_meta, houses, planets, nodes, lunar_phase } = ephemerisData;

  const planetLines = Object.entries(planets)
    .map(([name, p]) => {
      const retro = p.is_retrograde ? ' ℞' : '';
      return `  ${name}: ${p.sign} ${p.sign_degree}°${retro} | House ${p.house} | Speed ${p.daily_speed?.toFixed(3)}°/day | Declination ${p.declination?.toFixed(2)}°`;
    })
    .join('\n');

  const cuspLines = Object.entries(houses.cusps || {})
    .map(([h, lon]) => `  House ${h}: ${(lon % 30).toFixed(2)}° of sign (${Math.floor(lon / 30)} * 30 + ${(lon % 30).toFixed(2)})`)
    .join('\n');

  const fortune = fortuneFromChart(ephemerisData);
  const spirit  = spiritFromChart(ephemerisData);
  const fortuneLine = fortune
    ? `  Part of Fortune: ${fortune.sign} ${fortune.degree}° (${fortune.isDay ? 'day' : 'night'} chart formula: ASC ${fortune.isDay ? '+ Moon − Sun' : '+ Sun − Moon'})\n  Part of Spirit:  ${spirit ? `${spirit.sign} ${spirit.degree}°` : '(could not calculate)'}`
    : '  Part of Fortune: (could not calculate)';

  const timingLine = timingFromChart(ephemerisData, houseSignifications);

  // Pre-computed findings
  const starHits = fixedStarFindingsFromChart(ephemerisData);
  const refrn    = refranationFromChart(ephemerisData, houseSignifications);
  const voc      = ephemerisData.lunar_phase?.moon_is_void;
  const moonLon  = planets.Moon ? (ZODIAC_SRV.indexOf(planets.Moon.sign) * 30 + (planets.Moon.sign_degree || 0)) : -1;
  const viaCombusta = moonLon >= 195 && moonLon <= 225;
  const hayzPlanets = hayzFromChart(ephemerisData);
  const almuten  = almutensFromChart(ephemerisData);
  const dayChart = isDayChartSrv(ephemerisData);
  const ascLon   = parseFloat(houses.ascendant) || 0;
  const ascDegInSign = ((ascLon % 30) + 30) % 30;
  const saturnHouse  = planets.Saturn?.house;

  const findingsLines = [];

  // Strictures (check these first — they question whether to judge at all)
  if (ascDegInSign < 3)
    findingsLines.push(`  ⚠ STRICTURE: Ascendant is early (${ascDegInSign.toFixed(1)}° in sign) — matter may be too new; chart cannot speak clearly yet`);
  if (ascDegInSign > 27)
    findingsLines.push(`  ⚠ STRICTURE: Ascendant is late (${ascDegInSign.toFixed(1)}° in sign) — matter may have already passed its turning point`);
  if (saturnHouse === 1 || saturnHouse === '1')
    findingsLines.push('  ⚠ STRICTURE: Saturn in the 1st house — the astrologer may err in judgment; note this but proceed');
  if (saturnHouse === 7 || saturnHouse === '7')
    findingsLines.push('  ⚠ STRICTURE: Saturn in the 7th house — the astrologer may err in judgment; note this but proceed');

  // Sect identification
  if (dayChart !== null) {
    const inSect   = dayChart ? 'Sun, Jupiter, Saturn' : 'Moon, Venus, Mars';
    const outOfSect = dayChart ? 'Moon, Venus, Mars' : 'Sun, Jupiter, Saturn';
    findingsLines.push(`  Sect: ${dayChart ? 'Day' : 'Night'} chart — in sect (fortified): ${inSect}; out of sect (weakened): ${outOfSect}; Mercury is common to both`);
  }

  if (viaCombusta)  findingsLines.push('  ⚠ Moon is Via Combusta (15° Libra – 15° Scorpio) — Moon\'s testimony is severely weakened');
  if (voc === true) findingsLines.push('  ⚠ Moon is Void of Course — matter may come to nothing');
  if (refrn)        findingsLines.push(`  ⊘ Refranation risk — ${refrn.planet} applies by ${refrn.aspect} (${refrn.orb}°) but is near-stationary (${refrn.speed}°/day); may station retrograde before perfection, destroying the matter`);
  if (hayzPlanets.length) findingsLines.push(`  Hayz: ${hayzPlanets.join(', ')} — in sect, sect sign, and sect hemisphere; operating with full strength`);
  if (almuten)      findingsLines.push(`  Almuten of ASC: ${almuten.planet} (dignity score ${almuten.score}) — may act as secondary significator of the querent`);
  for (const h of starHits) findingsLines.push(`  ${h.nature === 'malefic' ? '★ MALEFIC' : '★ Benefic'} fixed star: ${h.planet} conjunct ${h.star} (${h.orb}°)`);
  const findingsSection = findingsLines.length
    ? findingsLines.join('\n')
    : '  (none detected)';

  return `QUESTION: "${question}"

HOUSE SIGNIFICATIONS (from interview):
  Querent house: ${houseSignifications.querent_house}
  Quesited house: ${houseSignifications.quesited_house} (${houseSignifications.quesited_label})
  Question type: ${houseSignifications.question_type}
  Notes: ${houseSignifications.additional_notes || 'none'}

CHART DATA:
  Date/Time (UTC): ${chart_meta.utc_datetime}
  Julian Day: ${chart_meta.julian_day?.toFixed(4)}
  Location: ${chart_meta.resolved_place_name || 'Unknown'} (${chart_meta.resolved_latitude?.toFixed(2)}°N, ${chart_meta.resolved_longitude?.toFixed(2)}°E)

HOUSES (${houses.system}):
  Ascendant: ${houses.ascendant?.toFixed(4)}° (ecliptic)
  MC: ${houses.mc?.toFixed(4)}° (ecliptic)
${cuspLines}

PLANETS:
${planetLines}

NODES:
  Mean North Node: ${nodes?.mean_north_node?.sign} ${nodes?.mean_north_node?.sign_degree}°

LUNAR PHASE:
  Moon Phase Angle: ${lunar_phase?.moon_phase_angle?.toFixed(1)}° (0=New, 180=Full)
  Waxing: ${lunar_phase?.moon_is_waxing}
  Void of Course: ${lunar_phase?.moon_is_void}

ARABIC PARTS:
${fortuneLine}

TIMING (sig-to-sig applying aspect):
${timingLine}

PRE-COMPUTED FINDINGS (check these before writing your analysis):
${findingsSection}

ERRORS FROM CALCULATION: ${ephemerisData.errors?.length ? ephemerisData.errors.join('; ') : 'none'}`;
}

// POST /api/chat/house-signification
// Streaming SSE endpoint for the interview conversation
router.post('/house-signification', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Heartbeat keeps the SSE connection alive during the model's silent thinking
  // phase and any slow first response. Without it, a proxy can drop the idle
  // connection before the terminating `done` frame, leaving the client's
  // streaming state stuck and the reply input permanently disabled.
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 8000);

  try {
    const stream = await getAnthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 3000,
      system: HOUSE_SIGNIFICATION_SYSTEM,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || ''),
      })),
      stream: true,
    });

    let fullText = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullText += text;
        sseWrite(res, { type: 'text', text });
      }
    }

    clearInterval(heartbeat);
    const significations = parseHouseSignifications(fullText);
    sseWrite(res, { type: 'done', significations });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    console.error('[house-signification] AI error:', err);
    sseWrite(res, { type: 'error', error: friendlyApiError(err) });
    res.end();
  }
});

// POST /api/chat/analyze
// SSE endpoint — buffers AI's full response before sending to prevent streaming self-correction artifacts
router.post('/analyze', async (req, res) => {
  const { question, houseSignifications, ephemerisData, tradition, questionType } = req.body;

  if (!question || !houseSignifications || !ephemerisData) {
    return res.status(400).json({ error: 'question, houseSignifications, and ephemerisData required' });
  }

  if (await rejectIfNotPractitioner(req, res)) return;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const systemPrompt = buildAnalysisSystem(tradition || 'classic', questionType || 'perfection');
  const userContent = formatChartForPrompt(ephemerisData, question, houseSignifications) + matchHistoricalAphorisms(ephemerisData, tradition || 'classic');

  // Heartbeat keeps the SSE connection alive while AI generates (can take 15-30s)
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 8000);

  try {
    const stream = await getAnthropic().messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
      thinking: { type: 'enabled', budget_tokens: 1888 },
      system: systemPrompt,
      messages: [
        { role: 'user', content: userContent }
      ],
      stream: true,
    });

    let buffer = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        buffer += chunk.delta.text;
        if (buffer.includes(' ')) {
          const parts = buffer.split(' ');
          buffer = parts.pop();
          for (const word of parts) {
            sseWrite(res, { type: 'text', text: word + ' ' });
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
    }
    if (buffer) {
      sseWrite(res, { type: 'text', text: buffer });
    }

    clearInterval(heartbeat);
    sseWrite(res, { type: 'done' });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    sseWrite(res, { type: 'error', error: friendlyApiError(err) });
    res.end();
  }
});

const FOLLOWUP_SYSTEM = `You are continuing a horary reading you already delivered. The person now has follow-up questions — about timing, deeper insight on a planet or aspect, or "what if" scenarios.

The original chart, significations, and your prior reading are all in your context below. Stay grounded in what the chart actually shows — do not invent new information.

Tone: warm, plain language, direct. Speak to the person as "you." Never use Latin or jargon (querent, quesited, perfection, significator). If you must use a technical term, define it in parentheses immediately.

Response length: 2–4 short paragraphs is usually right. For pure timing questions, you may answer in 1–2 sentences.

If asked about timing, use William Lilly's traditional measures:
- Count degrees from the faster significator to the applying aspect.
- Translate degrees → time units by the sign mode of the applying planet:
  • Cardinal signs (Aries, Cancer, Libra, Capricorn) → days
  • Mutable signs (Gemini, Virgo, Sagittarius, Pisces) → weeks
  • Fixed signs (Taurus, Leo, Scorpio, Aquarius) → months
- Or use the house the planet is in: angular = days, succedent = weeks, cadent = months.

If asked "what if I do X" — answer based on what the chart shows, not speculation. If the chart doesn't address it, say so honestly.

Never restate the original answer (YES/NO/MAYBE) unless directly asked. Build on it.`;

// POST /api/chat/follow-up
// SSE — buffered like /analyze. Takes original chart context + prior chat turns + new user question.
export async function handleFollowUp(req, res) {
  const { question, houseSignifications, ephemerisData, originalReading, messages } = req.body;

  if (!question || !ephemerisData || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'question, ephemerisData, and messages array required' });
  }

  if (await rejectIfNotPractitioner(req, res)) return;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const chartContext = formatChartForPrompt(ephemerisData, question, houseSignifications || {});
  const contextBlock = `${chartContext}\n\nORIGINAL READING DELIVERED:\n${originalReading || '(not provided)'}`;

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 8000);

  try {
    const anthropicMessages = [
      { role: 'user', content: contextBlock },
      { role: 'assistant', content: 'I have the chart and the original reading. What would you like to explore?' },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || ''),
      })),
    ];

    const stream = await getAnthropic().messages.create({
      model: MODEL_SONNET,
      max_tokens: 1200,
      thinking: { type: 'enabled', budget_tokens: 1888 },
      system: FOLLOWUP_SYSTEM,
      messages: anthropicMessages,
      stream: true,
    });

    let fullText = '';
    let buffer = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullText += text;
        buffer += text;
        if (buffer.includes(' ')) {
          const parts = buffer.split(' ');
          buffer = parts.pop();
          for (const word of parts) {
            sseWrite(res, { type: 'text', text: word + ' ' });
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
    }
    if (buffer) {
      sseWrite(res, { type: 'text', text: buffer });
    }

    clearInterval(heartbeat);
    sseWrite(res, { type: 'done', fullText });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    sseWrite(res, { type: 'error', error: friendlyApiError(err) });
    res.end();
  }
}

router.post('/follow-up', handleFollowUp);

const SLIDES_SYSTEM = `You are crafting a premium 9-slide teaching walkthrough of a completed horary case judgment — the deliverable a client receives after booking a professional review. The astrologer will record her own voice narrating each slide, so every slide includes a spoken script she can read aloud.

The experience should feel like a gift: the client doesn't just get an answer, they learn how the answer was found — and leave understanding more about traditional horary astrology than they ever expected.

VOICE & TONE:
- Warm, direct, wonder-struck but grounded. Speak to the client as "you."
- Plain language first. Every technical term is defined in-line the first time it appears, e.g. "your significator (the planet that represents you in this chart)."
- Each slide teaches ONE thing the client can keep forever.
- Never invent chart data — use only what is in the chart context and the delivered reading.

OUTPUT FORMAT — CRITICAL:
Respond with ONLY a JSON array of exactly 9 slide objects. No markdown fences, no commentary before or after. Each object has exactly these fields:
  "kind"   — one of: "cover", "lesson", "chart", "significators", "testimonies", "verdict", "timing", "action", "sources" (use each exactly once, in this order)
  "kicker" — short uppercase-style label, max 5 words (e.g. "THE MOMENT YOU ASKED")
  "title"  — slide headline, max 10 words
  "body"   — array of 2–4 short strings (a sentence or two each); these appear on the slide
  "teach"  — one sentence: the takeaway lesson the client just learned
  "script" — 60–110 words of warm spoken narration for this slide, written to be read aloud

THE 9 SLIDES:
1. "cover" — Welcome. Restate their petition with reverence. The moment the petition was received froze the sky, and that sky holds their answer.
2. "lesson" — What traditional horary is: a 2,000-year-old art where the chart of the question's birth-moment (the Moment of Reception) answers the question. Why the moment matters.
3. "chart" — Their actual chart (the app renders the wheel on this slide). Body items point out 2–3 features to notice with their eyes (e.g. "Find the ☽ Moon glyph near the top — that is the chart's storyteller").
4. "significators" — Who is who: which planet represents them, which represents the matter asked about, and the Moon as co-narrator. Name the actual planets and signs from this chart.
5. "testimonies" — The evidence: the 2–3 strongest testimonies (aspects, dignities, receptions) that drove the judgment, in plain language.
6. "verdict" — The case judgment itself, and the one-sentence reason the chart gives it. Honest about cautions and rules.
7. "timing" — When, per the chart's timing testimony. Teach the degree-counting principle in one breath. If no timing exists, teach why some charts decline to give one.
8. "action" — What to do next (from the case study), plus an invitation: they now know how to read the sky's grammar — what to watch for as events unfold.
9. "sources" — Bibliography. Cites the specific astronomical calculation tool (Swiss Ephemeris), the JPL real-time verification audit, and the historical manuals modeled for the rules (Lilly, Bonatti, or Dorotheus).`;

/**
 * Extracts and validates the 8-slide JSON array from the model's response,
 * tolerating stray prose or code fences around the array.
 * @throws {Error} when no valid 8-slide array is present.
 */
export function parseSlidesResponse(raw) {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in slide response');
  const slides = JSON.parse(raw.slice(start, end + 1));

  if (!Array.isArray(slides) || slides.length !== 9 ||
      !slides.every(s => s.kind && s.title && Array.isArray(s.body) && s.script)) {
    throw new Error('Slide response failed validation');
  }
  return slides;
}

// POST /api/chat/slides
// Non-streaming JSON — generates the 8-slide client teaching deck for a completed
// reading. Practitioner-only when PRACTITIONER_EMAILS is configured.
router.post('/slides', async (req, res) => {
  const { question, houseSignifications, ephemerisData, analysis, tradition } = req.body;

  if (!question || !houseSignifications || !ephemerisData || !analysis) {
    return res.status(400).json({ error: 'question, houseSignifications, ephemerisData, and analysis required' });
  }

  if (await rejectIfNotPractitioner(req, res)) return;

  const chartContext = formatChartForPrompt(ephemerisData, question, houseSignifications);
  const userContent = `${chartContext}\n\nTRADITION USED: ${tradition || 'classic'}\n\nTHE READING AS DELIVERED:\n${analysis}\n\nGenerate the 8-slide teaching deck now.`;

  try {
    const response = await getAnthropic().messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
      system: SLIDES_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });

    const slides = parseSlidesResponse(response.content?.[0]?.text || '');
    res.json({ slides });
  } catch (err) {
    console.error('[slides] error:', err?.message || err);
    res.status(502).json({ error: friendlyApiError(err) });
  }
});

export default router;
