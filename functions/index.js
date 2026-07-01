// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import dotenv from 'dotenv';
// override:true forces .env values over shell env vars
dotenv.config({ override: true });

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '1GiB',
  minInstances: 1,
});

import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chatRoutes from './routes/chat.js';
import ephemerisRoutes, { getCalibrationStatus, warmupAndCalibrate } from './routes/ephemeris.js';
import stripeRoutes from './routes/stripe.js';
import bookingRoutes from './routes/booking.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://app.aeonicarts.com',
      'https://aeonicarts.com',
      'https://aevum-app.web.app',
      'https://aevum-app.firebaseapp.com',
      'https://flutter-ai-playground-f880c.web.app',
      'https://flutter-ai-playground-f880c.firebaseapp.com',
      'https://gen-lang-client-0022917921.web.app',
      'https://gen-lang-client-0022917921.firebaseapp.com',
    ]
  : true; // allow all localhost origins in dev

app.use(compression());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook needs the raw body for signature verification — must come before express.json
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

// 30 AI requests per IP per 15 minutes — prevents runaway API cost from a single client.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please wait a few minutes and try again.' },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', calibrated: getCalibrationStatus() });
});

app.get('/api/test-outbound', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'GET' });
    const text = await response.text();
    res.json({ status: response.status, text });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/ephemeris', aiLimiter, ephemerisRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/booking', bookingRoutes);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy to get correct client IP for rate limiting
  app.use(express.static(join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

// Sentry error handler must be registered after all routes
if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}

// FUNCTION_TARGET is set by Firebase at actual Cloud Function runtime (not during CLI analysis).
const isFirebaseRuntime = !!process.env.FUNCTION_TARGET;
const isMain = process.argv[1] && /server[/\\]index/.test(process.argv[1]);

if (isMain) {
  // Local dev / Render: start server normally
  app.listen(PORT, () => {
    console.log(`Aevum server running on http://localhost:${PORT}`);
    warmupAndCalibrate();
  });
} else if (isFirebaseRuntime) {
  // Firebase Cloud Function runtime: trigger calibration on cold start
  warmupAndCalibrate();
}
// Firebase CLI analysis phase: just export the app, do nothing else

import { defineSecret } from 'firebase-functions/params';

const anthropicKey = defineSecret('ANTHROPIC_API_KEY');
const stripeSecret = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhook = defineSecret('STRIPE_WEBHOOK_SECRET');

export const api = onRequest(
  { secrets: [anthropicKey, stripeSecret, stripeWebhook] },
  app
);
export default app;
