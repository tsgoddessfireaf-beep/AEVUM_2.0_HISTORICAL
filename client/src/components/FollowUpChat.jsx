// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';
import useAppStore from '../store/useAppStore.js';
import { appendFollowUp, FIREBASE_ENABLED } from '../lib/firebase.js';
import { streamSSE } from '../lib/sse.js';

const QUICK_PROMPTS = [
  'When will this happen?',
  'What does the Moon say about this?',
  'Is there anything I should be careful of?',
  'What if I wait instead?',
];


/**
 * Post-reading chat panel that lets the user ask follow-up questions about their chart.
 * Streams live responses from /api/chat/follow-up and persists each turn to Firestore.
 * Shows quick-prompt buttons when the conversation is empty.
 */
export default function FollowUpChat() {
  const {
    question, houseSignifications, ephemerisData, analysis,
    readingId, followUpMessages, addFollowUp, setFollowUpMessages,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followUpMessages, streamingText]);

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', content: text };
    const next = [...followUpMessages, userMsg];
    setFollowUpMessages(next);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setError('');

    if (readingId) appendFollowUp(readingId, userMsg);

    let accumulated = '';

    await streamSSE(
      '/api/chat/follow-up',
      { question, houseSignifications, ephemerisData, originalReading: analysis, messages: next },
      {
        onText: (chunk) => {
          accumulated += chunk;
          setStreamingText((t) => t + chunk);
        },
        onDone: (data) => {
          const assistantMsg = { role: 'assistant', content: data.fullText || accumulated };
          setFollowUpMessages([...next, assistantMsg]);
          setStreamingText('');
          setStreaming(false);
          if (readingId) appendFollowUp(readingId, assistantMsg);
          setTimeout(() => inputRef.current?.focus(), 50);
        },
        onError: (err) => {
          setError(err);
          setStreaming(false);
          setStreamingText('');
        },
      }
    );
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = followUpMessages.length === 0;

  return (
    <div className="bg-teal-700/70 border border-teal-600/40 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-copper-400 text-xs uppercase tracking-widest">Ask Further</h3>
        {!FIREBASE_ENABLED && (
          <span className="text-silver/40 text-[10px] uppercase tracking-wide">Local-only</span>
        )}
      </div>

      <p className="text-silver/70 text-xs mb-4 leading-relaxed">
        Ask anything about this reading — timing, deeper insight on a planet, or a "what if" scenario.
      </p>

      {/* Chat thread */}
      {!isEmpty && (
        <div role="log" aria-live="polite" aria-label="Follow-up conversation"
             className="bg-teal-900/40 rounded-xl p-4 mb-4 space-y-4 max-h-96 overflow-y-auto">
          {followUpMessages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}
          {streaming && streamingText && (
            <ChatMessage role="assistant" content={streamingText} streaming />
          )}
          {streaming && !streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-900 border border-copper-400/30 text-copper-400 flex items-center justify-center text-sm">☽</div>
              <div className="bg-teal-900/80 border border-teal-600/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-copper-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-3 border border-red-800/40">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick prompts */}
      {isEmpty && (
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={streaming}
              className="text-xs px-3 py-2 border border-teal-600 text-silver rounded-full
                         hover:border-copper-400/40 hover:text-copper-300 transition-colors disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          aria-label="Ask a follow-up question"
          placeholder="Ask a follow-up… (Enter to send)"
          rows={2}
          className="flex-1 bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-3 text-bone
                     placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 resize-none
                     text-sm disabled:opacity-50 transition-colors"
        />
        <button
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          className="px-4 bg-copper-400 hover:bg-copper-300 disabled:opacity-30 text-teal-900
                     font-semibold rounded-xl transition-all self-end py-3 text-sm"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
