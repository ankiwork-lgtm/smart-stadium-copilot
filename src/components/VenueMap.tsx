"use client";
/**
 * src/components/VenueMap.tsx
 *
 * SVG stadium map that renders:
 *  - Stadium shell (outer ring, concourse, playing field)
 *  - Gate pins (colored by zone)
 *  - Facility icons (restroom, first aid, concession, sensory room, recycling, water)
 *  - Sustainability points
 *  - Animated highlight rings when highlightedIds changes
 *
 * Data is fetched once from /api/venue on mount.
 *
 * Task 4.5 [MUST] + Task 4.6 [SHOULD]
 */

import { useEffect, useState } from "react";
import type { VenueData } from "../../lib/types";

// ---------------------------------------------------------------------------
// Visual mappings
// ---------------------------------------------------------------------------

const FACILITY_ICONS: Record<string, string> = {
  restroom: "🚻",
  sensory_room: "🤫",
  first_aid: "🏥",
  concession: "🍔",
  recycling: "♻️",
  water_refill: "💧",
};

const FACILITY_COLORS: Record<string, string> = {
  restroom: "#3b82f6",      // blue
  sensory_room: "#8b5cf6",  // purple
  first_aid: "#ef4444",     // red
  concession: "#f59e0b",    // amber
  recycling: "#10b981",     // emerald
  water_refill: "#06b6d4",  // cyan
};

const GATE_ZONE_COLORS: Record<string, string> = {
  North: "#3b82f6",
  East: "#8b5cf6",
  South: "#f59e0b",
  West: "#10b981",
  "North-West": "#6366f1",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** Gate/facility IDs to pulse-highlight (derived from assistant response) */
  highlightedIds?: string[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VenueMap({ highlightedIds = [] }: Props) {
  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/venue")
      .then((r) => r.json())
      .then((data: VenueData) => {
        setVenueData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="w-full aspect-[800/700] rounded-2xl bg-white/[0.03] border border-white/[0.06]
                      flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500">Loading map…</p>
        </div>
      </div>
    );
  }

  if (!venueData) {
    return (
      <div className="w-full aspect-[800/700] rounded-2xl bg-white/[0.03] border border-red-500/20
                      flex items-center justify-center">
        <p className="text-xs text-red-400">Map unavailable</p>
      </div>
    );
  }

  const highlighted = new Set(highlightedIds);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1526] shadow-xl">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <span aria-hidden="true">📍</span>
          {venueData.venueName}
        </span>
        <span className="text-[10px] text-gray-600">{venueData.city}</span>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 800 680"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full block"
        aria-label={`Venue map for ${venueData.venueName}`}
        role="img"
      >
        {/* Background */}
        <rect width="800" height="680" fill="#0d1526" />

        {/* ---------------------------------------------------------------- */}
        {/* Stadium shell                                                      */}
        {/* ---------------------------------------------------------------- */}

        {/* Outer glow */}
        <ellipse cx="400" cy="340" rx="316" ry="266" fill="none" stroke="#1e3a6e" strokeWidth="1" opacity="0.4" />

        {/* Stadium outer ring */}
        <ellipse cx="400" cy="340" rx="308" ry="258" fill="#111d35" stroke="#1e3060" strokeWidth="2" />

        {/* Concourse ring */}
        <ellipse cx="400" cy="340" rx="248" ry="198" fill="#0d1a30" stroke="#162440" strokeWidth="1" />

        {/* Playing field */}
        <ellipse cx="400" cy="340" rx="178" ry="138" fill="#132b1e" stroke="#1c4a2d" strokeWidth="2" />

        {/* Field centre circle */}
        <circle cx="400" cy="340" r="42" fill="none" stroke="#1c4a2d" strokeWidth="1" />

        {/* Centre spot */}
        <circle cx="400" cy="340" r="4" fill="#1c4a2d" />

        {/* Halfway line */}
        <line x1="222" y1="340" x2="578" y2="340" stroke="#1c4a2d" strokeWidth="1" />

        {/* Penalty areas */}
        <rect x="340" y="202" width="120" height="60" fill="none" stroke="#1c4a2d" strokeWidth="1" />
        <rect x="340" y="418" width="120" height="60" fill="none" stroke="#1c4a2d" strokeWidth="1" />

        {/* Field label */}
        <text
          x="400"
          y="345"
          textAnchor="middle"
          fontSize="9"
          fill="#1c4a2d"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="1"
        >
          FIFA WC 2026
        </text>

        {/* ---------------------------------------------------------------- */}
        {/* Gate spoke lines (subtle)                                          */}
        {/* ---------------------------------------------------------------- */}
        {venueData.gates.map((gate) => {
          const color = GATE_ZONE_COLORS[gate.zone] ?? "#4a6fa5";
          return (
            <line
              key={`spoke-${gate.id}`}
              x1={gate.coords[0]}
              y1={gate.coords[1]}
              x2="400"
              y2="340"
              stroke={color}
              strokeWidth="0.5"
              strokeDasharray="3,8"
              opacity="0.15"
            />
          );
        })}

        {/* ---------------------------------------------------------------- */}
        {/* Facilities                                                         */}
        {/* ---------------------------------------------------------------- */}
        {venueData.facilities.map((facility) => {
          const isHighlighted = highlighted.has(facility.id);
          const color = FACILITY_COLORS[facility.type] ?? "#4a6fa5";
          const icon = FACILITY_ICONS[facility.type] ?? "📍";
          const [cx, cy] = facility.coords;

          return (
            <g key={facility.id} role="img" aria-label={facility.name}>
              {/* Highlight pulse ring */}
              {isHighlighted && (
                <>
                  <circle cx={cx} cy={cy} r="18" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.7">
                    <animate attributeName="r" values="14;22;14" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={cx} cy={cy} r="13" fill="#fbbf24" opacity="0.12" />
                </>
              )}

              {/* Pin circle */}
              <circle
                cx={cx}
                cy={cy}
                r="10"
                fill={isHighlighted ? color : "#0f1c35"}
                stroke={color}
                strokeWidth="1.5"
                opacity={isHighlighted ? 1 : 0.85}
              />

              {/* Icon */}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize="8"
                fontFamily="system-ui"
              >
                {icon}
              </text>
            </g>
          );
        })}

        {/* ---------------------------------------------------------------- */}
        {/* Sustainability points (render only if coords are unique)           */}
        {/* ---------------------------------------------------------------- */}
        {venueData.sustainabilityPoints.map((sp) => {
          const isHighlighted = highlighted.has(sp.id);
          const [cx, cy] = sp.coords;

          // Skip if a facility already covers these exact coords
          const duplicate = venueData.facilities.some(
            (f) => f.coords[0] === cx && f.coords[1] === cy
          );
          if (duplicate) return null;

          return (
            <g key={sp.id} role="img" aria-label={sp.name}>
              {isHighlighted && (
                <circle cx={cx} cy={cy} r="16" fill="#10b981" opacity="0.18">
                  <animate attributeName="r" values="12;20;12" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={cx}
                cy={cy}
                r="9"
                fill={isHighlighted ? "#10b981" : "#0d2018"}
                stroke={isHighlighted ? "#10b981" : "#1a4a30"}
                strokeWidth="1.5"
              />
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize="7" fontFamily="system-ui">
                {sp.type === "water_refill" ? "💧" : "♻️"}
              </text>
            </g>
          );
        })}

        {/* ---------------------------------------------------------------- */}
        {/* Gates                                                              */}
        {/* ---------------------------------------------------------------- */}
        {venueData.gates.map((gate) => {
          const isHighlighted = highlighted.has(gate.id);
          const color = GATE_ZONE_COLORS[gate.zone] ?? "#4a6fa5";
          const [cx, cy] = gate.coords;

          // Position label outward from center
          const dx = cx - 400;
          const dy = cy - 340;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const labelX = cx + (dx / len) * 26;
          const labelY = cy + (dy / len) * 26;

          return (
            <g key={gate.id} role="img" aria-label={gate.name}>
              {/* Outer pulse ring */}
              {isHighlighted && (
                <circle cx={cx} cy={cy} r="22" fill="none" stroke={color} strokeWidth="2" opacity="0.6">
                  <animate attributeName="r" values="16;26;16" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Gate circle */}
              <circle
                cx={cx}
                cy={cy}
                r="15"
                fill={isHighlighted ? color : "#0d1526"}
                stroke={color}
                strokeWidth="2.5"
              />

              {/* Gate letter */}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={isHighlighted ? "#fff" : color}
                fontFamily="system-ui, sans-serif"
              >
                {gate.name.replace("Gate ", "")}
              </text>

              {/* Zone label (outside) */}
              <text
                x={labelX}
                y={labelY + 3}
                textAnchor="middle"
                fontSize="7"
                fill={isHighlighted ? "#fbbf24" : "#4b5563"}
                fontFamily="system-ui, sans-serif"
              >
                {gate.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ----------------------------------------------------------------- */}
      {/* Legend                                                               */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-4 py-2.5 border-t border-white/[0.06] flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(FACILITY_ICONS).map(([type, icon]) => (
          <span
            key={type}
            className="text-[10px] text-gray-600 flex items-center gap-1"
          >
            <span>{icon}</span>
            <span className="capitalize">{type.replace("_", " ")}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
