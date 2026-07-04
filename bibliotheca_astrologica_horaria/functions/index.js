// Bibliotheca Astrologica Horaria — Genkit Cloud Functions
// Embedding + semantic search flows for the horary manuscript library.
//
// Codebase: bibliotheca_astrologica_horaria
// Project:  flutter-ai-playground-f880c

import { onCallGenkit } from 'firebase-functions/https';
import { genkit, z } from 'genkit';
import { vertexAI, textEmbedding004 } from '@genkit-ai/vertexai';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

// ── Firebase Admin ──────────────────────────────────────────────────────────
initializeApp();
const db = getFirestore();

// ── Genkit instance ─────────────────────────────────────────────────────────
const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'flutter-ai-playground-f880c',
      location: 'us-central1',
    }),
  ],
});

// ── Schemas ─────────────────────────────────────────────────────────────────
const EmbedInputSchema = z.object({
  cardId:    z.string().describe('Stable slug, e.g. bonatti-anima-c028'),
  text:      z.string().describe('The verbatim passage text to embed'),
  author:    z.string().optional(),
  work:      z.string().optional(),
  sectionRef: z.string().optional(),
});

const SearchInputSchema = z.object({
  query:  z.string().describe('Natural-language search query'),
  limit:  z.number().int().min(1).max(20).default(5),
});

const SearchResultSchema = z.object({
  cardId:     z.string(),
  author:     z.string(),
  work:       z.string(),
  sectionRef: z.string(),
  text:       z.string(),
  distance:   z.number(),
});

// ── Flow: embedPassage ──────────────────────────────────────────────────────
// Takes a library card's text and stores its embedding in Firestore.
// Uses Vertex AI text-embedding-004 (768-dimensional vectors).
export const embedPassageFlow = ai.defineFlow(
  {
    name: 'embedPassage',
    inputSchema: EmbedInputSchema,
    outputSchema: z.object({ cardId: z.string(), dimensions: z.number() }),
  },
  async (input) => {
    // Generate embedding
    const embedResult = await ai.embed({
      embedder: textEmbedding004,
      content: input.text,
    });

    const embedding = embedResult;

    // Write to Firestore library_cards collection
    await db.collection('library_cards').doc(input.cardId).set(
      {
        text: input.text,
        author: input.author || '',
        work: input.work || '',
        section_ref: input.sectionRef || '',
        embedding: FieldValue.vector(embedding),
        embedded_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { cardId: input.cardId, dimensions: embedding.length };
  }
);

// ── Flow: searchLibrary ─────────────────────────────────────────────────────
// Semantic search across library_cards using Firestore vector search.
export const searchLibraryFlow = ai.defineFlow(
  {
    name: 'searchLibrary',
    inputSchema: SearchInputSchema,
    outputSchema: z.array(SearchResultSchema),
  },
  async (input) => {
    // Embed the query
    const queryEmbedding = await ai.embed({
      embedder: textEmbedding004,
      content: input.query,
    });

    // Firestore vector nearest-neighbor search
    const snapshot = await db
      .collection('library_cards')
      .findNearest({
        vectorField: 'embedding',
        queryVector: queryEmbedding,
        limit: input.limit,
        distanceMeasure: 'COSINE',
      })
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        cardId: doc.id,
        author: data.author || '',
        work: data.work || '',
        sectionRef: data.section_ref || '',
        text: data.text || '',
        distance: data.distance ?? 0,
      };
    });
  }
);

// ── Cloud Function exports ──────────────────────────────────────────────────
// These become callable functions deployed as:
//   bibliotheca_astrologica_horaria-embedPassage
//   bibliotheca_astrologica_horaria-searchLibrary

export const embedPassage = onCallGenkit(
  {
    region: 'us-central1',
    memory: '512MiB',
    // TODO: Add auth enforcement once you decide who can embed (admin only?)
  },
  embedPassageFlow
);

export const searchLibrary = onCallGenkit(
  {
    region: 'us-central1',
    memory: '512MiB',
  },
  searchLibraryFlow
);
