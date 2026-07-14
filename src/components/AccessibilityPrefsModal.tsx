"use client";
/**
 * src/components/AccessibilityPrefsModal.tsx
 *
 * First-visit modal that lets fans set accessibility needs and a location hint.
 * Shown once per session (sessionStorage flag). Can be re-opened via the
 * "Preferences" button on the fan page.
 *
 * Stores preferences in UserContext (persisted to localStorage via the
 * UserContextProvider).
 *
 * Task 4.8 [SHOULD]
 */

import { useState, useEffect } from "react";
import { useUserContext } from "./UserContextProvider";
import type { AccessibilityNeed } from "../../lib/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NEEDS: { value: AccessibilityNeed; label: string; icon: string; description: string }[] = [
  {
    value: "mobility",
    label: "Mobility / wheelchair",
    icon: "♿",
    description: "Wheelchair access, ramps, and step-free routes",
  },
  {
    value: "vision",
    label: "Visual impairment",
    icon: "👁️",
    description: "High-contrast directions and audio-friendly guidance",
  },
  {
    value: "hearing",
    label: "Hearing impairment",
    icon: "👂",
    description: "Visual alerts and text-based instructions",
  },
  {
    value: "sensory",
    label: "Sensory processing needs",
    icon: "🧠",
    description: "Quiet routes and sensory room locations",
  },
];

const SESSION_KEY = "stadium-a11y-modal-shown";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** If true, show the modal regardless of sessionStorage flag */
  forceOpen?: boolean;
  /** Called after the modal closes (either saved or skipped) */
  onClose?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccessibilityPrefsModal({ forceOpen = false, onClose }: Props) {
  const { userContext, setUserContext } = useUserContext();
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState<AccessibilityNeed[]>([]);
  const [locationHint, setLocationHint] = useState("");

  // Decide whether to open on mount
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (!shown) {
        setOpen(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      // Ignore storage errors
    }
  }, [forceOpen]);

  // Sync local state when context changes (e.g., forceOpen re-opens after a save)
  useEffect(() => {
    if (open) {
      setNeeds(userContext.accessibilityNeeds ?? []);
      setLocationHint(userContext.currentLocationHint ?? "");
    }
  }, [open, userContext.accessibilityNeeds, userContext.currentLocationHint]);

  function toggleNeed(need: AccessibilityNeed) {
    setNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  }

  function handleSave() {
    setUserContext((prev) => ({
      ...prev,
      accessibilityNeeds: needs,
      currentLocationHint: locationHint.trim() || undefined,
    }));
    closeModal();
  }

  function closeModal() {
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Panel */}
      <div data-testid="a11y-modal-panel" className="relative w-full max-w-md bg-stadium-card border border-white/10 rounded-2xl p-6 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="mb-5">
          <h2
            id="a11y-modal-title"
            className="text-lg font-bold text-white flex items-center gap-2"
          >
            ♿ Accessibility Preferences
          </h2>
          <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">
            Help us give you better directions and facility suggestions.
            These are stored locally and never shared.
          </p>
        </div>

        {/* Need checkboxes */}
        <fieldset className="space-y-2 mb-5 border-0 p-0 m-0 min-w-0">
          <legend className="text-xs font-medium text-gray-300 mb-1.5">
            Accessibility needs
          </legend>
          {NEEDS.map((need) => {
            const checked = needs.includes(need.value);
            return (
              <label
                key={need.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                  checked
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleNeed(need.value)}
                  className="mt-0.5 w-4 h-4 accent-blue-500 rounded shrink-0"
                />
                <span className="text-lg shrink-0" aria-hidden="true">
                  {need.icon}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    {need.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {need.description}
                  </div>
                </div>
              </label>
            );
          })}
        </fieldset>

        {/* Location hint */}
        <div className="mb-5">
          <label
            htmlFor="location-hint-input"
            className="text-xs font-medium text-gray-300 block mb-1.5"
          >
            Your current location (optional)
          </label>
          <input
            id="location-hint-input"
            type="text"
            value={locationHint}
            onChange={(e) => setLocationHint(e.target.value)}
            placeholder="e.g. Near Gate A, Section 110..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm
                       text-white placeholder-gray-500 outline-none
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            id="a11y-modal-skip"
            onClick={closeModal}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300
                       hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            Skip for now
          </button>
          <button
            id="a11y-modal-save"
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold
                       text-white transition-colors shadow-lg shadow-blue-900/30"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}
