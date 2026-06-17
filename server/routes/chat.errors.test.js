import { describe, it, expect, vi, beforeEach } from 'vitest';
import router, { friendlyApiError } from './chat.js';
import * as Sentry from '@sentry/node';

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class {
      constructor() {
        this.messages = { create: mockCreate };
      }
    },
  };
});

vi.mock('../lib/firebaseAdmin.js', () => ({
  ADMIN_ENABLED: true,
  verifyIdToken: vi.fn().mockResolvedValue({ email: 'tsgoddessfireaf@gmail.com', uid: 'test-uid' }),
}));

process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.PRACTITIONER_EMAILS = 'tsgoddessfireaf@gmail.com';


describe('friendlyApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles rate limit errors', () => {
    const err = new Error('Rate limit reached (429)');
    const result = friendlyApiError(err);
    expect(result).toContain('too many requests');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles overloaded errors', () => {
    const err = new Error('Service temporarily unavailable (503)');
    const result = friendlyApiError(err);
    expect(result).toContain('temporarily overloaded');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles network errors', () => {
    const err = new Error('fetch failed');
    const result = friendlyApiError(err);
    expect(result).toContain('Could not reach the AI service');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles timeout errors', () => {
    const err = new Error('request timeout');
    const result = friendlyApiError(err);
    expect(result).toContain('took too long to respond');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles unknown errors and reports to Sentry', () => {
    const err = new Error('Something weird happened');
    const result = friendlyApiError(err);
    expect(result).toContain('Something went wrong');
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });
});

describe('Route error handling', () => {
  let mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  const findHandler = (path) => {
    return router.stack.find(s => s.route?.path === path)?.route?.stack[0]?.handle;
  };

  it('handles error in /analyze', async () => {
    const handler = findHandler('/analyze');
    const req = {
      headers: { authorization: 'Bearer fake-token' },
      body: {
        question: 'Will I be rich?',
        houseSignifications: { querent_house: 1, quesited_house: 2 },
        ephemerisData: {
          chart_meta: {},
          houses: { cusps: {} },
          planets: { Sun: { sign: 'Aries', sign_degree: 10 } },
          lunar_phase: {}
        },
      },
    };

    mockCreate.mockRejectedValue(new Error('Rate limit (429)'));

    await handler(req, mockRes);

    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('too many requests'));
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('handles error in /follow-up', async () => {
    const handler = findHandler('/follow-up');
    const req = {
      headers: { authorization: 'Bearer fake-token' },
      body: {
        question: 'What about timing?',
        ephemerisData: {
          chart_meta: {},
          houses: { cusps: {} },
          planets: { Sun: { sign: 'Aries', sign_degree: 10 } },
          lunar_phase: {}
        },
        messages: [{ role: 'user', content: 'test' }],
      },
    };

    mockCreate.mockRejectedValue(new Error('Network error'));

    await handler(req, mockRes);

    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('Could not reach the AI service'));
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('handles error in /house-signification', async () => {
    const handler = findHandler('/house-signification');
    const req = {
      body: {
        messages: [{ role: 'user', content: 'hello' }],
      },
    };

    mockCreate.mockRejectedValue(new Error('Timeout'));

    await handler(req, mockRes);

    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('took too long to respond'));
    expect(mockRes.end).toHaveBeenCalled();
  });
});
