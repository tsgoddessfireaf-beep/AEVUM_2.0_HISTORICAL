// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

const STEPS = ['Question', 'Date & Time', 'Significations', 'Reading'];

/**
 * Horizontal step progress bar shown at the top of each page in the reading flow.
 * Completed steps show a gold checkmark; the active step is highlighted.
 * @param {{ current: number }} props - 1-based index of the active step.
 */
export default function StepIndicator({ current }) {
  return (
    <nav aria-label="Reading progress" className="flex items-center justify-center gap-1 sm:gap-2 mb-10">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${step}: ${label}${done ? ' (completed)' : active ? ' (current)' : ''}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all duration-300
                  ${done  ? 'bg-copper-400 border-copper-400 text-teal-900' : ''}
                  ${active ? 'border-copper-400 text-copper-400' : ''}
                  ${!done && !active ? 'border-teal-600 text-silver/40' : ''}
                `}
              >
                {done ? '✓' : step}
              </div>
              <span
                className={`hidden sm:block text-[10px] tracking-wide uppercase ${
                  active ? 'text-copper-400' : done ? 'text-silver/70' : 'text-silver/20'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-12 h-px sm:mb-5 transition-all duration-300 ${
                  done ? 'bg-copper-400' : 'bg-teal-900'
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
