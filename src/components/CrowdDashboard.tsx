"use client";
/**
 * src/components/CrowdDashboard.tsx
 *
 * Gate/zone cards color-coded by crowdDensity level.
 * Polls GET /api/sim-data every ~5 s and animates level changes.
 *
 * Task 5.1 [MUST]
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveState, CrowdLevel, VenueData } from "../../lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GateCard = {
  id: string;
  name: string;
  zone: string;
  level: CrowdLevel;
  prevLevel?: CrowdLevel;
  accessible: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<
  CrowdLevel,
  { label: string; color: string; bg: string; ring: string; pulse: boolean }
> = {
  low: {
    label: "Low",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    ring: "ring-emerald-500/30",
    pulse: false,
  },
  moderate: {
    label: "Moderate",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    ring: "ring-amber-500/30",
    pulse: false,
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    ring: "ring-orange-500/30",
    pulse: true,
  },
  critical: {
    label: "CRITICAL",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    ring: "ring-red-500/40",
    pulse: true,
  },
};

const TRANSIT_STATUS_CONFIG = {
  on_time: { label: "On time", color: "text-emerald-400", dot: "bg-emerald-400" },
  delayed: { label: "Delayed", color: "text-orange-400", dot: "bg-orange-400" },
  closed: { label: "Closed", color: "text-red-400", dot: "bg-red-400" },
};

function CrowdBar({ level }: { level: CrowdLevel }) {
  const widths: Record<CrowdLevel, string> = {
    low: "w-1/4",
    moderate: "w-1/2",
    high: "w-3/4",
    critical: "w-full",
  };
  const colors: Record<CrowdLevel, string> = {
    low: "bg-emerald-500",
    moderate: "bg-amber-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-700 ${widths[level]} ${colors[level]}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  onSpikeTriggered?: () => void;
  /** When true the Trigger Spike button is hidden (non-Ops roles). Default: false */
  hideSpikeButton?: boolean;
};

export function CrowdDashboard({ onSpikeTriggered, hideSpikeButton = false }: Props) {
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [triggeringSpike, setTriggeringSpike] = useState(false);
  const prevStateRef = useRef<LiveState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchInProgressRef = useRef(false);

  const fetchSimData = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    try {
      const res = await fetch("/api/sim-data");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveState = await res.json();
      setLiveState((prev) => {
        prevStateRef.current = prev;
        return data;
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("[CrowdDashboard] poll error:", err);
      setError("Unable to fetch live data. Retrying…");
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  // fetchSimData only touches refs and stable state setters — no external deps.
  // useCallback gives the polling effect a stable reference to depend on.
  }, []);

  // Fetch venue data once on mount to drive zone/transit label lookups
  useEffect(() => {
    let cancelled = false;
    fetch("/api/venue")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: VenueData) => { if (!cancelled) setVenueData(data); })
      .catch((err) => console.error("[CrowdDashboard] venue fetch error:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetchSimData();
    };

    fetchSimData();
    intervalRef.current = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fetchSimData]);

  const handleTriggerSpike = async () => {
    setTriggeringSpike(true);
    try {
      const res = await fetch("/api/sim-data/trigger-spike", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveState = await res.json();
      setLiveState(data);
      setLastUpdated(new Date());
      onSpikeTriggered?.();
    } catch (err) {
      console.error("[CrowdDashboard] spike error:", err);
    } finally {
      setTriggeringSpike(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading crowd data">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error && !liveState) {
    return (
      <div className="rounded-2xl bg-red-900/20 border border-red-500/30 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  // Build lookup maps from venue data so gate cards and transit labels
  // reflect venue.json rather than hardcoded values.
  const gateById = Object.fromEntries(
    (venueData?.gates ?? []).map((g) => [g.id, g])
  );
  const transitById = Object.fromEntries(
    (venueData?.transitOptions ?? []).map((t) => [t.id, t])
  );

  // Emoji prefix per transit mode
  const TRANSIT_MODE_ICON: Record<string, string> = {
    train: "🚆",
    bus: "🚌",
    rideshare: "🚗",
  };

  // Build gate card list from live state, enriched with venue data
  const gates: GateCard[] = liveState
    ? Object.entries(liveState.crowdDensity).map(([id, level]) => {
        const gate = gateById[id];
        return {
          id,
          name: gate?.name ?? id.replace("gate-", "Gate ").toUpperCase(),
          zone: gate?.zone ?? "Zone",
          level,
          accessible: gate ? gate.accessible : false,
        };
      })
    : [];

  const criticalCount = gates.filter((g) => g.level === "critical").length;
  const highCount = gates.filter((g) => g.level === "high").length;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400
                             bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full animate-pulse">
              🔴 {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-400
                             bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
              🟠 {highCount} High
            </span>
          )}
          {criticalCount === 0 && highCount === 0 && (
            <span className="text-xs text-emerald-400/70">✓ All gates nominal</span>
          )}
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-gray-600">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Gate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {gates.map((gate) => {
          const cfg = LEVEL_CONFIG[gate.level];
          return (
            <div
              key={gate.id}
              id={`gate-card-${gate.id}`}
              className={`rounded-2xl border p-4 transition-all duration-500 ${cfg.bg}
                          ${cfg.pulse ? "ring-1 " + cfg.ring : ""}`}
              aria-label={`${gate.name}: ${cfg.label} crowd density`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{gate.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{gate.zone} Zone</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold tracking-wide ${cfg.color}`}>
                    {cfg.label}
                    {cfg.pulse && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    )}
                  </span>
                  {gate.accessible && (
                    <p className="text-[10px] text-gray-600 mt-0.5">♿ Accessible</p>
                  )}
                </div>
              </div>
              <CrowdBar level={gate.level} />
            </div>
          );
        })}
      </div>

      {/* Transit status mini-row */}
      {liveState && (
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Transit Status
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(liveState.transitStatus).map(([id, entry]) => {
              const cfg = TRANSIT_STATUS_CONFIG[entry.status];
              const transit = transitById[id];
              const icon = transit ? (TRANSIT_MODE_ICON[transit.mode] ?? "🚌") : "🚌";
              const displayName = transit ? (transit.line ?? transit.mode) : id;
              const label = `${icon} ${displayName}`;
              return (
                <div key={id} className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-300 truncate">{label}</p>
                    <p className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weather strip */}
      {liveState?.weather && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-2.5
                        flex items-center gap-3 text-xs text-gray-400">
          <span className="text-base">
            {liveState.weather.condition === "Sunny" ? "☀️" :
             liveState.weather.condition.includes("Cloud") ? "⛅" :
             liveState.weather.condition.includes("Rain") || liveState.weather.condition.includes("Thunder") ? "⛈️" : "🌤️"}
          </span>
          <span>{liveState.weather.condition} · {liveState.weather.tempC}°C</span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-500">Legacy Stadium</span>
        </div>
      )}

      {/* Trigger Spike button (Task 5.2) — visible only in Ops role */}
      {!hideSpikeButton && (
        <button
          id="trigger-spike-btn"
          onClick={handleTriggerSpike}
          disabled={triggeringSpike}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                     bg-red-900/20 hover:bg-red-900/30 border border-red-500/20 hover:border-red-500/40
                     text-red-400 hover:text-red-300 text-sm font-semibold
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                     active:scale-[0.99]"
          aria-label="Trigger simulated congestion spike for demo"
        >
          {triggeringSpike ? (
            <>
              <span className="animate-pulse">⏳</span>
              Triggering spike…
            </>
          ) : (
            <>
              <span>⚠️</span>
              Trigger Congestion Spike
              <span className="text-[10px] text-red-600 font-normal">(demo)</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs text-orange-400/70 text-center">{error}</p>
      )}
    </div>
  );
}
