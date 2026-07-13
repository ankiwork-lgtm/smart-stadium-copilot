"use client";
/**
 * src/app/fan/page.tsx
 *
 * Main Fan App page. Two-panel layout:
 *   Left:  VenueMap (desktop only, collapsed mini-map on mobile)
 *   Right: IntentChips + ChatPanel
 *
 * Wires the assistant reply to the map by extracting venue IDs
 * mentioned in the response text and pulsing those pins.
 *
 * Tasks: 4.1–4.9 assembled here.
 */

import { useState, useCallback } from "react";
import { ChatPanel } from "../../components/ChatPanel";
import { VenueMap } from "../../components/VenueMap";
import { IntentChips, type ChipConfig } from "../../components/IntentChips";
import { AccessibilityPrefsModal } from "../../components/AccessibilityPrefsModal";
import type { AssistantMode } from "../../../lib/types";

// ---------------------------------------------------------------------------
// All IDs that might appear in an assistant response
// ---------------------------------------------------------------------------

const GATE_IDS = ["gate-a", "gate-b", "gate-c", "gate-d", "gate-e"];
const FACILITY_IDS = [
  "rest-1", "rest-2", "rest-3",
  "quiet-1",
  "medic-1", "medic-2",
  "food-1", "food-2",
  "recycle-2",
  "recycle-1", "water-1",
];
const ALL_VENUE_IDS = [...GATE_IDS, ...FACILITY_IDS];

/**
 * Pattern-based extraction: match either explicit IDs in the response text
 * or descriptive keywords that clearly refer to a specific location.
 */
type PatternRule = [RegExp, string[]];

const KEYWORD_PATTERNS: PatternRule[] = [
  // Gates
  [/gate[\s-]?a|north entr/i, ["gate-a"]],
  [/gate[\s-]?b|east entr/i, ["gate-b"]],
  [/gate[\s-]?c|south entr/i, ["gate-c"]],
  [/gate[\s-]?d|west entr/i, ["gate-d"]],
  [/gate[\s-]?e|vip|media entr/i, ["gate-e"]],
  // Restrooms
  [/restroom.{0,12}north|north.{0,12}restroom|restroom block\s*a/i, ["rest-1"]],
  [/restroom.{0,12}east|east.{0,12}restroom|restroom block\s*b|section 11[4-8]/i, ["rest-2"]],
  [/restroom.{0,12}south|south.{0,12}restroom|restroom block\s*c/i, ["rest-3"]],
  // Sensory / quiet
  [/sensory room|quiet room/i, ["quiet-1"]],
  // First aid
  [/first aid.{0,12}north|north.{0,12}first aid|first aid station\s*a/i, ["medic-1"]],
  [/first aid.{0,12}south|south.{0,12}first aid|first aid station\s*b/i, ["medic-2"]],
  // Concessions
  [/concession.{0,12}north|north.{0,12}concession|north plaza.{0,12}food/i, ["food-1"]],
  [/concession.{0,12}south|south.{0,12}concession/i, ["food-2"]],
  // Sustainability
  [/recycl.{0,12}east|east.{0,12}recycl|east plaza.{0,12}recycl/i, ["recycle-2"]],
  [/recycl.{0,12}north|north.{0,12}recycl|north plaza.{0,12}recycl/i, ["recycle-1"]],
  [/water refill|refill station|north concourse.{0,12}water/i, ["water-1"]],
  // Sustainability general — highlight all eco points
  [/sustainability|zero.?waste|eco.?friendly|recycle|recycling station|refill point/i, ["recycle-1", "recycle-2", "water-1"]],
];

function extractHighlightedIds(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // 1. Explicit ID match (e.g. "gate-a", "rest-1")
  for (const id of ALL_VENUE_IDS) {
    if (lower.includes(id)) found.add(id);
  }

  // 2. Keyword pattern match
  for (const [pattern, ids] of KEYWORD_PATTERNS) {
    if (pattern.test(text)) {
      ids.forEach((id) => found.add(id));
    }
  }

  return [...found];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FanPage() {
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AssistantMode>("wayfinding");
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [showA11yModal, setShowA11yModal] = useState(false);

  const handleChipSelect = useCallback((chip: ChipConfig) => {
    setActiveChip(chip.label);
    setActiveMode(chip.mode);
  }, []);

  const handleAssistantReply = useCallback((text: string) => {
    const ids = extractHighlightedIds(text);
    setHighlightedIds(ids);
  }, []);

  return (
    <>
      {/* First-visit accessibility modal */}
      <AccessibilityPrefsModal onClose={() => setShowA11yModal(false)} />

      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4"
           style={{ height: "calc(100vh - 3.5rem)" }}>

        {/* ---------------------------------------------------------------- */}
        {/* Page header                                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Fan Assistant
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Legacy Stadium · Dallas, TX · FIFA World Cup 2026
            </p>
          </div>
          <button
            id="open-a11y-prefs-btn"
            onClick={() => setShowA11yModal(true)}
            aria-label="Open accessibility preferences"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white
                       border border-white/[0.08] hover:border-white/[0.15]
                       px-2.5 py-1.5 rounded-lg transition-all duration-200"
          >
            ♿ Preferences
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Two-panel main area                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-4 min-h-0">

          {/* ------- Left panel: Venue Map (desktop only) ------- */}
          <div className="hidden lg:flex flex-col gap-2 min-h-0 overflow-auto">
            <VenueMap highlightedIds={highlightedIds} />
            {highlightedIds.length > 0 && (
              <p
                className="text-[11px] text-amber-400/80 text-center animate-fade-in"
                aria-live="polite"
              >
                ✨ {highlightedIds.length} location
                {highlightedIds.length > 1 ? "s" : ""} highlighted from the assistant&apos;s response
              </p>
            )}
          </div>

          {/* ------- Right panel: Chips + Map (mobile) + Chat ------- */}
          <div className="flex flex-col gap-3 min-h-0">
            {/* Intent chips */}
            <div className="shrink-0">
              <IntentChips activeChip={activeChip} onChipSelect={handleChipSelect} />
            </div>

            {/* Mobile map (compact, above chat) */}
            <div
              className="lg:hidden rounded-2xl overflow-hidden border border-white/[0.07] shrink-0"
              style={{ maxHeight: 200 }}
            >
              <VenueMap highlightedIds={highlightedIds} />
            </div>

            {/* Chat panel */}
            <div
              className="flex-1 bg-white/[0.025] border border-white/[0.07] rounded-2xl
                         overflow-hidden flex flex-col min-h-0 shadow-xl"
            >
              {/* Chat header */}
              <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-300 font-medium">
                    Stadium Copilot · AI‑powered
                  </span>
                </div>
                <span
                  className="text-[10px] text-gray-400 bg-white/[0.04] px-2 py-0.5 rounded-full capitalize"
                  aria-label={`Current mode: ${activeMode}`}
                >
                  {activeMode}
                </span>
              </div>

              <ChatPanel
                mode={activeMode}
                onAssistantReply={handleAssistantReply}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Re-openable accessibility modal (triggered by Preferences button) */}
      {showA11yModal && (
        <AccessibilityPrefsModal
          forceOpen
          onClose={() => setShowA11yModal(false)}
        />
      )}
    </>
  );
}
