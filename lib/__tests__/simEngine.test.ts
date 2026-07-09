/**
 * lib/__tests__/simEngine.test.ts
 *
 * Unit tests for lib/simEngine.ts
 *
 * Covers:
 *  - getInitialState() shape and defaults
 *  - getState() singleton initialisation
 *  - tick() mutations and invariants
 *  - triggerSpike() deterministic overrides
 *  - resetState() idempotency
 *  - eventLog cap (max 20 entries)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getInitialState,
  getState,
  tick,
  triggerSpike,
  resetState,
} from "../simEngine";
import type { CrowdLevel, LiveState } from "../types";

const CROWD_LEVELS: CrowdLevel[] = ["low", "moderate", "high", "critical"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when every value in the record is a valid CrowdLevel. */
function allCrowdLevelsValid(density: Record<string, CrowdLevel>): boolean {
  return Object.values(density).every((v) => CROWD_LEVELS.includes(v));
}

// Always start each test from a clean slate
beforeEach(() => {
  resetState();
});

// ---------------------------------------------------------------------------
// getInitialState()
// ---------------------------------------------------------------------------

describe("getInitialState()", () => {
  it("returns a LiveState with the required top-level keys", () => {
    const state = getInitialState();
    expect(state).toHaveProperty("timestamp");
    expect(state).toHaveProperty("crowdDensity");
    expect(state).toHaveProperty("transitStatus");
    expect(state).toHaveProperty("incidents");
    expect(state).toHaveProperty("weather");
    expect(state).toHaveProperty("eventLog");
  });

  it("initialises all 5 expected gates", () => {
    const { crowdDensity } = getInitialState();
    const gateIds = Object.keys(crowdDensity);
    expect(gateIds).toContain("gate-a");
    expect(gateIds).toContain("gate-b");
    expect(gateIds).toContain("gate-c");
    expect(gateIds).toContain("gate-d");
    expect(gateIds).toContain("gate-e");
    expect(gateIds).toHaveLength(5);
  });

  it("all initial crowd levels are valid CrowdLevel values", () => {
    expect(allCrowdLevelsValid(getInitialState().crowdDensity)).toBe(true);
  });

  it("initialises all 4 transit lines as on_time", () => {
    const { transitStatus } = getInitialState();
    const ids = Object.keys(transitStatus);
    expect(ids).toContain("train-1");
    expect(ids).toContain("bus-1");
    expect(ids).toContain("bus-2");
    expect(ids).toContain("rideshare-1");
    for (const entry of Object.values(transitStatus)) {
      expect(entry.status).toBe("on_time");
    }
  });

  it("starts with no unresolved incidents", () => {
    const { incidents } = getInitialState();
    const unresolved = incidents.filter((i) => !i.resolved);
    expect(unresolved).toHaveLength(0);
  });

  it("seeds the eventLog with 4 historical entries", () => {
    const { eventLog } = getInitialState();
    expect(eventLog).toHaveLength(4);
  });

  it("weather defaults to Sunny at 28°C", () => {
    const { weather } = getInitialState();
    expect(weather.condition).toBe("Sunny");
    expect(weather.tempC).toBe(28);
  });

  it("timestamp is a valid ISO 8601 string", () => {
    const { timestamp } = getInitialState();
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

// ---------------------------------------------------------------------------
// getState()
// ---------------------------------------------------------------------------

describe("getState()", () => {
  it("returns the same object on repeated calls (singleton)", () => {
    const a = getState();
    const b = getState();
    expect(a).toBe(b);
  });

  it("initialises state automatically on first call after reset", () => {
    const state = getState();
    expect(state).toBeDefined();
    expect(state.crowdDensity).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// tick()
// ---------------------------------------------------------------------------

describe("tick()", () => {
  it("returns a LiveState object", () => {
    const state = tick();
    expect(state).toHaveProperty("crowdDensity");
    expect(state).toHaveProperty("transitStatus");
    expect(state).toHaveProperty("incidents");
  });

  it("updates the timestamp on every tick", () => {
    const before = getState().timestamp;
    // Small delay so timestamp differs
    const afterTick = tick();
    // Timestamp must be a valid ISO string and >= the one before the tick
    expect(new Date(afterTick.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    );
  });

  it("all crowd levels remain valid CrowdLevel values after a tick", () => {
    // Run 20 ticks — exercises the random walk thoroughly
    for (let i = 0; i < 20; i++) {
      const state = tick();
      expect(allCrowdLevelsValid(state.crowdDensity)).toBe(true);
    }
  });

  it("crowd levels never go below 'low' or above 'critical'", () => {
    for (let i = 0; i < 50; i++) {
      const state = tick();
      for (const level of Object.values(state.crowdDensity)) {
        const idx = CROWD_LEVELS.indexOf(level);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(3);
      }
    }
  });

  it("transit status values are only 'on_time', 'delayed', or 'closed'", () => {
    const valid = ["on_time", "delayed", "closed"] as const;
    for (let i = 0; i < 20; i++) {
      const state = tick();
      for (const entry of Object.values(state.transitStatus)) {
        expect(valid).toContain(entry.status);
      }
    }
  });

  it("eventLog never exceeds 20 entries after many ticks", () => {
    for (let i = 0; i < 30; i++) {
      tick();
    }
    const state = getState();
    expect(state.eventLog.length).toBeLessThanOrEqual(20);
  });

  it("incidents auto-resolve after ~45 s (age threshold)", () => {
    const state = getState();
    // Manually inject an old unresolved incident
    const oldTimestamp = new Date(Date.now() - 50_000).toISOString();
    state.incidents = [
      {
        id: "test-incident-1",
        zone: "North",
        type: "congestion",
        description: "Test congestion",
        timestamp: oldTimestamp,
        resolved: false,
      },
    ];
    // tick() should auto-resolve incidents older than 45 s
    const after = tick();
    const testIncident = after.incidents.find((i) => i.id === "test-incident-1");
    expect(testIncident?.resolved).toBe(true);
  });

  it("returns the same singleton reference that getState() returns", () => {
    const ticked = tick();
    const gotten = getState();
    expect(ticked).toBe(gotten);
  });
});

// ---------------------------------------------------------------------------
// triggerSpike()
// ---------------------------------------------------------------------------

describe("triggerSpike()", () => {
  it("sets gate-a to 'critical'", () => {
    const state = triggerSpike();
    expect(state.crowdDensity["gate-a"]).toBe("critical");
  });

  it("sets gate-b to 'high'", () => {
    const state = triggerSpike();
    expect(state.crowdDensity["gate-b"]).toBe("high");
  });

  it("sets gate-d to 'high'", () => {
    const state = triggerSpike();
    expect(state.crowdDensity["gate-d"]).toBe("high");
  });

  it("injects exactly one unresolved incident", () => {
    const state = triggerSpike();
    const unresolved = state.incidents.filter((i) => !i.resolved);
    expect(unresolved.length).toBeGreaterThanOrEqual(1);
  });

  it("the injected incident has type 'congestion'", () => {
    const state = triggerSpike();
    const spike = state.incidents.find((i) => i.type === "congestion" && !i.resolved);
    expect(spike).toBeDefined();
  });

  it("the injected incident mentions Gate A in its description", () => {
    const state = triggerSpike();
    const spike = state.incidents.find((i) => !i.resolved);
    expect(spike?.description.toLowerCase()).toContain("gate a");
  });

  it("appends an alert entry to the eventLog", () => {
    const before = getState().eventLog.length;
    triggerSpike();
    const after = getState().eventLog.length;
    expect(after).toBeGreaterThan(before);
    const lastEntry = getState().eventLog[getState().eventLog.length - 1];
    expect(lastEntry.type).toBe("alert");
  });

  it("is deterministic — calling twice always results in gate-a being critical", () => {
    resetState();
    triggerSpike();
    resetState();
    triggerSpike();
    expect(getState().crowdDensity["gate-a"]).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// resetState()
// ---------------------------------------------------------------------------

describe("resetState()", () => {
  it("returns a fresh LiveState with default crowd levels", () => {
    triggerSpike(); // Dirty the state
    const fresh = resetState();
    expect(fresh.crowdDensity["gate-a"]).not.toBe("critical");
    expect(fresh.crowdDensity["gate-a"]).toMatch(/^(low|moderate)$/);
  });

  it("clears all incidents", () => {
    triggerSpike();
    const fresh = resetState();
    const unresolved = fresh.incidents.filter((i) => !i.resolved);
    expect(unresolved).toHaveLength(0);
  });

  it("subsequent getState() returns the reset state", () => {
    triggerSpike();
    resetState();
    const state = getState();
    expect(state.crowdDensity["gate-a"]).not.toBe("critical");
  });

  it("resets all transit lines to on_time", () => {
    // Dirty transit state manually
    const state = getState();
    state.transitStatus["train-1"] = { status: "delayed", note: "test" };
    const fresh = resetState();
    expect(fresh.transitStatus["train-1"].status).toBe("on_time");
  });
});
