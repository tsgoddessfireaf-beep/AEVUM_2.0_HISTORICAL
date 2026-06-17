import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamSSE } from './sse.js';

function makeSSEStream(...lines) {
  const body = lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join('');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  return new ReadableStream({
    start(ctrl) { ctrl.enqueue(bytes); ctrl.close(); },
  });
}

function mockFetch(stream, status = 200) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, body: stream });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('streamSSE', () => {
  it('calls onText for each text frame', async () => {
    global.fetch = mockFetch(makeSSEStream(
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done' },
    ));
    const onText = vi.fn();
    const onDone = vi.fn();
    await streamSSE('/api/test', {}, { onText, onDone, onError: vi.fn() });
    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onText).toHaveBeenNthCalledWith(2, ' world');
  });

  it('calls onDone with the data object when done frame arrives', async () => {
    global.fetch = mockFetch(makeSSEStream(
      { type: 'done', significations: { querent_house: 1 } },
    ));
    const onDone = vi.fn();
    await streamSSE('/api/test', {}, { onText: vi.fn(), onDone, onError: vi.fn() });
    expect(onDone).toHaveBeenCalledWith({ type: 'done', significations: { querent_house: 1 } });
  });

  it('calls onError when server returns non-ok status', async () => {
    global.fetch = mockFetch(makeSSEStream(), 500);
    const onError = vi.fn();
    await streamSSE('/api/test', {}, { onText: vi.fn(), onDone: vi.fn(), onError });
    expect(onError).toHaveBeenCalledWith('Server error: 500');
  });

  it('calls onError on a network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
    const onError = vi.fn();
    await streamSSE('/api/test', {}, { onText: vi.fn(), onDone: vi.fn(), onError });
    expect(onError).toHaveBeenCalledWith('Network error: Network down');
  });

  it('calls onError for error frames from the server', async () => {
    global.fetch = mockFetch(makeSSEStream({ type: 'error', error: 'AI failed' }));
    const onError = vi.fn();
    await streamSSE('/api/test', {}, { onText: vi.fn(), onDone: vi.fn(), onError });
    expect(onError).toHaveBeenCalledWith('AI failed');
  });

  it('settles via onError when the stream ends without a done/error frame', async () => {
    // Simulates a dropped connection mid-turn: text arrives but the terminating
    // frame never does. The consumer must still be settled so loading state
    // (e.g. the interview reply input) can't get stuck disabled.
    global.fetch = mockFetch(makeSSEStream(
      { type: 'text', text: 'partial response' },
    ));
    const onDone = vi.fn();
    const onError = vi.fn();
    await streamSSE('/api/test', {}, { onText: vi.fn(), onDone, onError });
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/unexpectedly|interrupted/i);
  });

  it('sends the body as JSON', async () => {
    global.fetch = mockFetch(makeSSEStream({ type: 'done' }));
    await streamSSE('/api/test', { question: 'Will I get the job?' }, { onText: vi.fn(), onDone: vi.fn(), onError: vi.fn() });
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ question: 'Will I get the job?' });
  });
});
