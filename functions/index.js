import { onRequest } from 'firebase-functions/v2/https';
import app from '../server/index.js';

export const api = onRequest(
  {
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    maxInstances: 20,
    concurrency: 80,
    secrets: ['ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY'],
  },
  app
);
