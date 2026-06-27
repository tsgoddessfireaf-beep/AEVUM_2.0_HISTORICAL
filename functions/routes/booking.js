// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { Router } from 'express';
import Stripe from 'stripe';
import { Resend } from 'resend';

const router = Router();

// 🛡️ Sentinel: Escape HTML to prevent XSS in email templates
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
}

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const getBaseUrl = (req) =>
  process.env.NODE_ENV === 'production'
    ? 'https://aevum-plp9.onrender.com'
    : (req.headers.origin || 'http://localhost:3000');

// POST /api/booking/create-session
// Public — no auth required. Creates a one-time Stripe checkout for an $88 horary reading.
router.post('/create-session', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Payments not configured on this server.' });

  const question = (req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Question is required.' });

  const priceId = process.env.STRIPE_BOOKING_PRICE_ID;
  if (!priceId) return res.status(501).json({ error: 'Booking price not configured.' });

  try {
    const baseUrl = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      // {CHECKOUT_SESSION_ID} is a Stripe template variable — replaced automatically on redirect
      success_url: `${baseUrl}/upgrade/success?booking=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/upgrade`,
      customer_creation: 'always',
      metadata: {
        question: question.slice(0, 500),
        source: 'aevum-casebook-review',
      },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[booking] create-session failed:', err.message);
    res.status(500).json({ error: 'Failed to create booking session.' });
  }
});

// POST /api/booking/confirm
// Called from the success page with the Stripe session ID.
// Verifies payment is complete, then sends the Resend confirmation email.
// Idempotent — safe to call more than once (Stripe retrieval is read-only).
router.post('/confirm', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Payments not configured on this server.' });

  const sessionId = (req.body?.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'session_id is required.' });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[booking] session retrieve failed:', err.message);
    return res.status(400).json({ error: 'Invalid session ID.' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'Payment not completed.' });
  }

  const customerEmail = session.customer_details?.email;
  const question      = escapeHtml(session.metadata?.question || '(not recorded)');
  const amountPaid    = `$${((session.amount_total ?? 0) / 100).toFixed(2)}`;

  const resend = getResend();
  if (resend && customerEmail) {
    try {
      await resend.emails.send({
        from: 'Aeonic Arts <readings@aeonicarts.com>',
        to:   customerEmail,
        subject: 'Your Astrological Case Study Review is Scheduled — Aeonic Arts',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #0f172a; margin-bottom: 4px;">Your astrological case study review is in progress.</h2>
            <p style="color: #475569; margin-top: 0;">Traditional case study calculation & review modeling William Lilly's 1647 rules.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p><strong>Question:</strong><br>${question}</p>
            <p><strong>Amount paid:</strong> ${amountPaid}</p>
            <p><strong>Delivery:</strong> Formal rule-based case study report + 9-slide narrated walkthrough deck within 72 hours</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p>Your case report and narrated slide presentation will be delivered to this email address. Questions? Reply here or contact
              <a href="mailto:readings@aeonicarts.com" style="color: #0ea5e9;">readings@aeonicarts.com</a>
            </p>
            <p style="margin-top: 32px; color: #94a3b8; font-size: 14px;">
              — Dolores | Aeonic Arts<br>
              <em>Honoring the craft, kept intact.</em>
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Log but don't fail — payment is confirmed, email is best-effort
      console.error('[booking] resend email failed:', emailErr.message);
    }
  }

  res.json({ ok: true, email: customerEmail || null });
});

export default router;
