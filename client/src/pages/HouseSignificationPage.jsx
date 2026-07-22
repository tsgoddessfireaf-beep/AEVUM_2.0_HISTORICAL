// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator.jsx';
import ChatMessage from '../components/ChatMessage.jsx';
import useAppStore from '../store/useAppStore.js';
import { streamSSE } from '../lib/sse.js';
import { getIdToken } from '../lib/firebase.js';


/**
 * Step 3 — runs the house-signification interview via Claude.
 * Streams the conversation until the model emits a <house_significations> block,
 * then stores the parsed result and enables navigation to ResultsPage.
 */
export default function HouseSignificationPage() {
  const navigate = useNavigate();
  const {
    question, dateTimeData,
    interviewMessages, addInterviewMessage, setInterviewMessages,
    houseSignifications, setHouseSignifications,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false); // Network status
  const [isTyping, setIsTyping] = useState(false);   // UI typing status
  const [streamingText, setStreamingText] = useState(''); // Text currently typed to screen
  const [error, setError] = useState('');
  
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  
  const textQueueRef = useRef('');
  const finishRef = useRef(null);
  const streamingRef = useRef(false); // mirrors `streaming` so the typewriter loop
                                      // is not torn down when the network flag flips
                                      // (deployed SSE arrives as one buffered burst)

  useEffect(() => {
    if (!question) navigate('/ask');
  }, [question, navigate]);

  // Auto-start interview if no messages yet
  useEffect(() => {
    if (interviewMessages.length === 0 && !streaming) {
      startInterview();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewMessages, streamingText]);

  // Typewriter effect loop
  useEffect(() => {
    if (!isTyping) return;
    let timeoutId;
    
    function typeNext() {
      if (textQueueRef.current.length > 0) {
        // If we hit the XML block, skip typing it out (it's hidden anyway)
        if (textQueueRef.current.startsWith('<house_significations>')) {
          setStreamingText(prev => prev + textQueueRef.current);
          textQueueRef.current = '';
        } else {
          // Take 1 char at a time — ~1 char every ~40ms → ~250+ WPM (was ~105 WPM)
          const char = textQueueRef.current.charAt(0);
          textQueueRef.current = textQueueRef.current.slice(1);
          setStreamingText(prev => prev + char);
          timeoutId = setTimeout(typeNext, 35 + Math.random() * 12);
          return;
        }
      }
      
      // Queue is empty
      if (!streamingRef.current && finishRef.current) {
        // Network done and queue drained
        setIsTyping(false);
        const { data, accumulated, msgs } = finishRef.current;
        const assistantMsg = { role: 'assistant', content: accumulated };
        setInterviewMessages([...msgs, assistantMsg]);
        setStreamingText('');
        if (data.significations) setHouseSignifications(data.significations);
        finishRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        // Waiting for more network chunks
        timeoutId = setTimeout(typeNext, 50);
      }
    }
    timeoutId = setTimeout(typeNext, 50);
    return () => clearTimeout(timeoutId);
  }, [isTyping]);

  // Skip the typewriter — dump the remaining queue instantly so the user can answer now
  function revealNow() {
    if (textQueueRef.current.length > 0) {
      setStreamingText(prev => prev + textQueueRef.current);
      textQueueRef.current = '';
    }
  }

  async function startInterview() {
    const initialMessage = {
      role: 'user',
      content: `My horary question is: "${question}"`,
    };
    const messages = [initialMessage];
    setInterviewMessages(messages);
    await sendToStream(messages);
  }

  async function sendToStream(messages) {
    setStreaming(true);
    streamingRef.current = true;
    setIsTyping(true);
    setStreamingText('');
    textQueueRef.current = '';
    finishRef.current = null;
    setError('');
    let accumulated = '';

    // `streaming` is cleared in the finally so the reply input can NEVER stay
    // disabled — even if the stream drops without a terminal frame or a callback
    // path is missed. This is what prevents the "response shown, can't reply" hang.
    try {
      const idToken = await getIdToken();
      await streamSSE(
        '/api/chat/house-signification',
        { messages },
        {
          onText: (text) => {
            accumulated += text;
            textQueueRef.current += text;
          },
          onDone: (data) => {
            // Signal the typewriter loop to finalize when queue is empty
            finishRef.current = { data, accumulated, msgs: messages };
          },
          onError: (err) => {
            setError(err);
            setStreamingText('');
          },
        },
        idToken ? { Authorization: `Bearer ${idToken}` } : {}
      );
    } catch (err) {
      setError('Something went wrong reaching your astrologer. Please try again.');
      setStreamingText('');
    } finally {
      setStreaming(false);
      streamingRef.current = false;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...interviewMessages, userMsg];
    setInterviewMessages(updatedMessages);
    setInput('');
    await sendToStream(updatedMessages);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const displayMessages = interviewMessages.slice(1); // skip the hidden initial user message

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 sm:py-12">
      <div className="w-full max-w-xl flex flex-col" style={{ minHeight: '80vh' }}>
        <StepIndicator current={3} />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-serif text-bone mb-1">Assigning the Significators</h2>
          <p className="text-silver/70 text-sm">Consulting the manuals to determine the active houses</p>
        </div>

        {/* Question pill */}
        <div className="bg-teal-900/40 border border-teal-600/30 rounded-xl px-4 py-2.5 mb-4 text-sm text-silver italic">
          "{question}"
        </div>

        {/* Educational intro — only shown before significations are determined */}
        {!houseSignifications && (
          <div className="bg-teal-900/20 border border-teal-600/30 rounded-xl px-5 py-4 mb-4 text-sm text-silver space-y-2">
            <p>
              Before we can cast the figure and run the simulation, we must identify the primary significators. In traditional horary, every person, object, or concept in your petition corresponds to one of the 12 houses of life described in Lilly's <em>Christian Astrology</em> (1647).
            </p>
            <p>
              The casebook assistant will ask a few quick clarifying questions to consult the traditional rules and correctly assign the houses. This ensures that the simulation uses the correct astrological significators.
            </p>
          </div>
        )}

        {/* Significations badge — shown once determined */}
        {houseSignifications && (
          <div className="bg-teal-900/60 border border-copper-400/30 rounded-xl px-5 py-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-copper-400 text-sm">✦</span>
              <span className="text-copper-400 text-xs uppercase tracking-wide">Significators Mapped</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
              <div className="bg-teal-900/60 rounded-lg px-3 py-2.5">
                <div className="text-silver/70 text-xs mb-1">You (the one asking)</div>
                <div className="text-bone/90">House {houseSignifications.querent_house}</div>
              </div>
              <div className="bg-teal-900/60 rounded-lg px-3 py-2.5">
                <div className="text-silver/70 text-xs mb-1">{houseSignifications.quesited_label}</div>
                <div className="text-bone/90">House {houseSignifications.quesited_house}</div>
              </div>
            </div>
            {houseSignifications.additional_notes && (
              <p className="text-silver/70 text-xs leading-relaxed">{houseSignifications.additional_notes}</p>
            )}
          </div>
        )}

        {/* Chat window */}
        <div role="log" aria-live="polite" aria-label="Astrologer interview"
             className="flex-1 bg-teal-700/70 border border-teal-600/40 rounded-2xl p-4 overflow-y-auto mb-4 space-y-4"
             style={{ maxHeight: '45vh' }}>
          {displayMessages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}
          {(isTyping || streaming) && streamingText && (
            <ChatMessage role="assistant" content={streamingText} streaming />
          )}
          {(isTyping || streaming) && !streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-900 border border-copper-400/30 text-copper-400 flex items-center justify-center text-sm">☽</div>
              <div className="bg-teal-900/80 border border-teal-600/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="flex gap-1">
                  {[0,1,2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-copper-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-900/20 rounded-lg px-4 py-3 border border-red-800/40 flex items-start gap-3">
              <span className="text-red-500 shrink-0 mt-0.5">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={startInterview}
                  className="mt-2 text-xs text-copper-400 hover:text-copper-300 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Skip typewriter — jump straight to answering */}
        {isTyping && textQueueRef.current.length > 0 && (
          <div className="flex justify-center -mt-2 mb-3">
            <button
              onClick={revealNow}
              className="px-3 py-1.5 text-xs text-copper-400 hover:text-copper-300 border border-copper-400/40
                         hover:border-copper-300/60 rounded-full transition-colors"
            >
              Answer now ↓
            </button>
          </div>
        )}

        {/* Input — always visible so user can reply even if significations were already found */}
        <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              aria-label="Reply to the astrologer"
              placeholder="Reply to the astrologer… (Enter to send)"
              rows={2}
              className="flex-1 bg-teal-900/60 border border-teal-600 rounded-xl px-4 py-3 text-bone
                         placeholder:text-silver/40 focus:outline-none focus:border-copper-400/60 resize-none
                         text-sm disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="px-4 bg-copper-400 hover:bg-copper-300 disabled:opacity-30 text-teal-900
                         font-semibold rounded-xl transition-all self-end py-3 text-sm"
            >
              Send
            </button>
          </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => navigate('/datetime')}
            className="px-5 py-3 text-silver/70 hover:text-bone/75 text-sm border border-teal-600
                       rounded-xl transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => navigate('/radicality')}
            disabled={!houseSignifications}
            className="flex-1 bg-copper-400 hover:bg-copper-300 disabled:opacity-30 disabled:cursor-not-allowed
                       text-teal-900 font-semibold py-3 rounded-xl transition-all text-sm"
          >
            {houseSignifications ? 'Cast the Figure →' : 'Consulting the rules…'}
          </button>
        </div>
      </div>
    </div>
  );
}
