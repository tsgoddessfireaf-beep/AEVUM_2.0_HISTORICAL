// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Global Zustand store for the Aevum reading session.
 *
 * State shape:
 *  - question          {string}   The horary question (Step 1).
 *  - dateTimeData      {Object}   Date, time, timezone, location (Step 2).
 *  - interviewMessages {Array}    House-signification interview history (Step 3).
 *  - houseSignifications {Object|null} Parsed querent/quesited assignments.
 *  - ephemerisData     {Object|null}   Full chart from the ephemeris service.
 *  - analysis          {string}   The AI's analysis text (Step 4).
 *  - readingId         {string|null}   Firestore document id once persisted.
 *  - followUpMessages  {Array}    Post-reading chat turns.
 *  - journal           {Object|null}   Outcome notes and accuracy rating.
 *
 * Persisted to localStorage under the key "aevum-session" (all fields).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveDraft, clearDraft } from '../lib/firebase.js';

const useAppStore = create(
  persist(
    (set, get) => ({
      // Step 1
      question: '',
      questionType: null,   // 'perfection' | 'condition' — set at intake, drives analysis prompt

      // Step 2
      dateTimeData: {
        date: '',
        time: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        location: '',
        houseSystem: 'Regiomontanus',
        tradition: 'classic',
      },

      // Step 3 — conversation history for house signification interview
      interviewMessages: [],   // [{role:'user'|'assistant', content:'...'}]
      houseSignifications: null,

      // Step 4
      ephemerisData: null,
      analysis: '',

      // Display preferences — persisted across sessions
      chartPrefs: {
        // Wheel elements
        showAspectLines:    true,
        showNode:           true,
        showLotOfFortune:   true,
        showHouseNumerals:  true,
        showCardinalLabels: true,
        // Chart Notes items
        showTiming:            true,
        showMoonTestimony:     true,
        showPerfectionAspects: true,
        showCollection:        true,
        showProhibition:       true,
        showTranslation:       true,
        showReception:         true,
        showRefranation:       true,
        showFixedStars:        true,
        showHayz:              true,
        showAlmuten:           true,
        showAntiscia:          true,
        showWarnings:          true,
        // Chart Data tables
        showAspectsTable:   true,
        showReceptionTable: true,
        showDignitiesTable: true,
        showRawChartData:   true,
      },

      // Step 4 (post-reading): persisted reading id + follow-up chat + journal
      readingId: null,
      followUpMessages: [],   // [{role, content, ts}]
      journal: null,          // { notes, outcome, accuracyRating, outcomeNotes, updatedAt }

      // Actions
      // Backend draft saves (Firestore, keyed to the signed-in user) are fired
      // fire-and-forget alongside every local mutation below — Firestore is now
      // the durable source of truth for an in-progress session; localStorage
      // just keeps the UI instantly responsive between reloads.
      setQuestion: (question) => { set({ question }); saveDraft({ question }); },
      setQuestionType: (questionType) => { set({ questionType }); saveDraft({ questionType }); },

      setDateTimeData: (data) => {
        set((s) => ({ dateTimeData: { ...s.dateTimeData, ...data } }));
        saveDraft({ dateTimeData: get().dateTimeData });
      },

      addInterviewMessage: (msg) => {
        set((s) => ({ interviewMessages: [...s.interviewMessages, msg] }));
        saveDraft({ interviewMessages: get().interviewMessages });
      },

      setInterviewMessages: (msgs) => { set({ interviewMessages: msgs }); saveDraft({ interviewMessages: msgs }); },

      setHouseSignifications: (sig) => { set({ houseSignifications: sig }); saveDraft({ houseSignifications: sig }); },

      /** Clears everything downstream of the question (interview chat, significations,
       * chart, analysis, saved reading id) so a new question never inherits stale state
       * from a previous session. Leaves dateTimeData and chartPrefs untouched. */
      clearForNewQuestion: () => {
        set({
          interviewMessages: [],
          houseSignifications: null,
          ephemerisData: null,
          analysis: '',
          readingId: null,
          followUpMessages: [],
          journal: null,
        });
        clearDraft();
      },

      setEphemerisData: (data) => { set({ ephemerisData: data }); saveDraft({ ephemerisData: data }); },

      appendAnalysis: (text) => set((s) => ({ analysis: s.analysis + text })),
      setAnalysis: (text) => set({ analysis: text }),

      appendThinking: (text) => set((s) => ({ thinking: s.thinking + text })),
      setThinking: (text) => set({ thinking: text }),

      setReadingId: (id) => set({ readingId: id }),

      addFollowUp: (msg) =>
        set((s) => ({ followUpMessages: [...s.followUpMessages, msg] })),

      setFollowUpMessages: (msgs) => set({ followUpMessages: msgs }),

      setJournal: (j) => set({ journal: j }),

      setChartPref: (key, value) =>
        set((s) => ({ chartPrefs: { ...s.chartPrefs, [key]: value } })),

      resetChartPrefs: () =>
        set({
          chartPrefs: {
            showAspectLines: true, showNode: true, showLotOfFortune: true, showHouseNumerals: true, showCardinalLabels: true,
            showTiming: true, showMoonTestimony: true, showPerfectionAspects: true, showCollection: true, showProhibition: true,
            showTranslation: true, showReception: true, showRefranation: true, showFixedStars: true, showHayz: true, showAlmuten: true, showAntiscia: true, showWarnings: true,
            showAspectsTable: true, showReceptionTable: true, showDignitiesTable: true,
            showRawChartData: true,
          },
        }),

      /** Hydrates in-progress wizard fields from the user's Firestore draft
       * (see lib/firebase.js saveDraft/loadDraft). Called once on Step 1 mount
       * so a session survives a cleared/glitched localStorage as long as the
       * user is signed in. Does not touch chartPrefs. */
      hydrateFromDraft: (draft) => {
        if (!draft) return;
        set({
          question:            draft.question             ?? '',
          questionType:        draft.questionType          ?? null,
          dateTimeData:        draft.dateTimeData          ?? get().dateTimeData,
          interviewMessages:   draft.interviewMessages     ?? [],
          houseSignifications: draft.houseSignifications   ?? null,
          ephemerisData:       draft.ephemerisData         ?? null,
          analysis:            draft.analysis              ?? '',
        });
      },

      /** Restores all session fields from a saved Firestore reading document. */
      loadFromReading: (reading) =>
        set({
          question:           reading.question       ?? '',
          dateTimeData:       reading.dateTime        ?? { date: '', time: '', timezone: 'UTC', location: '', houseSystem: 'Regiomontanus', tradition: 'classic' },
          interviewMessages:  reading.interviewMessages ?? [],
          houseSignifications: reading.significations ?? null,
          ephemerisData:      reading.ephemerisSnapshot ?? null,
          analysis:           reading.fullAnalysis   ?? '',
          readingId:          reading.id             ?? null,
          followUpMessages:   reading.followUpMessages ?? [],
          journal:            reading.journal        ?? null,
        }),

      resetAll: () => {
        set({
          question: '',
          questionType: null,
          dateTimeData: {
            date: '',
            time: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            location: '',
            houseSystem: 'Regiomontanus',
            tradition: 'classic',
          },
          interviewMessages: [],
          houseSignifications: null,
          ephemerisData: null,
          analysis: '',
          readingId: null,
          followUpMessages: [],
          journal: null,
        });
        clearDraft();
      },
    }),
    {
      name: 'aevum-session',
      partialize: (state) => ({
        question: state.question,
        questionType: state.questionType,
        dateTimeData: state.dateTimeData,
        interviewMessages: state.interviewMessages,
        houseSignifications: state.houseSignifications,
        ephemerisData: state.ephemerisData,
        analysis: state.analysis,
        readingId: state.readingId,
        followUpMessages: state.followUpMessages,
        journal: state.journal,
        chartPrefs: state.chartPrefs,
      }),
    }
  )
);

export default useAppStore;
