"use client";
/**
 * src/components/AlertsFeed.tsx
 *
 * Polls GET /api/alerts every ~8 s and renders an AI-generated alert list,
 * newest first, color-coded by priority.
 *
 * Task 5.3 [SHOULD]
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Alert, AlertPriority, VenueData } from "../../lib/types";
import venueJson from "../../data/venue.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<
  AlertPriority,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  high: {
    label: "HIGH",
    color: "text-red-400",
    bg: "bg-red-500/[0.08]",
    border: "border-red-500/25",
    icon: "🔴",
  },
  medium: {
    label: "MED",
    color: "text-orange-400",
    bg: "bg-orange-500/[0.08]",
    border: "border-orange-500/25",
    icon: "🟠",
  },
  low: {
    label: "LOW",
    color: "text-blue-400",
    bg: "bg-blue-500/[0.08]",
    border: "border-blue-500/20",
    icon: "🔵",
  },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function sourceLabel(source: string): string {
  const venue = venueJson as VenueData;

  if (source.startsWith("gate-")) {
    const gate = venue.gates.find((g) => g.id === source);
    return gate?.name ?? source.replace("gate-", "Gate ").toUpperCase();
  }

  const transit = venue.transitOptions.find((t) => t.id === source);
  if (transit) {
    return transit.line ?? transit.mode;
  }

  if (source.startsWith("incident-")) return "Incident";
  return source;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  /** Called when new high-priority alerts are received */
  onNewHighAlert?: () => void;
};

export function AlertsFeed({ onNewHighAlert }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevHighCountRef = useRef(0);
  const fetchInProgressRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    setFetching(true);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Alert[] = await res.json();
      setAlerts(data);
      setError(null);

      // Notify parent if new high alerts appear
      const highCount = data.filter((a) => a.priority === "high").length;
      if (highCount > prevHighCountRef.current) {
        onNewHighAlert?.();
      }
      prevHighCountRef.current = highCount;
    } catch (err) {
      console.error("[AlertsFeed] poll error:", err);
      setError("Could not fetch alerts — retrying…");
    } finally {
      setLoading(false);
      setFetching(false);
      fetchInProgressRef.current = false;
    }
  // fetchAlerts only touches refs and state setters (all stable), so the dep
  // array is empty. useCallback gives the effect a stable reference to depend on.
  }, [onNewHighAlert]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetchAlerts();
    };

    fetchAlerts();
    const interval = setInterval(tick, 8000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fetchAlerts]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading alerts">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2" id="alerts-feed">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {fetching && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
          {error && (
            <span className="text-[10px] text-orange-400">{error}</span>
          )}
        </div>
        <button
          id="refresh-alerts-btn"
          onClick={fetchAlerts}
          disabled={fetching}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors
                     disabled:opacity-40 px-2 py-0.5 rounded"
          aria-label="Refresh alerts"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Empty state */}
      {alerts.length === 0 && !error && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-6 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-gray-400">No active alerts</p>
          <p className="text-xs text-gray-600 mt-1">All conditions are within normal thresholds</p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.map((alert) => {
        const cfg = PRIORITY_CONFIG[alert.priority];
        const isExpanded = expandedId === alert.id;

        return (
          <div
            key={alert.id}
            id={`alert-${alert.id}`}
            className={`rounded-xl border p-3 transition-all duration-300 cursor-pointer
                        ${cfg.bg} ${cfg.border}
                        hover:border-opacity-40`}
            onClick={() => setExpandedId(isExpanded ? null : alert.id)}
            aria-expanded={isExpanded}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setExpandedId(isExpanded ? null : alert.id)}
          >
            {/* Top row */}
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0 mt-0.5">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold tracking-widest ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {sourceLabel(alert.source)}
                  </span>
                  <span className="text-[10px] text-gray-700 ml-auto">
                    {timeAgo(alert.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-gray-200 leading-snug line-clamp-2">
                  {alert.summary}
                </p>
              </div>
              <span className="text-[10px] text-gray-700 shrink-0 mt-0.5">
                {isExpanded ? "▲" : "▼"}
              </span>
            </div>

            {/* Expanded: recommended action */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-white/[0.05] animate-fade-in">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Recommended Action
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {alert.recommendedAction}
                </p>
                {alert.rawText && (
                  <p className="mt-2 text-[10px] text-gray-600 italic">
                    ⚠️ AI response was not structured JSON — raw text shown above.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
