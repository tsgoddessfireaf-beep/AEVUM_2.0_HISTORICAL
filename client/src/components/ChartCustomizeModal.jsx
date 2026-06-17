// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

import useAppStore from '../store/useAppStore.js';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
        ${checked ? 'bg-copper-400' : 'bg-teal-700'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({ label, id }) {
  const { chartPrefs, setChartPref } = useAppStore();
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-teal-900/60 last:border-0">
      <span className="text-bone/75 text-sm">{label}</span>
      <Toggle checked={chartPrefs[id] !== false} onChange={(v) => setChartPref(id, v)} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-silver/70 text-xs uppercase tracking-widest mb-1">{title}</p>
      <div className="bg-teal-900/40 rounded-xl px-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Modal overlay for toggling which chart elements, notes, and data tables are displayed.
 * Preferences are persisted in Zustand across sessions.
 */
export default function ChartCustomizeModal({ open, onClose }) {
  const { resetChartPrefs } = useAppStore();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center
                 px-4 py-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-teal-900 border border-teal-600/50 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-teal-600/40">
          <div>
            <h2 className="text-bone font-serif text-base">Customize Chart</h2>
            <p className="text-silver/70 text-xs mt-0.5">Toggle which elements are displayed</p>
          </div>
          <button
            onClick={onClose}
            className="text-silver/70 hover:text-bone/75 text-lg leading-none transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Settings sections */}
        <div className="px-6 py-5 space-y-5">
          <Section title="Chart Wheel">
            <Row label="Aspect Lines" id="showAspectLines" />
            <Row label="North Node" id="showNode" />
            <Row label="Lot of Fortune" id="showLotOfFortune" />
            <Row label="House Numerals (I – XII)" id="showHouseNumerals" />
            <Row label="Cardinal Labels (ASC / MC)" id="showCardinalLabels" />
          </Section>

          <Section title="Chart Notes">
            <Row label="Timing Estimate" id="showTiming" />
            <Row label="Moon's Testimony" id="showMoonTestimony" />
            <Row label="Perfection Aspects" id="showPerfectionAspects" />
            <Row label="Collection of Light" id="showCollection" />
            <Row label="Prohibition" id="showProhibition" />
            <Row label="Translation of Light" id="showTranslation" />
            <Row label="Reception" id="showReception" />
            <Row label="Refranation" id="showRefranation" />
            <Row label="Fixed Stars" id="showFixedStars" />
            <Row label="Almuten of ASC" id="showAlmuten" />
            <Row label="Antiscia" id="showAntiscia" />
            <Row label="Warnings (Combustion · VOC)" id="showWarnings" />
          </Section>

          <Section title="Chart Data">
            <Row label="Aspects Table" id="showAspectsTable" />
            <Row label="Reception Table" id="showReceptionTable" />
            <Row label="Hayz Indicators" id="showHayz" />
            <Row label="Planetary Dignities" id="showDignitiesTable" />
            <Row label="Raw Chart Data" id="showRawChartData" />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-teal-600/40 flex items-center justify-between">
          <button
            onClick={resetChartPrefs}
            className="text-silver/40 hover:text-silver text-xs transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="bg-copper-400 hover:bg-copper-300 text-teal-900 font-semibold
                       text-sm px-5 py-2 rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
