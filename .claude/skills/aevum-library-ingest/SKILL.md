---
name: aevum-library-ingest
description: Ingest a public-domain horary text into the Aevum source library — OCR cleanup via Gemini, completeness + ordering verification with auto-backfill of seam-dropped items, embedding, and load into Firestore Vector Search. Use when adding a book to the library, cleaning OCR into cards, or whenever a cleanup run reports a missing/out-of-order item.
---

# Aevum Library Ingest

Turns a public-domain source text into clean, verbatim, condition-tagged, semantically-searchable cards in the Aevum library. Two layers: **shelves** (full books) and **cards** (passages). Scripts live in `library/scripts/`.

## Project guard — ALWAYS verify first
The library belongs to **`flutter-ai-playground-f880c`** + the **`(default)`** Firestore DB (AEVUM 2.0 Historical, per `.firebaserc`). NOT `gen-lang-client-0022917921` (that is the stale Notion-era deployment).

```
gcloud config get-value project   # must be flutter-ai-playground-f880c
```
`verify-and-backfill.mjs` enforces this (`EXPECTED_PROJECT`) and aborts on mismatch. All scripts hardcode the project/DB — confirm before any run.

Auth for every step: `GAUTH=$(gcloud auth print-access-token)` (used for both Vertex and Firestore).

## Pipeline (per book)
Run from `library/`.

1. **Acquire** — download the full text to `shelves/<id>-raw.txt` (prefer clean transcriptions; OCR scans are fine but messier).

2. **Clean** (Gemini `gemini-2.5-flash` on Vertex — verbatim correction, segmentation, condition-tagging):
   ```
   GAUTH=$(gcloud auth print-access-token) node scripts/gemini-clean.mjs shelves/<id>-raw.txt cards/<id>.jsonl --author … --work … --tag …
   ```

3. **Verify + auto-backfill (MANDATORY — this is the "every cutoff" guarantee):**
   ```
   GAUTH=$(gcloud auth print-access-token) node scripts/verify-and-backfill.mjs shelves/<id>-raw.txt cards/<id>.jsonl --total <N>
   ```
   Long items that straddle a cleanup chunk seam get dropped by the fragment-skip guard. This step finds every missing/duplicate/out-of-order number, re-runs Gemini on a window centered on each gap, merges, and re-checks — looping until the set is **complete and correctly ordered**. Exit 0 = complete; exit 1 = still gaps (investigate). Re-run after ANY cleanup.

4. **Load** — embed (Vertex `text-embedding-005`, 768-dim) and write to Firestore as native Vector values:
   ```
   GAUTH=$(gcloud auth print-access-token) node scripts/embed-load.mjs cards/<id>.jsonl
   ```

5. **Index** (once per collection) — create the vector index on `library_cards.embedding` (dimension 768, COSINE) via the Firestore REST API, then it's queryable with `findNearest`.

6. **Verify retrieval:**
   ```
   GAUTH=$(gcloud auth print-access-token) node scripts/search.mjs "a plain-language horary question"
   ```

## Invariants
- **Verbatim only.** `text` must be the author's exact words (OCR-corrected, page-junk removed) — never paraphrased. Quotes are shown to clients.
- **Count + order must be exact.** Step 3 is non-negotiable; never ship a book with missing or misordered considerations/chapters.
- **Licensing.** Every card traces to a `SOURCES.md` row. public-domain → ingest; our-translation → translate from a PD *original* edition only; never modern copyrighted translations.
- **condition_keys** bridge the deterministic matcher in `functions/routes/chat.js`; sparse tagging is OK because semantic search covers the rest.
