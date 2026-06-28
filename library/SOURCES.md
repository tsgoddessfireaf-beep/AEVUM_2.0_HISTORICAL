# Aevum Source Library — provenance & licensing ledger

The legal backbone of the library. **Every passage loaded into the corpus must trace to a row here.**
Goal: ingest the *entire* historical horary canon. Not every text is wired into a reading flow on day one —
but it lives in the datastore, embedded and retrievable, ready when the chart (or the practitioner) calls for it.

## License tiers
- **public-domain** → ingest verbatim text directly.
- **our-translation** → translate from a *public-domain ORIGINAL edition* ourselves; the translation is our copyright.
  **Never** translate from a modern copyrighted edition/transcription (Dykes, Zoller, Pingree, Hand).
- **blocked** → no public-domain source exists; stays out until licensed or a PD original surfaces.
- **do-not-use** → present in our files but illegal to embed in a commercial product.

Suggested `tradition_tag` values: `lilly`, `bonatti`, `arabic` (Sahl/Māshā'allāh/Abū Maʿshar/Haly), `dorotheus`,
`classic`, plus new capability tags: `renaissance-en`, `medical` (decumbiture), `compilation`, `foundational`.

---

## TIER A — English originals (clean public-domain, no translation needed)

| Author | Work (edition) | tradition_tag | Best source | Status |
|---|---|---|---|---|
| **William Lilly** | Christian Astrology (London 1647) | `lilly` | [Wikisource](https://en.wikisource.org/wiki/Christian_Astrology) · [archive.org](https://archive.org/details/christian-astrology-1647) · local Drive | ✅ ready |
| **Guido Bonatti** | *Anima Astrologiae* — 146 Considerations (Coley, 1676) | `bonatti` | [archive.org](https://archive.org/details/astrologersguide00lill) · [Skyscript](https://www.skyscript.co.uk/guido146.html) | ✅ ready |
| **Jerome Cardan** | Seven Segments — aphorisms (in the *Anima* volume) | `renaissance-en` | same volume as above | ✅ ready |
| **Claude Dariot** | *Briefe Introduction to the Astrological Judgement of the Starres* (tr. Withers, 1583/1598) | `renaissance-en` | archive.org / EEBO (scan to pin) | ⚙️ locate scan |
| **William Ramesey** | *Astrologia Restaurata* (1653) | `renaissance-en` | archive.org / EEBO (scan to pin) | ⚙️ locate scan |
| **Henry Coley** | *Clavis Astrologiae Elimata* (1676) | `renaissance-en` | archive.org / EEBO (scan to pin) | ⚙️ locate scan |
| **Nicholas Culpeper** | *Astrological Judgement of Diseases* (decumbiture) + *Opus Astrologicum* | `medical` | archive.org (PD) | ⚙️ locate scan |
| **Richard Saunders** | *The Astrological Judgement and Practice of Physick* (1677) | `medical` | archive.org / EEBO | ⚙️ locate scan |
| **John Gadbury** | *Doctrine of Nativities* / *Collectio Geniturarum* (mostly natal) | `renaissance-en` | archive.org / EEBO | ⚙️ optional (natal-leaning) |
| **Raphael** (R.C. Smith) | Horary guides (19th c.) | `renaissance-en` | archive.org (PD) | ⚙️ locate scan |
| **Zadkiel** (R.J. Morrison) | *Grammar of Astrology* / *Handbook* | `renaissance-en` | archive.org (PD) | ⚙️ locate scan |
| **Ptolemy** *(bonus)* | Tetrabiblos (Ashmand tr., 1822) | `foundational` | archive.org (PD) · local Drive | ✅ optional |

## TIER B — Public-domain **Latin** originals (we translate; translation = our copyright)

| Author | Work (PD edition) | tradition_tag | Best source | Status |
|---|---|---|---|---|
| **Sahl ibn Bishr (Zael)** ⭐ | *Introductorium*, *The Fifty Judgments*, *On Questions* | `arabic` | Venice 1493 Latin compilation ([same vol. as Māshāʾallāh](https://data.bnf.fr/16553613/masha_allah_de_receptione/)) | ⚙️ OCR Latin → translate |
| **Māshāʾallāh** | *De Receptione* (On Reception) | `arabic` | Heller, Nuremberg 1549 / Venice 1493 ([BnF](https://data.bnf.fr/16553613/masha_allah_de_receptione/)) | ⚙️ OCR → translate |
| **Guido Bonatti** | *Liber Astronomiae* (full, 10 treatises) | `bonatti` | [1491 Ratdolt incunabulum](https://archive.org/details/guidobonatusdef00bona) | ⚙️ OCR → translate |
| **Haly Abenragel** (ʿAli ibn abi al-Rijal) | *De Judiciis Astrorum* / *Book of the Skilled* | `arabic` | Basel 1551 Latin (scan to pin) | ⚙️ OCR → translate |
| **Alcabitius** (al-Qabīsī) | *Introductorius ad magisterium iudiciorum astrorum* | `foundational` | Latin printings 1480s–1520s | ⚙️ OCR → translate |
| ***Liber Novem Iudicum*** ⭐ | Book of the Nine Judges (horary, by question) | `compilation` | Venice 1509 Latin | ⚙️ OCR → translate |
| **Abū Maʿshar** (Albumasar) | *Introductorium Maius*; *Flores* | `arabic` | Augsburg 1489 / Venice Latin printings | ⚙️ OCR → translate |
| **Al-Kindī** | *De Radiis* (On the Stellar Rays) | `foundational` | Latin MS/printed (PD) | ⚙️ locate → translate |
| **Leopold of Austria** | *Compilatio de astrorum scientia* (1489) | `compilation` | Ratdolt 1489 Latin | ⚙️ optional |
| **Pseudo-Ptolemy** | *Centiloquium* (100 aphorisms) | `foundational` | Latin PD printings | ⚙️ optional |

## TIER C — Blocked / licensed (kept OUT until legal)

| Item | Reason |
|---|---|
| **Dorotheus**, *Carmen Astrologicum* | Greek original LOST; only clean Arabic is Pingree's **copyrighted** edition. No PD original to translate. → keep paraphrases or **license Dykes**. |
| Any **modern translation** — Dykes, Hand, Zoller, Pingree, Gramaglia | Copyright. License-only (Dykes / Cazimi Press is the main rights holder). |
| Austin Coppock *36 Faces*; "OceanofPDF" files | Copyrighted / pirated — personal study only. |

---

## Pipeline status legend
✅ ready = clean text exists, ingest now · ⚙️ = needs OCR and/or our translation · ❌ = blocked

## Known quality risks
- **Latin incunabula are blackletter image scans** — OCR is error-prone; budget a vision-model transcription + proofreading pass *before* translation. This is the real bottleneck, not the translation itself.
- **17th-c. English** has archaic spelling / long-s (ſ) — normalize on ingest.
- **Verbatim-quote credibility**: the app quotes sources to clients as real. Every `text` field must be a true verbatim extract checked against the scan; every `translation` must be traceable to a PD original edition (not a modern one).
