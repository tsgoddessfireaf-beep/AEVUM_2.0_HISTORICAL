import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { parseHouseSignifications, formatChartForPrompt, friendlyApiError, handleFollowUp, parseSlidesResponse } from './chat.js';

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

describe('handleFollowUp error path', () => {
  it('sends an error SSE message when the AI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('API failure (429)'));

    const req = {
      headers: { authorization: 'Bearer fake-token' },
      body: {
        question: 'Will I be rich?',
        ephemerisData: {
          chart_meta: {},
          houses: { cusps: {} },
          planets: {},
        },
        messages: [{ role: 'user', content: 'test' }],
      },
    };

    const res = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handleFollowUp(req, res);

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('too many requests'));
    expect(res.end).toHaveBeenCalled();
  });
});

describe('friendlyApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles rate limit errors', () => {
    const msg = friendlyApiError('Rate limit reached (429)');
    expect(msg).toContain('too many requests');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles overloaded errors', () => {
    const msg = friendlyApiError(new Error('Service Overloaded (503)'));
    expect(msg).toContain('temporarily overloaded');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles network errors', () => {
    const msg = friendlyApiError('fetch failed');
    expect(msg).toContain('Could not reach the AI service');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles timeout errors', () => {
    const msg = friendlyApiError('Request timeout');
    expect(msg).toContain('took too long to respond');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('handles unknown errors and logs to Sentry', () => {
    const error = new Error('Something weird happened');
    const msg = friendlyApiError(error);
    expect(msg).toContain('Something went wrong');
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});

describe('parseHouseSignifications', () => {
  it('extracts a valid JSON block', () => {
    const text = `Some text\n<house_significations>\n{"querent_house":1,"quesited_house":7,"quesited_label":"partner","question_type":"relationship","additional_notes":""}\n</house_significations>`;
    const result = parseHouseSignifications(text);
    expect(result.querent_house).toBe(1);
    expect(result.quesited_house).toBe(7);
    expect(result.quesited_label).toBe('partner');
  });

  it('returns null when the block is absent', () => {
    expect(parseHouseSignifications('No XML here at all.')).toBeNull();
  });

  it('returns null for malformed JSON inside the block', () => {
    expect(parseHouseSignifications('<house_significations>not json</house_significations>')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseHouseSignifications('')).toBeNull();
  });

  it('handles extra whitespace inside the block', () => {
    const text = '<house_significations>  {"querent_house":1,"quesited_house":4,"quesited_label":"home","question_type":"property","additional_notes":""}  </house_significations>';
    expect(parseHouseSignifications(text)?.quesited_house).toBe(4);
  });
});

describe('formatChartForPrompt', () => {
  const ephemerisData = {
    chart_meta: {
      utc_datetime: '2026-05-18T14:30:00',
      julian_day: 2461123.1042,
      resolved_place_name: 'Tampa',
      resolved_latitude: 27.95,
      resolved_longitude: -82.46,
    },
    houses: {
      system: 'Regiomontanus',
      ascendant: 45.0,
      mc: 315.0,
      cusps: { 1: 45, 2: 75, 3: 105, 4: 135, 5: 165, 6: 195, 7: 225, 8: 255, 9: 285, 10: 315, 11: 345, 12: 15 },
    },
    planets: {
      Sun: { sign: 'Taurus', sign_degree: 27.5, house: 1, is_retrograde: false, daily_speed: 0.976, declination: 20.1 },
    },
    nodes: { mean_north_node: { sign: 'Aries', sign_degree: 14.2 } },
    lunar_phase: { moon_phase_angle: 120.0, moon_is_waxing: true, moon_is_void: false },
    errors: [],
  };

  const significations = {
    querent_house: 1,
    quesited_house: 7,
    quesited_label: 'romantic partner',
    question_type: 'relationship',
    additional_notes: 'Check Venus.',
  };

  it('includes the question', () => {
    const result = formatChartForPrompt(ephemerisData, 'Will we reconcile?', significations);
    expect(result).toContain('Will we reconcile?');
  });

  it('includes the quesited label', () => {
    const result = formatChartForPrompt(ephemerisData, 'Will we reconcile?', significations);
    expect(result).toContain('romantic partner');
  });

  it('includes planet data', () => {
    const result = formatChartForPrompt(ephemerisData, 'Test question', significations);
    expect(result).toContain('Sun');
    expect(result).toContain('Taurus');
  });

  it('includes location', () => {
    const result = formatChartForPrompt(ephemerisData, 'Test question', significations);
    expect(result).toContain('Tampa');
  });

  it('reports no errors when errors array is empty', () => {
    const result = formatChartForPrompt(ephemerisData, 'Test question', significations);
    expect(result).toContain('ERRORS FROM CALCULATION: none');
  });

  it('reports errors when present', () => {
    const withErrors = { ...ephemerisData, errors: ['Swiss Ephemeris not found'] };
    const result = formatChartForPrompt(withErrors, 'Test question', significations);
    expect(result).toContain('Swiss Ephemeris not found');
  });
});

describe('parseSlidesResponse', () => {
  const validSlide = (kind) => ({
    kind,
    kicker: 'THE MOMENT',
    title: 'A slide title',
    body: ['First point.', 'Second point.'],
    teach: 'A takeaway.',
    script: 'Spoken narration for this slide.',
  });
  const kinds = ['cover', 'lesson', 'chart', 'significators', 'testimonies', 'verdict', 'timing', 'action', 'sources'];
  const validDeck = kinds.map(validSlide);

  it('parses a clean JSON array of 9 slides', () => {
    const slides = parseSlidesResponse(JSON.stringify(validDeck));
    expect(slides).toHaveLength(9);
    expect(slides[0].kind).toBe('cover');
    expect(slides[8].kind).toBe('sources');
  });

  it('tolerates code fences and surrounding prose', () => {
    const raw = 'Here is your deck:\n```json\n' + JSON.stringify(validDeck) + '\n```\nEnjoy!';
    expect(parseSlidesResponse(raw)).toHaveLength(9);
  });

  it('throws when no JSON array is present', () => {
    expect(() => parseSlidesResponse('Sorry, I cannot do that.')).toThrow(/No JSON array/);
  });

  it('throws when the deck has the wrong slide count', () => {
    expect(() => parseSlidesResponse(JSON.stringify(validDeck.slice(0, 5)))).toThrow(/validation/);
  });

  it('throws when a slide is missing required fields', () => {
    const broken = [...validDeck.slice(0, 8), { kind: 'sources', title: 'No body or script' }];
    expect(() => parseSlidesResponse(JSON.stringify(broken))).toThrow(/validation/);
  });
});
