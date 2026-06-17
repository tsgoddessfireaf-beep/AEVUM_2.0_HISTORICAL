// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Full-page centered spinner with a status message.
 * Used during ephemeris fetching and analysis generation on ResultsPage.
 * @param {{ text: string }} props
 */
export default function LoadingState({ text }) {
  return (
    <div className="text-center py-20">
      <div className="text-3xl mb-5 text-copper-400" style={{ animation: 'spin 4s linear infinite' }}>✦</div>
      <p className="text-silver text-sm tracking-wide">{text}</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
