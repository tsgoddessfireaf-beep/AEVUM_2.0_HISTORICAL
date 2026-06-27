import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckoutSession, portal, webhookHandler } from './stripe.js';
import * as firebaseAdmin from '../lib/firebaseAdmin.js';

// Define the mock object outside so we can access its methods in tests
const mockStripeInstance = {
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

// Mock Stripe - Corrected to work as a constructor
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return mockStripeInstance;
    }),
  };
});

// Mock firebaseAdmin
vi.mock('../lib/firebaseAdmin.js', () => ({
  verifyIdToken: vi.fn(),
  setUserPlan: vi.fn(),
  findUserByStripeCustomer: vi.fn(),
  getUserData: vi.fn(),
  ADMIN_ENABLED: true,
}));

describe('stripe routes', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_PRICE_ID = 'price_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';

    mockReq = {
      headers: {
        origin: 'http://localhost:3000',
        authorization: 'Bearer mock-token',
      },
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('createCheckoutSession', () => {
    it('creates a checkout session successfully', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: 'user123', email: 'test@example.com' });
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({ url: 'http://stripe.com/checkout' });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        client_reference_id: 'user123',
        customer_email: 'test@example.com',
      }));
      expect(mockRes.json).toHaveBeenCalledWith({ url: 'http://stripe.com/checkout' });
    });

    it('handles stripe errors and returns 500', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: 'user123' });
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'));

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session.' });
    });
  });

  describe('portal', () => {
    it('creates a billing portal session successfully', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: 'user123' });
      firebaseAdmin.getUserData.mockResolvedValue({ stripeCustomerId: 'cus_123' });
      mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({ url: 'http://stripe.com/portal' });

      await portal(mockReq, mockRes);

      expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'http://localhost:3000/ask',
      });
      expect(mockRes.json).toHaveBeenCalledWith({ url: 'http://stripe.com/portal' });
    });

    it('returns 401 if unauthorized', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue(null);

      await portal(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized.' });
    });

    it('returns 400 if no customer ID found', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: 'user123' });
      firebaseAdmin.getUserData.mockResolvedValue({});

      await portal(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No active subscription found.' });
    });

    it('handles stripe errors and returns 500', async () => {
      firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: 'user123' });
      firebaseAdmin.getUserData.mockResolvedValue({ stripeCustomerId: 'cus_123' });
      mockStripeInstance.billingPortal.sessions.create.mockRejectedValue(new Error('Stripe Portal error'));

      await portal(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create portal session.' });
    });
  });

  describe('webhookHandler', () => {
    it('returns 400 on signature failure', async () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Webhook Error'));
    });

    it('handles checkout.session.completed', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user123',
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);

      await webhookHandler(mockReq, mockRes);

      expect(firebaseAdmin.setUserPlan).toHaveBeenCalledWith('user123', 'paid', {
        stripeCustomerId:     'cus_123',
        stripeSubscriptionId: 'sub_123',
      });
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });

    it('handles customer.subscription.deleted', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
          },
        },
      };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      firebaseAdmin.findUserByStripeCustomer.mockResolvedValue({ uid: 'user123' });

      await webhookHandler(mockReq, mockRes);

      expect(firebaseAdmin.setUserPlan).toHaveBeenCalledWith('user123', 'free', {
        stripeSubscriptionId: null,
      });
    });

    it('handles customer.subscription.updated to free if not active', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'past_due',
          },
        },
      };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      firebaseAdmin.findUserByStripeCustomer.mockResolvedValue({ uid: 'user123' });

      await webhookHandler(mockReq, mockRes);

      expect(firebaseAdmin.setUserPlan).toHaveBeenCalledWith('user123', 'free', {
        stripeSubscriptionId: null,
      });
    });

    it('ignores customer.subscription.updated if still active', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'active',
          },
        },
      };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);

      await webhookHandler(mockReq, mockRes);

      expect(firebaseAdmin.setUserPlan).not.toHaveBeenCalled();
    });

    it('logs error but returns received:true if processing fails', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: 'user123' } },
      };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      firebaseAdmin.setUserPlan.mockRejectedValue(new Error('DB error'));

      await webhookHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
