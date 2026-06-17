// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import dotenv from 'dotenv';
// override:true forces .env values over shell env vars
dotenv.config({ override: true });

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
  ? ['https://aevum-plp9.onrender.com']
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

app.listen(PORT, () => {
  console.log(`Aevum server running on http://localhost:${PORT}`);
  // Start background calibration check
  warmupAndCalibrate();
});
