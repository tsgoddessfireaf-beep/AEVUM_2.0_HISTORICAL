// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Shared SSE streaming utility used by all three chat endpoints.
 * Reads a Server-Sent Events stream from a POST endpoint and dispatches
 * each parsed data frame to the appropriate callback.
 *
 * @param {string} url - API endpoint path.
 * @param {Object} body - JSON request body.
 * @param {Object} handlers
 * @param {(text: string) => void} handlers.onText - Called for each text chunk.
 * @param {(data: Object) => void} handlers.onDone - Called with the final SSE data object on completion.
 * @param {(error: string) => void} handlers.onError - Called with an error message on failure.
 */
export async function streamSSE(url, body, { onText, onThinking, onDone, onError }, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
    });
  } catch (err) {
    onError('Network error: ' + err.message);
    return;
  }

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      onError(errorBody.error || `Server error: ${response.status}`);
    } catch {
      onError(`Server error: ${response.status}`);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Track whether the stream delivered a terminal frame. If it ends without one
  // (e.g. a proxy drops the connection mid-turn), we must still settle the
  // consumer — otherwise UI state like `streaming` never resets and the input
  // hangs. We also fire onError only if we never saw a terminal frame.
  let settled = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          if (data.type === 'text') onText?.(data.text);
          else if (data.type === 'thinking') onThinking?.(data.text);
          else if (data.type === 'done') { settled = true; onDone?.(data); }
          else if (data.type === 'error') { settled = true; onError?.(data.error); }
        } catch {
          // skip malformed SSE frame
        }
      }
    }
  } catch (err) {
    if (!settled) {
      settled = true;
      onError?.('The connection was interrupted. Please try again.');
    }
    return;
  }

  // Stream ended cleanly but never sent a done/error frame — settle anyway so
  // the consumer's loading state can't get stuck on.
  if (!settled) {
    onError?.('The response ended unexpectedly. Please try again.');
  }
}
