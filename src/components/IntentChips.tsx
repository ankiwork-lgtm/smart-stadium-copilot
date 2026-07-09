"use client";
/**
 * src/components/IntentChips.tsx
 *
 * Horizontal row of quick-select intent chips that set the assistant mode
 * before sending a message. Each chip maps to a mode and carries a color
 * theme and descriptive label for accessibility.
 *
 * Task 4.7 [MUST]
 */

import type { AssistantMode } from "../../lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChipConfig = {
  label: string;
  mode: AssistantMode;
  icon: string;
  description: string;
  /** Tailwind classes when chip is NOT active */
  idleStyle: string;
  /** Tailwind classes when chip IS active */
  activeStyle: string;
};

// ---------------------------------------------------------------------------
// Chip definitions
// ---------------------------------------------------------------------------

export const INTENT_CHIPS: ChipConfig[] = [
  {
    label: "Directions",
    mode: "wayfinding",
    icon: "🗺️",
    description: "Get directions to gates, restrooms, food, and other facilities",
    idleStyle:
      "border-blue-500/30 text-blue-300/80 hover:bg-blue-500/10 hover:border-blue-500/60 hover:text-blue-200",
    activeStyle: "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40",
  },
  {
    label: "Transport",
    mode: "transport",
    icon: "🚆",
    description: "Train, bus, rideshare info and live status",
    idleStyle:
      "border-purple-500/30 text-purple-300/80 hover:bg-purple-500/10 hover:border-purple-500/60 hover:text-purple-200",
    activeStyle: "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40",
  },
  {
    label: "Accessibility",
    mode: "wayfinding",
    icon: "♿",
    description: "Accessible routes, ramps, and sensory-friendly facilities",
    idleStyle:
      "border-amber-500/30 text-amber-300/80 hover:bg-amber-500/10 hover:border-amber-500/60 hover:text-amber-200",
    activeStyle: "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40",
  },
  {
    label: "Sustainability",
    mode: "sustainability",
    icon: "🌿",
    description: "Recycling stations, water refill points, and green tips",
    idleStyle:
      "border-emerald-500/30 text-emerald-300/80 hover:bg-emerald-500/10 hover:border-emerald-500/60 hover:text-emerald-200",
    activeStyle:
      "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40",
  },
];

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

type IntentChipsProps = {
  /** Label of the currently active chip, or null */
  activeChip: string | null;
  /** Called when the user selects a chip */
  onChipSelect: (chip: ChipConfig) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntentChips({ activeChip, onChipSelect }: IntentChipsProps) {
  return (
    <div
      className="flex gap-2 flex-wrap"
      role="group"
      aria-label="Quick intent selection"
    >
      {INTENT_CHIPS.map((chip) => {
        const isActive = activeChip === chip.label;
        return (
          <button
            key={chip.label}
            id={`chip-${chip.label.toLowerCase()}`}
            onClick={() => onChipSelect(chip)}
            aria-pressed={isActive}
            title={chip.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold
                        transition-all duration-200 select-none
                        ${isActive ? chip.activeStyle : `bg-transparent ${chip.idleStyle}`}`}
          >
            <span aria-hidden="true">{chip.icon}</span>
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
