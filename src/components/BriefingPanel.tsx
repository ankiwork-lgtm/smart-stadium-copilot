"use client";
/**
 * src/components/BriefingPanel.tsx
 *
 * "Generate shift briefing" button → POST /api/briefing → renders summary.
 *
 * Task 5.4 [SHOULD]
 */

import { useState } from "react";
import { useUserContext } from "./UserContextProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BriefingResult = {
  summary: string;
  recommendedAction: string;
  priority: "low" | "medium" | "high";
  generatedAt: string;
  rawText?: string;
  parseError?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<BriefingResult["priority"], { label: string; cls: string }> = {
  low: { label: "Low", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  medium: { label: "Medium", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  high: { label: "High", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function BriefingPanel() {
  const { userContext } = useUserContext();
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateBriefing = async () => {
    setLoading(true);
    setError(null);
    setBriefing(null);

    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: userContext.language }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const data: BriefingResult = await res.json();
      setBriefing(data);
    } catch (err) {
      console.error("[BriefingPanel] error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate briefing. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" id="briefing-panel">
      {/* Generate button */}
      <button
        id="generate-briefing-btn"
        onClick={generateBriefing}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl
                   bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/25 hover:border-indigo-500/40
                   text-indigo-300 hover:text-indigo-200 text-sm font-semibold
                   transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                   active:scale-[0.99]"
        aria-label="Generate shift briefing using AI"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            Generating briefing…
          </>
        ) : (
          <>
            <span>📋</span>
            Generate Shift Briefing
          </>
        )}
      </button>

      {/* Error state */}
      {error && (
        <div
          className="rounded-xl bg-red-900/15 border border-red-500/20 px-4 py-3 text-xs text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Briefing result */}
      {briefing && !loading && (
        <div
          className="rounded-2xl bg-white/[0.025] border border-white/[0.07] overflow-hidden animate-fade-in"
          aria-live="polite"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-white/[0.06] bg-indigo-600/5">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span className="text-xs font-semibold text-indigo-300">Shift Briefing</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Priority badge */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                            ${PRIORITY_BADGE[briefing.priority].cls}`}
              >
                {PRIORITY_BADGE[briefing.priority].label} priority
              </span>
              <span className="text-[10px] text-gray-600">
                {new Date(briefing.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-4">
            {/* Summary */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Summary
              </p>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {briefing.summary}
              </p>
            </div>

            {/* Recommended Action */}
            {briefing.recommendedAction && briefing.recommendedAction !== "Review full log for details." && (
              <div className="pt-3 border-t border-white/[0.05]">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Recommended Action
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {briefing.recommendedAction}
                </p>
              </div>
            )}

            {briefing.parseError && (
              <p className="text-[10px] text-amber-500/70 italic">
                ⚠️ AI returned unstructured text — displayed as-is.
              </p>
            )}
          </div>

          {/* Regenerate */}
          <div className="px-4 pb-3">
            <button
              id="regenerate-briefing-btn"
              onClick={generateBriefing}
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              ↻ Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Placeholder hint when no briefing yet */}
      {!briefing && !loading && !error && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 text-center">
          <p className="text-xs text-gray-500">
            Click the button above to generate an AI-powered shift summary based on recent event logs.
          </p>
        </div>
      )}
    </div>
  );
}
