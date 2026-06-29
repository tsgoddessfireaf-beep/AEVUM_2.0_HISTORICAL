// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { initAuth } from './lib/firebase.js';
import { applyTheme } from './components/dashboard/ThemesTab.jsx';
import LandingPage from './pages/LandingPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';

const IntakePage            = lazy(() => import('./pages/IntakePage.jsx'));
const DateTimePage          = lazy(() => import('./pages/DateTimePage.jsx'));
const HouseSignificationPage = lazy(() => import('./pages/HouseSignificationPage.jsx'));
const DashboardPage         = lazy(() => import('./pages/DashboardPage.jsx'));
const HistoryPage           = lazy(() => import('./pages/HistoryPage.jsx'));
const ConsentPage           = lazy(() => import('./pages/ConsentPage.jsx'));
const PrivacyPage           = lazy(() => import('./pages/PrivacyPage.jsx'));
const SharedReadingPage     = lazy(() => import('./pages/SharedReadingPage.jsx'));
const FontCalibratePage     = lazy(() => import('./pages/FontCalibratePage.jsx'));
const UpgradePage           = lazy(() => import('./pages/UpgradePage.jsx'));

export default function App() {
  useEffect(() => {
    initAuth();
    const savedTheme = localStorage.getItem('aevum_theme');
    if (savedTheme) applyTheme(savedTheme);
  }, []);

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-teal-900" />}>
      <Routes>
        {/* Public — no auth required */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/upgrade" element={<UpgradePage />} />
        <Route path="/upgrade/success" element={<UpgradePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/reading/:id" element={<SharedReadingPage />} />
        <Route path="/font-calibrate" element={<FontCalibratePage />} />

        {/* Booking flow — public, no auth required */}
        <Route path="/ask"            element={<IntakePage />} />
        <Route path="/datetime"       element={<DateTimePage />} />
        <Route path="/significations" element={<HouseSignificationPage />} />
        <Route path="/dashboard"      element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/results"        element={<Navigate to="/dashboard" replace />} />
        <Route path="/history"        element={<RequireAuth><HistoryPage /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <footer className="text-center text-silver/20 text-[10px] tracking-wide py-4 select-none space-y-1">
        <p>© 2026 Dolores Puckett / Dolores Aeonic Arts — Aevum. All rights reserved.</p>
        <p className="max-w-md mx-auto leading-relaxed px-4">
          Aevum 2.0 is an interactive historical reconstruction of 17th-century astronomical and horary techniques. It is designed for educational, research, and historical simulation purposes—a digital resurrection of a Renaissance casebook, not a prediction of future events.
        </p>
        <p>
          <a href="/privacy" className="hover:text-silver/70 underline underline-offset-2 transition-colors">
            Privacy Policy
          </a>
          {' · '}
          <a href="/consent" className="hover:text-silver/70 underline underline-offset-2 transition-colors">
            Data Settings
          </a>
        </p>
      </footer>
    </>
  );
}
