// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { Router } from 'express';
import Stripe from 'stripe';
import {
  verifyIdToken,
  setUserPlan,
  findUserByStripeCustomer,
  getUserData,
  ADMIN_ENABLED,
} from '../lib/firebaseAdmin.js';

const router = Router();

let _stripe = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  }
  return _stripe;
}

export function stripeEnabled(res) {
  if (!getStripe()) {
    res.status(501).json({ error: 'Payments not configured on this server.' });
    return false;
  }
  return true;
}

const getBaseUrl = (req) => process.env.NODE_ENV === 'production' ? 'https://app.aeonicarts.com' : (req.headers.origin || 'http://localhost:3000');

// POST /api/stripe/create-checkout-session
export async function createCheckoutSession(req, res) {
  if (!stripeEnabled(res)) return;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = await verifyIdToken(token);
  if (!decoded?.uid) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const baseUrl = getBaseUrl(req);
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/upgrade/success`,
      cancel_url: `${baseUrl}/upgrade`,
      client_reference_id: decoded?.uid ?? 'anonymous',
      ...(decoded?.email ? { customer_email: decoded.email } : {}),
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] create-checkout-session failed:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
}
router.post('/create-checkout-session', createCheckoutSession);

// POST /api/stripe/portal
export async function portal(req, res) {
  if (!stripeEnabled(res)) return;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = await verifyIdToken(token);
  if (!decoded?.uid) return res.status(401).json({ error: 'Unauthorized.' });

  if (!ADMIN_ENABLED) return res.status(501).json({ error: 'Admin not configured.' });
  const userData = await getUserData(decoded.uid);
  const customerId = userData?.stripeCustomerId;
  if (!customerId) return res.status(400).json({ error: 'No active subscription found.' });

  try {
    const baseUrl = getBaseUrl(req);
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/ask`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] portal failed:', err.message);
    res.status(500).json({ error: 'Failed to create portal session.' });
  }
}
router.post('/portal', portal);

// POST /api/stripe/webhook  (raw body — registered before express.json in index.js)
export async function webhookHandler(req, res) {
  if (!stripeEnabled(res)) return;
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn('[stripe] webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.client_reference_id;
      if (uid && uid !== 'anonymous') {
        await setUserPlan(uid, 'paid', {
          stripeCustomerId:     session.customer,
          stripeSubscriptionId: session.subscription,
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const user = await findUserByStripeCustomer(sub.customer);
      if (user) {
        await setUserPlan(user.uid, 'free', { stripeSubscriptionId: null });
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      if (sub.status !== 'active') {
        const user = await findUserByStripeCustomer(sub.customer);
        if (user) {
          await setUserPlan(user.uid, 'free', { stripeSubscriptionId: null });
        }
      }
    }
  } catch (err) {
    console.error('[stripe] webhook handler error:', err.message);
  }

  res.json({ received: true });
}
router.post('/webhook', webhookHandler);

export default router;
