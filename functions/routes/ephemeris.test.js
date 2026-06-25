import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performJplVerification, fetchJPLPosition } from './ephemeris.js';
import fetch from 'node-fetch';

// Mock node-fetch to avoid making real API calls during test runs
vi.mock('node-fetch', () => {
  return {
    default: vi.fn()
  };
});

// Make JPL retry backoff instant in tests so the retry-on-transient-failure logic
// (4 attempts) doesn't blow the default test timeout. Production default is 600ms.
process.env.JPL_RETRY_BASE_MS = '0';

describe('fetchJPLPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully parses longitude from JPL response', async () => {
    const mockJplResponse = {
      result: `
$$SOE
 2026-May-21 17:00     123.4567890   0.0000000
$$EOE
`
    };
    fetch.mockResolvedValue({
      json: async () => mockJplResponse
    });

    const lon = await fetchJPLPosition('10', '2026-05-21T17:00:00Z');
    expect(lon).toBe(123.456789);
  });

  it('throws error if $$SOE/$$EOE block is missing', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ result: 'No delimiters here' })
    });

    await expect(fetchJPLPosition('10', '2026-05-21T17:00:00Z'))
      .rejects.toThrow('Could not find $$SOE/$$EOE block');
  });

  it('throws error if no data lines are found in block', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ result: '$$SOE\n\n$$EOE' })
    });

    await expect(fetchJPLPosition('10', '2026-05-21T17:00:00Z'))
      .rejects.toThrow('No data lines found in ephemeris');
  });

  it('throws error if data line is malformed', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ result: '$$SOE\nOnlyTwoParts\n$$EOE' })
    });

    await expect(fetchJPLPosition('10', '2026-05-21T17:00:00Z'))
      .rejects.toThrow('Malformed data line');
  });

  it('throws error if longitude is not a number', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ result: '$$SOE\n2026-May-21 17:00 NOT_A_NUMBER 0.0\n$$EOE' })
    });

    await expect(fetchJPLPosition('10', '2026-05-21T17:00:00Z'))
      .rejects.toThrow('Invalid longitude parsed');
  });
});

describe('performJplVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly audits ephemeris and flags verification: true when differences are within 0.0001°', async () => {
    // Mock JPL Horizons response format for each of the 7 planets
    const mockJplResponse = {
      result: `
*******************************************************************************
$$SOE
 2026-May-21 17:00     100.0001000   0.0000000
$$EOE
*******************************************************************************
`
    };

    fetch.mockResolvedValue({
      json: async () => mockJplResponse
    });

    const testData = {
      chart_meta: {
        utc_datetime: '2026-05-21T17:00:00'
      },
      planets: {
        Sun: { ecliptic_longitude: 100.00005 },
        Moon: { ecliptic_longitude: 100.00005 },
        Mercury: { ecliptic_longitude: 100.00005 },
        Venus: { ecliptic_longitude: 100.00005 },
        Mars: { ecliptic_longitude: 100.00005 },
        Jupiter: { ecliptic_longitude: 100.00005 },
        Saturn: { ecliptic_longitude: 100.00005 }
      }
    };

    await performJplVerification(testData);

    expect(testData.verification).toBeDefined();
    expect(testData.verification.verified).toBe(true);
    expect(testData.verification.max_diff_deg).toBeLessThanOrEqual(0.0001);
    expect(testData.verification.warnings).toHaveLength(0);
    expect(testData.verification.planets.Sun.jpl_lon).toBe(100.0001);
  });

  it('correctly handles circular longitude boundaries (e.g., 359.99995° vs 0.00003°)', async () => {
    // Mock JPL Horizons returning 0.00003°
    const mockJplResponse = {
      result: `
$$SOE
 2026-May-21 17:00     0.0000300   0.0000000
$$EOE
`
    };

    fetch.mockResolvedValue({
      json: async () => mockJplResponse
    });

    const testData = {
      chart_meta: {
        utc_datetime: '2026-05-21T17:00:00'
      },
      planets: {
        Sun: { ecliptic_longitude: 359.99995 },
        Moon: { ecliptic_longitude: 359.99995 },
        Mercury: { ecliptic_longitude: 359.99995 },
        Venus: { ecliptic_longitude: 359.99995 },
        Mars: { ecliptic_longitude: 359.99995 },
        Jupiter: { ecliptic_longitude: 359.99995 },
        Saturn: { ecliptic_longitude: 359.99995 }
      }
    };

    await performJplVerification(testData);

    expect(testData.verification).toBeDefined();
    expect(testData.verification.verified).toBe(true);
    // Circular difference between 359.99995° and 0.00003° is 0.00008° (within 0.0001° tolerance)
    expect(testData.verification.max_diff_deg).toBeCloseTo(0.00008, 5);
  });

  it('flags warning when discrepancy exceeds 0.0001°', async () => {
    // Mock JPL Horizons returning 100.0°
    const mockJplResponse = {
      result: `
$$SOE
 2026-May-21 17:00     100.0000000   0.0000000
$$EOE
`
    };

    fetch.mockResolvedValue({
      json: async () => mockJplResponse
    });

    const testData = {
      chart_meta: {
        utc_datetime: '2026-05-21T17:00:00'
      },
      planets: {
        Sun: { ecliptic_longitude: 100.015 }, // discrepancy is 0.015° (> 0.0001°)
        Moon: { ecliptic_longitude: 100.000 },
        Mercury: { ecliptic_longitude: 100.000 },
        Venus: { ecliptic_longitude: 100.000 },
        Mars: { ecliptic_longitude: 100.000 },
        Jupiter: { ecliptic_longitude: 100.000 },
        Saturn: { ecliptic_longitude: 100.000 }
      }
    };

    await performJplVerification(testData);

    expect(testData.verification).toBeDefined();
    expect(testData.verification.verified).toBe(false);
    expect(testData.verification.max_diff_deg).toBeCloseTo(0.015, 5);
    expect(testData.verification.warnings).toHaveLength(1);
    expect(testData.verification.warnings[0]).toContain('exceeds 0.0001°');
  });

  it('gracefully handles failures during JPL Horizons fetches without crashing the chart output', async () => {
    // Make fetch throw an error
    fetch.mockRejectedValue(new Error('Network error or rate limit'));

    const testData = {
      chart_meta: {
        utc_datetime: '2026-05-21T17:00:00'
      },
      planets: {
        Sun: { ecliptic_longitude: 100.0 },
        Moon: { ecliptic_longitude: 100.0 },
        Mercury: { ecliptic_longitude: 100.0 },
        Venus: { ecliptic_longitude: 100.0 },
        Mars: { ecliptic_longitude: 100.0 },
        Jupiter: { ecliptic_longitude: 100.0 },
        Saturn: { ecliptic_longitude: 100.0 }
      }
    };

    // Should resolve successfully instead of throwing
    await expect(performJplVerification(testData)).resolves.not.toThrow();

    expect(testData.verification).toBeDefined();
    expect(testData.verification.verified).toBe(false);
    expect(testData.verification.warnings.length).toBeGreaterThan(0);
    expect(testData.verification.warnings[0]).toContain('Could not verify');
  });

  it('handles missing data.planets gracefully', async () => {
    const testData = {
      chart_meta: { utc_datetime: '2026-05-21T17:00:00' }
      // planets missing
    };

    await performJplVerification(testData);
    expect(testData.verification).toBeUndefined();
  });

  it('handles missing utc_datetime gracefully', async () => {
    const testData = {
      planets: { Sun: { ecliptic_longitude: 100.0 } }
    };

    await performJplVerification(testData);
    expect(testData.verification).toBeUndefined();
  });

  it('sets "No planets could be verified" warning when no planets match', async () => {
    const mockJplResponse = {
      result: `$$SOE\n 2026-May-21 17:00 100.0 0.0\n$$EOE`
    };
    fetch.mockResolvedValue({ json: async () => mockJplResponse });

    const testData = {
      chart_meta: { utc_datetime: '2026-05-21T17:00:00' },
      planets: {
        UnknownPlanet: { ecliptic_longitude: 100.0 }
      }
    };

    await performJplVerification(testData);
    expect(testData.verification.verified).toBe(false);
    expect(testData.verification.warnings).toContain('No planets could be verified');
  });

  it('handles partial failures where some planets fail to verify', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('COMMAND=10')) { // Sun
        return {
          json: async () => ({
            result: `$$SOE\n 2026-May-21 17:00 100.0 0.0\n$$EOE`
          })
        };
      }
      throw new Error('JPL Fetch Failed for others');
    });

    const testData = {
      chart_meta: { utc_datetime: '2026-05-21T17:00:00' },
      planets: {
        Sun: { ecliptic_longitude: 100.0 },
        Moon: { ecliptic_longitude: 100.0 }
      }
    };

    await performJplVerification(testData);
    expect(testData.verification.verified).toBe(false);
    expect(testData.verification.planets.Sun).toBeDefined();
    expect(testData.verification.warnings.some(w => w.includes('Could not verify Moon'))).toBe(true);
  });

  it('triggers the outer catch block of performJplVerification', async () => {
    const testData = {
      chart_meta: { utc_datetime: '2026-05-21T17:00:00' },
      planets: { Sun: { ecliptic_longitude: 100.0 } }
    };

    const originalEntries = Object.entries;
    const spy = vi.spyOn(Object, 'entries').mockImplementation((obj) => {
      if (obj && obj.Sun === '10') {
        throw new Error('Simulated outer failure');
      }
      return originalEntries(obj);
    });

    try {
      await performJplVerification(testData);
      expect(testData.verification.warnings).toContain('Verification process failed: Simulated outer failure');
    } finally {
      spy.mockRestore();
    }
  });
});
