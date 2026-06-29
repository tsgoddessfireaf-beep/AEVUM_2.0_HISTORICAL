import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
const mockVerifyIdToken = vi.fn();
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockCount = vi.fn();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn((name) => ({
      doc: vi.fn((id) => ({
        get: mockGet,
        set: mockSet,
      })),
      where: mockWhere,
    })),
  })),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// Set up mockWhere returns
mockWhere.mockReturnValue({
  where: mockWhere,
  limit: mockLimit,
  count: mockCount,
});
mockLimit.mockReturnValue({
  get: mockGet,
});
mockCount.mockReturnValue({
  get: mockGet,
});

describe('firebaseAdmin initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  });

  it('initializes with ADC when FIREBASE_SERVICE_ACCOUNT_JSON is missing and ADC succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[firebase-admin] initialized with application default credentials'));
    consoleSpy.mockRestore();
  });

  it('fails initialization when FIREBASE_SERVICE_ACCOUNT_JSON is missing and ADC throws', async () => {
    const { initializeApp } = await import('firebase-admin/app');
    vi.mocked(initializeApp).mockImplementationOnce(() => {
      throw new Error('ADC not available');
    });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[firebase-admin] init failed:', 'ADC not available');
    consoleSpy.mockRestore();
  });

  it('logs warning when FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = 'invalid-json';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[firebase-admin] init failed:'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('logs warning when initializeApp throws', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
    const { initializeApp } = await import('firebase-admin/app');
    vi.mocked(initializeApp).mockImplementationOnce(() => {
      throw new Error('Init error');
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[firebase-admin] init failed:', 'Init error');
    consoleSpy.mockRestore();
  });

  it('logs warning when getFirestore throws', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
    const { getFirestore } = await import('firebase-admin/firestore');
    vi.mocked(getFirestore).mockImplementationOnce(() => {
      throw new Error('Firestore error');
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');

    expect(ADMIN_ENABLED).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[firebase-admin] init failed:', 'Firestore error');
    consoleSpy.mockRestore();
  });

  it('initializes successfully when everything is correct', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
    const { ADMIN_ENABLED } = await import('./firebaseAdmin.js');
    expect(ADMIN_ENABLED).toBe(true);
  });
});

describe('firebaseAdmin functions', () => {
  let firebaseAdmin;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
    firebaseAdmin = await import('./firebaseAdmin.js');

    // Reset the mock chain for each test
    mockWhere.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
      count: mockCount,
    });
    mockLimit.mockReturnValue({
      get: mockGet,
    });
    mockCount.mockReturnValue({
      get: mockGet,
    });
  });

  describe('verifyIdToken', () => {
    it('returns null if token is missing', async () => {
      expect(await firebaseAdmin.verifyIdToken(null)).toBeNull();
    });

    it('returns decoded token on success', async () => {
      const decoded = { uid: '123' };
      mockVerifyIdToken.mockResolvedValueOnce(decoded);
      expect(await firebaseAdmin.verifyIdToken('token')).toBe(decoded);
    });

    it('returns null on SDK error', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Auth error'));
      expect(await firebaseAdmin.verifyIdToken('token')).toBeNull();
    });
  });

  describe('getUserPlan', () => {
    it('returns free if doc not found', async () => {
      mockGet.mockResolvedValueOnce({ data: () => null });
      expect(await firebaseAdmin.getUserPlan('uid')).toBe('free');
    });

    it('returns plan from doc', async () => {
      mockGet.mockResolvedValueOnce({ data: () => ({ plan: 'pro' }) });
      expect(await firebaseAdmin.getUserPlan('uid')).toBe('pro');
    });

    it('returns free on Firestore error', async () => {
      mockGet.mockRejectedValueOnce(new Error('DB error'));
      expect(await firebaseAdmin.getUserPlan('uid')).toBe('free');
    });
  });

  describe('setUserPlan', () => {
    it('calls set with correct data', async () => {
      await firebaseAdmin.setUserPlan('uid', 'pro', { extra: 'data' });
      expect(mockSet).toHaveBeenCalledWith({ plan: 'pro', extra: 'data' }, { merge: true });
    });

    it('logs warning on Firestore error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockSet.mockRejectedValueOnce(new Error('DB error'));
      await firebaseAdmin.setUserPlan('uid', 'pro');
      expect(consoleSpy).toHaveBeenCalledWith('[firebase-admin] setUserPlan failed:', 'DB error');
      consoleSpy.mockRestore();
    });
  });

  describe('findUserByStripeCustomer', () => {
    it('returns user if found', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'uid123', data: () => ({ stripeCustomerId: 'cus_123' }) }],
      });
      const result = await firebaseAdmin.findUserByStripeCustomer('cus_123');
      expect(result).toEqual({ uid: 'uid123', stripeCustomerId: 'cus_123' });
    });

    it('returns null if not found', async () => {
      mockGet.mockResolvedValueOnce({ empty: true });
      expect(await firebaseAdmin.findUserByStripeCustomer('cus_123')).toBeNull();
    });

    it('returns null on Firestore error', async () => {
      mockGet.mockRejectedValueOnce(new Error('DB error'));
      expect(await firebaseAdmin.findUserByStripeCustomer('cus_123')).toBeNull();
    });
  });

  describe('getUserData', () => {
    it('returns data if found', async () => {
      const userData = { name: 'Test' };
      mockGet.mockResolvedValueOnce({ data: () => userData });
      expect(await firebaseAdmin.getUserData('uid')).toBe(userData);
    });

    it('returns null if not found', async () => {
      mockGet.mockResolvedValueOnce({ data: () => null });
      expect(await firebaseAdmin.getUserData('uid')).toBeNull();
    });

    it('returns null on Firestore error', async () => {
      mockGet.mockRejectedValueOnce(new Error('DB error'));
      expect(await firebaseAdmin.getUserData('uid')).toBeNull();
    });
  });

  describe('getMonthlyReadingCount', () => {
    it('returns count from snap', async () => {
      mockGet.mockResolvedValueOnce({ data: () => ({ count: 5 }) });
      expect(await firebaseAdmin.getMonthlyReadingCount('uid')).toBe(5);
    });

    it('returns 0 on Firestore error', async () => {
      mockGet.mockRejectedValueOnce(new Error('DB error'));
      expect(await firebaseAdmin.getMonthlyReadingCount('uid')).toBe(0);
    });
  });
});

describe('firebaseAdmin uninitialized', () => {
  let firebaseAdmin;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const { initializeApp } = await import('firebase-admin/app');
    vi.mocked(initializeApp).mockImplementation(() => {
      throw new Error('ADC not available');
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    firebaseAdmin = await import('./firebaseAdmin.js');
  });

  it('verifyIdToken returns null', async () => {
    expect(await firebaseAdmin.verifyIdToken('token')).toBeNull();
  });

  it('getUserPlan returns free', async () => {
    expect(await firebaseAdmin.getUserPlan('uid')).toBe('free');
  });

  it('setUserPlan returns undefined and does not throw', async () => {
    expect(await firebaseAdmin.setUserPlan('uid', 'pro')).toBeUndefined();
  });

  it('findUserByStripeCustomer returns null', async () => {
    expect(await firebaseAdmin.findUserByStripeCustomer('cus_123')).toBeNull();
  });

  it('getUserData returns null', async () => {
    expect(await firebaseAdmin.getUserData('uid')).toBeNull();
  });

  it('getMonthlyReadingCount returns 0', async () => {
    expect(await firebaseAdmin.getMonthlyReadingCount('uid')).toBe(0);
  });
});
