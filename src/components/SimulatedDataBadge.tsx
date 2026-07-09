"use client";
/**
 * src/components/SimulatedDataBadge.tsx
 *
 * Small persistent badge fixed to the bottom-right of the screen.
 * Satisfies NFR5: simulated data must be visibly labeled in the UI
 * without being intrusive or over-explained.
 *
 * Task 4.2 [MUST]
 */

export function SimulatedDataBadge() {
  return (
    <div
      role="status"
      aria-label="Simulated data disclosure: all live crowd and transit data shown is simulated for this demo"
      title="All live crowd density, transit status, and incident data is simulated for demo purposes. Venue layout and AI responses are based on realistic but fictional data."
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                 bg-yellow-500/10 border border-yellow-500/25 text-yellow-400/80
                 backdrop-blur-sm shadow-lg select-none cursor-help"
    >
      <span className="animate-pulse text-yellow-400" aria-hidden="true">
        ⚠
      </span>
      Simulated data · Demo only
    </div>
  );
}
