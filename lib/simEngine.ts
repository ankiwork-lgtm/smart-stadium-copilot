/**
 * lib/simEngine.ts
 * Simulated live-data engine for the Smart Stadium demo.
 *
 * Design constraints (from design.md §3.2):
 *  - Pull-based: tick() is called on each /api/sim-data request — no real cron.
 *  - State is held in a module-level singleton so successive API calls see the same "world".
 *  - triggerSpike() is a deterministic override for reliable live-demo moments.
 */

import type {
  LiveState,
  CrowdLevel,
  TransitStatusEntry,
  Incident,
  EventLogEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATE_IDS = ["gate-a", "gate-b", "gate-c", "gate-d", "gate-e"] as const;
const TRANSIT_IDS = ["train-1", "bus-1", "bus-2", "rideshare-1"] as const;

const CROWD_LEVELS: CrowdLevel[] = ["low", "moderate", "high", "critical"];

/** Probability that any gate's crowd level shifts on a given tick (0–1). */
const SHIFT_PROBABILITY = 0.35;

/** Probability that a transit line becomes delayed on any tick. */
const DELAY_PROBABILITY = 0.08;

/** Probability that a delayed line recovers on any tick. */
const RECOVERY_PROBABILITY = 0.4;

/** Probability that a scripted low-severity incident is injected on any tick. */
const INCIDENT_PROBABILITY = 0.05;

// ---------------------------------------------------------------------------
// Module-level singleton state
// ---------------------------------------------------------------------------

// NOTE: These module-level variables are intentional for a single-process demo.
// In a multi-instance serverless deployment (e.g. Vercel) each function instance
// maintains its own independent copy of this state, so two concurrent clients may
// see different "live worlds". A shared store (Redis, Upstash, etc.) would be
// required to unify state across instances in a production system.
let _state: LiveState | null = null;
let _incidentCounter = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns a sensible initial LiveState. Mostly low/moderate crowd, all transit on time. */
export function getInitialState(): LiveState {
  const now = new Date().toISOString();

  const crowdDensity: Record<string, CrowdLevel> = {
    "gate-a": "moderate",
    "gate-b": "low",
    "gate-c": "low",
    "gate-d": "moderate",
    "gate-e": "low",
  };

  const transitStatus: Record<string, TransitStatusEntry> = {
    "train-1": { status: "on_time" },
    "bus-1": { status: "on_time" },
    "bus-2": { status: "on_time" },
    "rideshare-1": { status: "on_time" },
  };

  // §1.4 — seed the eventLog with 4 fake historical entries
  const eventLog: EventLogEntry[] = [
    {
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      type: "recommendation",
      text: "Pre-match: Gate A advised fans to arrive early; Blue Line running extra service.",
    },
    {
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      type: "incident",
      text: "Minor medical assist near Section 112 (North concourse). Resolved by first-aid team.",
    },
    {
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      type: "alert",
      text: "Gate B queue building. Ops redirected 200 fans to Gate D — crowd levels normalised within 8 min.",
    },
    {
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      type: "recommendation",
      text: "Half-time concession rush expected. Advised fans near Section 200+ to use North concession stand.",
    },
  ];

  return {
    timestamp: now,
    crowdDensity,
    transitStatus,
    incidents: [],
    weather: { condition: "Sunny", tempC: 28 },
    eventLog,
  };
}

/**
 * Returns the singleton state, initialising it on first call.
 * Use this whenever you need the current state without advancing it.
 */
export function getState(): LiveState {
  if (!_state) _state = getInitialState();
  return _state;
}

/**
 * Advances the simulation by one tick and returns the updated state.
 * Called on each GET /api/sim-data request.
 */
export function tick(): LiveState {
  const state = getState();

  // --- 1. Update timestamp ---
  state.timestamp = new Date().toISOString();

  // --- 2. Random-walk crowd density ±1 level per gate ---
  for (const gateId of GATE_IDS) {
    if (Math.random() < SHIFT_PROBABILITY) {
      const currentLevel = state.crowdDensity[gateId];
      // Skip if this gate wasn't initialised (defensive guard against state corruption)
      if (!currentLevel) continue;
      const currentIdx = CROWD_LEVELS.indexOf(currentLevel);
      const direction = Math.random() < 0.5 ? -1 : 1;
      const newIdx = Math.max(0, Math.min(CROWD_LEVELS.length - 1, currentIdx + direction));
      state.crowdDensity[gateId] = CROWD_LEVELS[newIdx];
    }
  }

  // --- 3. Transit status random walk ---
  for (const transitId of TRANSIT_IDS) {
    const current = state.transitStatus[transitId];
    if (current.status === "on_time" && Math.random() < DELAY_PROBABILITY) {
      state.transitStatus[transitId] = {
        status: "delayed",
        note: randomDelayNote(transitId),
      };
      appendLog(state, "alert", `${transitId.replace("-", " ").toUpperCase()} is now delayed. ${state.transitStatus[transitId].note}`);
    } else if (current.status === "delayed" && Math.random() < RECOVERY_PROBABILITY) {
      state.transitStatus[transitId] = { status: "on_time" };
      appendLog(state, "recommendation", `${transitId.replace("-", " ").toUpperCase()} has resumed normal service.`);
    }
  }

  // --- 4. Occasional scripted incident ---
  if (Math.random() < INCIDENT_PROBABILITY) {
    const incident = randomIncident();
    state.incidents = [incident, ...state.incidents.filter((i) => i.resolved)];
    appendLog(state, "incident", incident.description);
  }

  // --- 5. Auto-resolve old incidents (after 3 ticks worth ~15s each) ---
  state.incidents = state.incidents.map((inc) => {
    const ageMs = Date.now() - new Date(inc.timestamp).getTime();
    return ageMs > 45_000 ? { ...inc, resolved: true } : inc;
  });

  // Keep eventLog to last 20 entries
  state.eventLog = state.eventLog.slice(-20);

  _state = state;
  return state;
}

/**
 * Deterministically forces a congestion spike for reliable demo moments.
 * - Sets gate-a and gate-b to "critical" and "high"
 * - Injects a security incident in the North zone
 * - Logs the event
 *
 * Called by POST /api/sim-data/trigger-spike
 */
export function triggerSpike(): LiveState {
  const state = getState();

  state.timestamp = new Date().toISOString();

  // Force crowd levels
  state.crowdDensity["gate-a"] = "critical";
  state.crowdDensity["gate-b"] = "high";
  state.crowdDensity["gate-d"] = "high";

  // Inject a deterministic incident
  const spike: Incident = {
    id: `incident-spike-${_incidentCounter++}`,
    zone: "North",
    type: "congestion",
    description:
      "⚠️ Congestion spike triggered: Gate A has reached critical crowd density. Immediate ops action recommended — consider opening Gate E overflow and redirecting fans via PA.",
    timestamp: new Date().toISOString(),
    resolved: false,
  };

  state.incidents = [spike, ...state.incidents.filter((i) => !i.resolved)];
  appendLog(state, "alert", spike.description);

  _state = state;
  return state;
}

/**
 * Resets state to initial values — useful for test routes / CI.
 */
export function resetState(): LiveState {
  _incidentCounter = 1;
  _state = getInitialState();
  return _state;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function appendLog(state: LiveState, type: EventLogEntry["type"], text: string): void {
  state.eventLog.push({ timestamp: new Date().toISOString(), type, text });
}

function randomDelayNote(transitId: string): string {
  const notes: Record<string, string[]> = {
    "train-1": [
      "Signal fault at Central Junction. Expect 10–15 min delays.",
      "Platform overcrowding at Stadium Station — trains holding at previous stop.",
    ],
    "bus-1": [
      "Heavy post-match traffic on Stadium Blvd. Route 42 running 20 min behind.",
      "Mechanical issue with lead bus. Next service in approx. 25 min.",
    ],
    "bus-2": [
      "Shuttle temporarily suspended due to lot congestion. Service resumes shortly.",
    ],
    "rideshare-1": [
      "High demand in area. Surge pricing active. Estimated wait 15–20 min.",
    ],
  };
  const options = notes[transitId] ?? ["Service disruption — check local transport app."];
  return options[Math.floor(Math.random() * options.length)];
}

function randomIncident(): Incident {
  const templates: Omit<Incident, "id" | "timestamp" | "resolved">[] = [
    {
      zone: "South",
      type: "maintenance",
      description: "Gate C turnstile fault — one lane closed. 10 min estimated fix time.",
    },
    {
      zone: "East",
      type: "medical",
      description: "Minor medical assist near Gate B — first-aid team deployed. No crowd impact expected.",
    },
    {
      zone: "North",
      type: "congestion",
      description: "Gate A queue extending to outer plaza. Consider opening Gate E to relieve pressure.",
    },
    {
      zone: "West",
      type: "security",
      description: "Lost item report at Gate D security checkpoint — brief queue slowdown.",
    },
    {
      zone: "North",
      type: "weather",
      description: "Light rain starting. Recommend activating weather shelter guidance via PA.",
    },
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  return {
    ...template,
    id: `incident-${_incidentCounter++}`,
    timestamp: new Date().toISOString(),
    resolved: false,
  };
}
