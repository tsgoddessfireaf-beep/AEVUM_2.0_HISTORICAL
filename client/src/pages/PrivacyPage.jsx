// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { useNavigate } from 'react-router-dom';

const EFFECTIVE_DATE = 'May 19, 2026';
const CONTACT_EMAIL  = 'tsgoddessfireaf@gmail.com';

function Section({ title, children }) {
  return (
    <div className="bg-teal-700/80 border border-teal-600/50 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-copper-400 text-xs uppercase tracking-widest mb-4">{title}</h2>
      <div className="space-y-3 text-silver text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/**
 * Privacy Policy page for Aevum.
 * Covers data collection, third-party services, retention, and user rights
 * in plain language. Required by GDPR/CCPA before consent is legally complete.
 */
export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-5">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-copper-400 text-3xl mb-4 font-serif">✦</div>
          <h1 className="text-2xl font-serif text-bone tracking-wide">Privacy Policy</h1>
          <p className="text-silver/40 text-xs mt-2">
            Aevum — Dolores Aeonic Arts &nbsp;·&nbsp; Effective {EFFECTIVE_DATE} &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        {/* Intro */}
        <div className="text-silver text-sm leading-relaxed px-1">
          This policy explains what information Aevum collects, why, who can see it, and what you
          can do about it. It is written in plain language — no legalese.
        </div>

        <Section title="Who We Are">
          <p>
            Aevum is a horary astrology application made by Dolores Puckett, operating as
            Dolores Aeonic Arts. For privacy questions or data requests, contact:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}
               className="text-copper-400 hover:text-copper-300 underline underline-offset-2 transition-colors">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <Section title="What We Collect">
          <p className="text-bone/75 font-medium">All users (including anonymous)</p>
          <ul className="space-y-1.5 ml-1">
            {[
              'Your horary question',
              'The date, time, timezone, and city you provide for the chart',
              'The house signification interview conversation',
              "Gemini's reading and your follow-up questions",
              'Journal entries: accuracy ratings and outcome notes you write',
              'An anonymous Firebase identifier (uid) — a random string, not tied to your name',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-copper-400/60 mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-bone/75 font-medium pt-2">If you sign in with Google (optional)</p>
          <ul className="space-y-1.5 ml-1">
            {[
              'Your Google display name and profile photo',
              'Your Google email address',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-copper-400/60 mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>
          <p>
            Google sign-in is optional and only used to sync your reading history across devices.
            You can use Aevum fully without it.
          </p>

          <p className="text-bone/75 font-medium pt-2">What we never collect</p>
          <ul className="space-y-1.5 ml-1">
            {[
              'Payment information',
              'IP addresses or precise geolocation (the city name you type is all we store)',
              'Browsing behaviour or tracking pixels',
              'Data from any source other than what you personally enter',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-500/70 mt-0.5 shrink-0">✗</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Third-Party Services">
          <div className="space-y-4">
            <div>
              <p className="text-bone/75 font-medium">Google (Gemini AI)</p>
              <p>
                Your question and chart data are sent to Google's Gemini API to generate
                your reading. Google does not use API inputs to train their models for
                developer/API accounts by default. See{' '}
                <span className="text-silver/70">ai.google.dev/terms</span> for their policy.
              </p>
            </div>
            <div>
              <p className="text-bone/75 font-medium">Google Firebase</p>
              <p>
                Reading data is stored in Firebase Firestore (Google Cloud, Oregon region).
                Authentication is handled by Firebase Auth. Google's data processing terms
                apply. See{' '}
                <span className="text-silver/70">firebase.google.com/support/privacy</span>.
              </p>
            </div>
            <div>
              <p className="text-bone/75 font-medium">OpenStreetMap Nominatim</p>
              <p>
                If you use the "Now" button for location detection, your browser's GPS
                coordinates are sent to OpenStreetMap's Nominatim service to retrieve your
                city name. No account or identifier is sent — it is a single anonymous
                lookup. See{' '}
                <span className="text-silver/70">osmfoundation.org/wiki/Privacy_Policy</span>.
              </p>
            </div>
            <div>
              <p className="text-bone/75 font-medium">Render</p>
              <p>
                The Aevum server runs on Render (Oregon, US). Render may retain request
                logs for operational purposes. See{' '}
                <span className="text-silver/70">render.com/privacy</span>.
              </p>
            </div>
          </div>
        </Section>

        <Section title="How We Use Your Data">
          <ul className="space-y-2 ml-1">
            {[
              'To cast your horary chart and deliver your reading',
              'To save your reading history so you can review past charts',
              'To allow follow-up questions grounded in your specific chart',
              'To store your journal entries alongside the relevant reading',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-emerald-500/70 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <p>
            We do not sell your data, share it with advertisers, or use it for any purpose
            beyond operating the app.
          </p>
        </Section>

        <Section title="Training Data (Opt-In Only)">
          <p>
            We may in the future use anonymised reading data to improve Aevum's
            interpretations. This is entirely optional. You will be asked separately for
            consent before any of your data is used this way, and you can change your
            decision at any time from the{' '}
            <button
              onClick={() => navigate('/consent')}
              className="text-copper-400 hover:text-copper-300 underline underline-offset-2 transition-colors"
            >
              Data & Privacy
            </button>{' '}
            settings page.
          </p>
          <p>
            If you opt in, only anonymised content is used — your question, chart,
            reading, follow-ups, and journal ratings. Your name, email, and Google
            profile are never included.
          </p>
          <p>
            The default is <span className="text-bone/90">off</span>.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            Your readings are stored in Firestore indefinitely so you can access your
            history. Anonymous sessions are tied to your browser — if you clear browser
            data, the local session ends, but your Firestore readings remain and can be
            recovered by signing in with the same Google account.
          </p>
          <p>
            To delete your data, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}
               className="text-copper-400 hover:text-copper-300 underline underline-offset-2 transition-colors">
              {CONTACT_EMAIL}
            </a>{' '}
            with "Delete my data" in the subject line. We will delete your Firestore
            documents within 30 days and confirm by reply.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>
            Depending on where you live, you may have rights under GDPR (EU/UK) or CCPA
            (California). These include:
          </p>
          <ul className="space-y-1.5 ml-1">
            {[
              'Access — request a copy of all data we hold about you',
              'Deletion — request that your data be erased',
              'Correction — request that inaccurate data be corrected',
              'Portability — receive your data in a machine-readable format',
              'Opt-out — withdraw consent for training data use at any time',
              'Object — object to any processing you did not explicitly authorise',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-copper-400/60 mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>
          <p>
            To exercise any of these rights, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}
               className="text-copper-400 hover:text-copper-300 underline underline-offset-2 transition-colors">
              {CONTACT_EMAIL}
            </a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            If we make material changes, we will update the effective date and version
            number at the top of this page and show a notice on the Data & Privacy
            settings page. Continued use of Aevum after changes are posted constitutes
            acceptance of the updated policy.
          </p>
        </Section>

        {/* Footer nav */}
        <div className="flex gap-4 justify-center pt-2 pb-8 text-xs">
          <button
            onClick={() => navigate('/consent')}
            className="text-copper-400 hover:text-copper-300 transition-colors"
          >
            Data & Privacy Settings →
          </button>
          <button
            onClick={() => navigate(-1)}
            className="text-silver/40 hover:text-silver transition-colors"
          >
            ← Back
          </button>
        </div>

      </div>
    </div>
  );
}
