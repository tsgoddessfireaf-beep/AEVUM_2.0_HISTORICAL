import { describe, it, expect } from 'vitest';
import { buildReadingFilename } from './filename.js';

const base = {
  dateTimeData: { date: '2026-05-18', time: '14:30', location: 'Tampa, USA' },
  houseSignifications: { quesited_label: 'romantic partner', question_type: 'relationship' },
};

describe('buildReadingFilename', () => {
  it('produces expected format', () => {
    expect(buildReadingFilename(base)).toBe(
      'Aevum 2026-05-18 1430 Tampa [You, romantic partner, relationship] Horary Report'
    );
  });

  it('strips illegal filename characters from location', () => {
    const result = buildReadingFilename({
      ...base,
      dateTimeData: { ...base.dateTimeData, location: 'New York/City: USA' },
    });
    expect(result).not.toMatch(/[<>:"/\\|?*]/);
  });

  it('uses only the city portion of a "City, Country" location', () => {
    const result = buildReadingFilename(base);
    expect(result).toContain('Tampa');
    expect(result).not.toContain('USA');
  });

  it('omits empty location gracefully', () => {
    const result = buildReadingFilename({
      ...base,
      dateTimeData: { ...base.dateTimeData, location: '' },
    });
    expect(result).toContain('Aevum');
    expect(result).toContain('2026-05-18');
  });

  it('handles null houseSignifications without throwing', () => {
    expect(() =>
      buildReadingFilename({ dateTimeData: base.dateTimeData, houseSignifications: null })
    ).not.toThrow();
  });

  it('truncates a very long quesited_label', () => {
    const longLabel = 'a'.repeat(100);
    const result = buildReadingFilename({
      ...base,
      houseSignifications: { quesited_label: longLabel, question_type: 'career' },
    });
    expect(result.length).toBeLessThan(300);
  });
});
