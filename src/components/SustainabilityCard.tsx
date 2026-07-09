"use client";
/**
 * src/components/SustainabilityCard.tsx
 *
 * Ops Console sustainability dashboard card (Task 6.4 [COULD]).
 * Shows simulated event-day sustainability metrics:
 *  - Estimated waste diverted from landfill
 *  - Transit mode share (fans arriving via public transport)
 *  - Water refill usage vs. single-use bottles sold
 *
 * All figures are static/simulated — clearly labelled as such.
 */

// ---------------------------------------------------------------------------
// Static simulated data
// ---------------------------------------------------------------------------

const STATS = [
  {
    id: "waste-diverted",
    label: "Waste Diverted",
    value: "68%",
    subtext: "of collected waste recycled or composted",
    icon: "♻️",
    color: "text-emerald-400",
    barColor: "bg-emerald-500",
    barWidth: "68%",
  },
  {
    id: "transit-share",
    label: "Public Transit Share",
    value: "54%",
    subtext: "of fans arrived by train or bus",
    icon: "🚆",
    color: "text-blue-400",
    barColor: "bg-blue-500",
    barWidth: "54%",
  },
  {
    id: "water-refills",
    label: "Refill vs. Single-Use",
    value: "2,140",
    subtext: "reusable bottle refills · ~1,070 plastic bottles avoided",
    icon: "💧",
    color: "text-cyan-400",
    barColor: "bg-cyan-500",
    barWidth: "66%",
  },
];

const RECYCLING_POINTS = [
  { name: "North Plaza", nearGate: "Gate A", status: "active" },
  { name: "East Plaza", nearGate: "Gate B", status: "active" },
  { name: "North Concourse (Water Refill)", nearGate: "Gate A", status: "active" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SustainabilityCard() {
  return (
    <div className="flex flex-col gap-4">

      {/* Header note */}
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Simulated estimates for this demo session · Based on FIFA 2026 Zero‑Waste targets
      </p>

      {/* Metric bars */}
      <div className="flex flex-col gap-3">
        {STATS.map((stat) => (
          <div key={stat.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-sm">{stat.icon}</span>
                <span className="text-xs text-gray-400 font-medium">{stat.label}</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${stat.color}`}>
                {stat.value}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full ${stat.barColor} opacity-70 transition-all duration-500`}
                style={{ width: stat.barWidth }}
                aria-hidden="true"
              />
            </div>
            <p className="text-[10px] text-gray-600">{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* Recycling point status table */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">
          Eco Stations Status
        </h3>
        <div className="flex flex-col gap-1">
          {RECYCLING_POINTS.map((pt) => (
            <div
              key={pt.name}
              className="flex items-center justify-between px-2.5 py-1.5
                         rounded-lg bg-white/[0.03] border border-white/[0.05]"
            >
              <div>
                <span className="text-xs text-gray-300">{pt.name}</span>
                <span className="text-[10px] text-gray-600 ml-1.5">· {pt.nearGate}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="text-[10px] text-emerald-400 font-medium capitalize">
                  {pt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
