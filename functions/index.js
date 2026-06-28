// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — Cloud Functions entry point. Wraps the Express API for Firebase.

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

setGlobalOptions({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '1GiB',
  // Keep one instance always warm so the ephemeris calibration (per-instance,
  // in-memory) stays true and /api/health never flickers to calibrated:false on
  // a cold start. Recurring cost is covered by Google Cloud credits.
  minInstances: 1,
});

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,
  });
}

const app = express();
app.disable('x-powered-by');

const allowedOrigins = [
  'https://gen-lang-client-0022917921.web.app',
  'https://gen-lang-client-0022917921.firebaseapp.com',
  'https://aevum.aeonicarts.com',
];

app.use(compression());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook needs raw body — must come BEFORE express.json
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.set('trust proxy', 1);

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please wait a few minutes and try again.' },
});

const { default: chatRoutes } = await import('./routes/chat.js');
const { default: ephemerisRoutes, getCalibrationStatus, warmupAndCalibrate } = await import('./routes/ephemeris.js');
const { default: stripeRoutes } = await import('./routes/stripe.js');
const { default: bookingRoutes } = await import('./routes/booking.js');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', calibrated: getCalibrationStatus() });
});

app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/ephemeris', aiLimiter, ephemerisRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/booking', bookingRoutes);

if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}

// FUNCTION_TARGET is set only at actual Cloud Function runtime — not during the Firebase
// CLI analysis pass that merely loads this module to discover exports. Kick off the
// ephemeris warm-up + JPL calibration on cold start so /api/health reports `calibrated:true`
// once the Swiss Ephemeris sidecar (EPHEMERIS_URL) is reachable and verified.
if (process.env.FUNCTION_TARGET) {
  warmupAndCalibrate();
}

export const api = onRequest(app);
