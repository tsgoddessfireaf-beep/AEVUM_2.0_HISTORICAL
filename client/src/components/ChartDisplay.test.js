import { describe, it, expect } from 'vitest';
import { eclipticToSign } from './ChartDisplay.jsx';

describe('eclipticToSign', () => {
  it('returns Aries for 0°', () => {
    expect(eclipticToSign(0)).toMatch(/^Aries/);
  });

  it('returns Taurus for 30°', () => {
    expect(eclipticToSign(30)).toMatch(/^Taurus/);
  });

  it('returns Pisces for 330°', () => {
    expect(eclipticToSign(330)).toMatch(/^Pisces/);
  });

  it('returns Scorpio for 210°', () => {
    expect(eclipticToSign(210)).toMatch(/^Scorpio/);
  });

  it('shows the degree within the sign', () => {
    const result = eclipticToSign(45.5);  // Taurus 15.5°
    expect(result).toContain('15.5');
  });

  it('handles the start of a sign boundary exactly', () => {
    expect(eclipticToSign(60)).toMatch(/^Gemini 0\.0°/);
  });
});
