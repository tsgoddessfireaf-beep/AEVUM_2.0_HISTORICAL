# Aevum Source Library — the revived horary library

A two-layer library of traditional horary texts that lives inside Aevum.

## The two layers
- **Shelves** (`shelves/`, → Firestore `library_shelves`): the **full books**, stored whole and verbatim. The permanent archive.
- **Cards** (`cards/`, → Firestore `library_cards`): **useful passages** drawn from the books, each made findable *by meaning* (an embedding vector). Each card points back to its book.

A reading retrieves the few cards that fit the chart and quotes the real masters, by name.

## Folder map
```
library/
  schema.json        — the shape of one card
  SOURCES.md         — provenance + licensing ledger (the legal backbone)
  shelves/           — full-text books (Layer 1)
  cards/             — passage cards, *.jsonl (Layer 2)
  scripts/
    chunk.mjs              — shelf -> draft cards
    load-to-firestore.mjs  — cards + shelves -> Firestore
```

## Pipeline (per book)
1. **Acquire** full text → `shelves/`.
2. **Chunk** → draft cards (`node scripts/chunk.mjs <shelf> <out.jsonl> --author … --work … --tag …`).
3. **Cleanup pass** ← *the quality gate.* OCR'd books need an LLM/human pass to (a) finish segmentation and (b) verify every card is **verbatim**. Cards stay `_status: pending_cleanup` until done. Born-digital sources (Wikisource) can skip OCR cleanup.
4. **Load** → Firestore (`node scripts/load-to-firestore.mjs <cards.jsonl> --shelf <shelf> --shelf-id …`). The loader **refuses to index pending_cleanup cards** — unverified quotes never reach clients.

## Decisions to lock before loading
1. **Embedding model** (the "find by meaning" engine) — recommended: **Vertex AI `text-embedding-004`** (native to this Firebase project). Wire it into `EMBED()` in `load-to-firestore.mjs`.
2. **Firestore vector index** on `library_cards.embedding`, queried with `findNearest()`.

## Current state
- ✅ Shelf: `shelves/bonatti-anima-raw.txt` (full *Anima Astrologiae*, Coley 1676 / 1886 reprint).
- ✅ Cards: `cards/bonatti-anima.jsonl` — **145 of 146 considerations**, Gemini-cleaned (`gemini-2.5-flash` on Vertex), verbatim-corrected and condition-tagged (`_status: gemini_cleaned`). Cleanup engine: `scripts/gemini-clean.mjs`.
- ⏳ Open: backfill consideration #143 (dropped at a chunk seam); improve sparse condition-key tagging (voc_moon/via_combusta under-applied — semantic search covers this regardless); add Lilly from Wikisource (no OCR needed).
- ⏳ Then: stand up Firestore Vector Search and load the cards.
