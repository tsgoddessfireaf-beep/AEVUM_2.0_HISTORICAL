import { describe, it, expect } from 'vitest';
import { parseSections, formatInline, parseBullets, parseNumbered, answerStyle } from './analysis.js';

describe('parseSections', () => {
  const sample = `---ANSWER---
YES

---MEANING---
The chart looks promising.

Second paragraph here.

---STARS---
• Sun in Aries — strong position.
• Moon applying to Venus — positive.

---NEXT---
1. Take action this week.
2. Follow up in three days.
3. Trust the timing.
`;

  it('parses all four sections', () => {
    const s = parseSections(sample);
    expect(s.answer).toBe('YES');
    expect(s.meaning).toContain('chart looks promising');
    expect(s.stars).toContain('Sun in Aries');
    expect(s.next).toContain('Take action');
  });

  it('returns nulls for empty input', () => {
    const s = parseSections('');
    expect(s.answer).toBeNull();
    expect(s.meaning).toBeNull();
  });

  it('returns nulls for input with no section markers', () => {
    const s = parseSections('Some plain text with no markers');
    expect(s.answer).toBeNull();
  });

  it('handles MAYBE and WAIT answers', () => {
    expect(parseSections('---ANSWER---\nMAYBE').answer).toBe('MAYBE');
    expect(parseSections('---ANSWER---\nWAIT').answer).toBe('WAIT');
  });
});

describe('formatInline', () => {
  it('converts **bold** to <strong>', () => {
    expect(formatInline('**hello**')).toBe('<strong>hello</strong>');
  });

  it('converts *italic* to <em>', () => {
    expect(formatInline('*hello*')).toBe('<em>hello</em>');
  });

  it('escapes HTML entities before processing', () => {
    const result = formatInline('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(formatInline('A & B')).toContain('&amp;');
  });

  it('returns empty string for falsy input', () => {
    expect(formatInline('')).toBe('');
    expect(formatInline(null)).toBe('');
  });
});

describe('parseBullets', () => {
  it('parses • bullets', () => {
    expect(parseBullets('• one\n• two\n• three')).toEqual(['one', 'two', 'three']);
  });

  it('parses - bullets', () => {
    expect(parseBullets('- one\n- two')).toEqual(['one', 'two']);
  });

  it('filters empty lines', () => {
    expect(parseBullets('• one\n\n• two')).toEqual(['one', 'two']);
  });

  it('returns empty array for falsy input', () => {
    expect(parseBullets('')).toEqual([]);
    expect(parseBullets(null)).toEqual([]);
  });
});

describe('parseNumbered', () => {
  it('parses numbered steps', () => {
    const result = parseNumbered('1. Do this\n2. Then that\n3. Finally this');
    expect(result).toEqual(['Do this', 'Then that', 'Finally this']);
  });

  it('ignores non-numbered lines', () => {
    const result = parseNumbered('Some intro\n1. Step one\nSome middle\n2. Step two');
    expect(result).toEqual(['Step one', 'Step two']);
  });

  it('returns empty array for falsy input', () => {
    expect(parseNumbered('')).toEqual([]);
    expect(parseNumbered(null)).toEqual([]);
  });
});

describe('answerStyle', () => {
  it('returns emerald for YES', () => {
    expect(answerStyle('YES').text).toContain('emerald');
  });

  it('returns red for NO', () => {
    expect(answerStyle('NO').text).toContain('red');
  });

  it('returns amber for MAYBE', () => {
    expect(answerStyle('MAYBE').text).toContain('amber');
  });

  it('returns amber for WAIT', () => {
    expect(answerStyle('WAIT').text).toContain('amber');
  });

  it('is case-insensitive', () => {
    expect(answerStyle('yes').text).toBe(answerStyle('YES').text);
  });

  it('returns copper fallback for unknown answers', () => {
    expect(answerStyle('UNKNOWN').text).toContain('copper');
    expect(answerStyle('').text).toContain('copper');
    expect(answerStyle(null).text).toContain('copper');
  });

  it('always returns all three keys', () => {
    for (const a of ['YES', 'NO', 'MAYBE', 'WAIT', '']) {
      const s = answerStyle(a);
      expect(s).toHaveProperty('ring');
      expect(s).toHaveProperty('text');
      expect(s).toHaveProperty('glow');
    }
  });
});
