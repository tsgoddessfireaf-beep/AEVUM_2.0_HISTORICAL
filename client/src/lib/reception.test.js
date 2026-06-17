import { describe, it, expect } from 'vitest';
import { getReceptions, receptionLabel } from './reception.js';

function planets(entries) {
  return {
    planets: Object.fromEntries(
      entries.map(([name, sign]) => [name, { sign, sign_degree: 0 }])
    ),
  };
}

describe('getReceptions', () => {
  it('returns empty array for missing data', () => {
    expect(getReceptions(null)).toEqual([]);
    expect(getReceptions({})).toEqual([]);
  });

  it('detects mutual reception by rulership', () => {
    // Sun in Cancer (Moon rules Cancer), Moon in Leo (Sun rules Leo)
    const data = planets([['Sun', 'Cancer'], ['Moon', 'Leo']]);
    const recs = getReceptions(data);
    expect(recs).toHaveLength(1);
    expect(recs[0].mutual).toBe(true);
    expect(recs[0].type).toBe('mutual_rulership');
    expect(recs[0].p1ReceivesP2).toBe('rulership'); // Sun receives Moon (Moon in Leo)
    expect(recs[0].p2ReceivesP1).toBe('rulership'); // Moon receives Sun (Sun in Cancer)
  });

  it('detects mutual reception by exaltation', () => {
    // Saturn in Aries (Sun exalted in Aries), Sun in Libra (Saturn exalted in Libra)
    const data = planets([['Sun', 'Libra'], ['Saturn', 'Aries']]);
    const recs = getReceptions(data);
    expect(recs).toHaveLength(1);
    expect(recs[0].mutual).toBe(true);
    expect(recs[0].type).toBe('mutual_exaltation');
  });

  it('detects mutual mixed reception (rulership + exaltation)', () => {
    // Venus in Cancer (Jupiter exalted in Cancer), Jupiter in Taurus (Venus rules Taurus)
    const data = planets([['Venus', 'Cancer'], ['Jupiter', 'Taurus']]);
    const recs = getReceptions(data);
    expect(recs).toHaveLength(1);
    expect(recs[0].mutual).toBe(true);
    expect(recs[0].type).toBe('mutual_mixed');
  });

  it('detects one-way reception', () => {
    // Mars in Taurus (Venus rules Taurus), Venus in Gemini (Mars has no dignity there)
    // CLASSICAL order: Venus(3) < Mars(4), so p1=Venus, p2=Mars
    // Venus receives Mars = Mars is in Venus's sign (Taurus) → p1ReceivesP2 = 'rulership'
    const data = planets([['Mars', 'Taurus'], ['Venus', 'Gemini']]);
    const recs = getReceptions(data);
    expect(recs).toHaveLength(1);
    expect(recs[0].mutual).toBe(false);
    expect(recs[0].type).toBe('one_way');
    expect(recs[0].p1).toBe('Venus');
    expect(recs[0].p2).toBe('Mars');
    expect(recs[0].p1ReceivesP2).toBe('rulership'); // Venus receives Mars (Mars in Taurus)
    expect(recs[0].p2ReceivesP1).toBeNull();
  });

  it('returns nothing when no reception exists', () => {
    // Sun in Gemini (no planet has dignity in Gemini except Mercury)
    // Moon in Capricorn (no planet dignified there except Saturn/Mars fall)
    const data = planets([['Sun', 'Gemini'], ['Moon', 'Capricorn']]);
    // Mercury rules Gemini — but Moon is not Mercury, and Saturn rules Capricorn — but Sun is not Saturn
    // So Sun-Moon pair: Sun in Gemini (Moon has no dignity there), Moon in Capricorn (Sun has no dignity there)
    const recs = getReceptions(data).filter(r => r.p1 === 'Sun' && r.p2 === 'Moon');
    expect(recs).toHaveLength(0);
  });

  it('returns multiple receptions for a busy chart', () => {
    // Sun in Cancer, Moon in Leo → mutual rulership (Sun-Moon)
    // Venus in Pisces, Jupiter in Taurus → mutual rulership (Venus-Jupiter):
    //   Venus receives Jupiter (Jupiter in Taurus, Venus rules Taurus)
    //   Jupiter receives Venus (Venus in Pisces, Jupiter rules Pisces)
    const data = planets([
      ['Sun', 'Cancer'], ['Moon', 'Leo'],
      ['Venus', 'Pisces'], ['Jupiter', 'Taurus'],
    ]);
    const recs = getReceptions(data);
    const mutual = recs.filter(r => r.mutual);
    expect(mutual.length).toBeGreaterThanOrEqual(2);
  });
});

describe('receptionLabel', () => {
  it('labels mutual rulership reception', () => {
    const rec = { p1: 'Sun', p2: 'Moon', mutual: true, type: 'mutual_rulership', p1ReceivesP2: 'rulership', p2ReceivesP1: 'rulership' };
    expect(receptionLabel(rec)).toContain('mutual reception by rulership');
  });

  it('labels one-way reception', () => {
    const rec = { p1: 'Mars', p2: 'Venus', mutual: false, type: 'one_way', p1ReceivesP2: null, p2ReceivesP1: 'rulership' };
    expect(receptionLabel(rec)).toContain('Venus receives Mars');
  });

  it('adds perfection note when applying aspect exists between the pair', () => {
    const rec = { p1: 'Mars', p2: 'Venus', mutual: true, type: 'mutual_rulership', p1ReceivesP2: 'rulership', p2ReceivesP1: 'rulership' };
    const aspects = [{ p1: 'Mars', p2: 'Venus', aspect: 'Trine', applying: true, orb: 2 }];
    expect(receptionLabel(rec, aspects)).toContain('perfection strongly indicated');
  });

  it('does not add perfection note for separating aspect', () => {
    const rec = { p1: 'Mars', p2: 'Venus', mutual: true, type: 'mutual_rulership', p1ReceivesP2: 'rulership', p2ReceivesP1: 'rulership' };
    const aspects = [{ p1: 'Mars', p2: 'Venus', aspect: 'Trine', applying: false, orb: 2 }];
    expect(receptionLabel(rec, aspects)).not.toContain('perfection');
  });
});
