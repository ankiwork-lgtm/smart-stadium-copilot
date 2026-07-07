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
      aria-label="Data simulation disclosure"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                 bg-yellow-500/10 border border-yellow-500/25 text-yellow-400/80
                 backdrop-blur-sm shadow-lg select-none"
    >
      <span className="animate-pulse text-yellow-400" aria-hidden="true">
        ⚠
      </span>
      Live data is simulated
    </div>
  );
}
