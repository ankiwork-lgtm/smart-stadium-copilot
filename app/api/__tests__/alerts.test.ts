/**
 * app/api/__tests__/alerts.test.ts
 *
 * Unit tests for app/api/alerts/route.ts
 *
 * Tests the breach-detection logic, Gemini deduplication, and response shape.
 * The Gemini wrapper and simEngine are mocked — no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import type { LiveState } from "../../../lib/types";

// ---------------------------------------------------------------------------
// We need a fresh module import for each test group because the module holds
// in-memory Maps that carry state between tests.
// Use vi.resetModules() + dynamic import inside each describe block.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper — produce a GET request with a unique IP so the rate-limiter never
// blocks test calls (each call to makeAlertRequest() generates a new IP).
// ---------------------------------------------------------------------------

let _alertIpCounter = 0;
function makeAlertRequest(): NextRequest {
  return new NextRequest("http://localhost/api/alerts", {
    method: "GET",
    headers: { "x-forwarded-for": `198.51.100.${(_alertIpCounter++ % 254) + 1}` },
  });
}

// ---------------------------------------------------------------------------
// Default mock LiveState factory
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<LiveState> = {}): LiveState {
  return {
    timestamp: "2026-07-01T12:00:00.000Z",
    crowdDensity: {
      "gate-a": "low",
      "gate-b": "low",
      "gate-c": "low",
      "gate-d": "low",
      "gate-e": "low",
    },
    transitStatus: {
      "train-1": { status: "on_time" },
      "bus-1": { status: "on_time" },
      "bus-2": { status: "on_time" },
      "rideshare-1": { status: "on_time" },
    },
    incidents: [],
    weather: { condition: "Sunny", tempC: 28 },
    eventLog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// No-breach state: all low density, no delays, no incidents
// ---------------------------------------------------------------------------

describe("GET /api/alerts — no breaches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an empty array when there are no threshold breaches", async () => {
    vi.doMock("../../../lib/simEngine", () => ({ getState: () => makeState() }));
    vi.doMock("../../../lib/gemini", () => ({ askAssistantStructured: vi.fn() }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Crowd density breaches
// ---------------------------------------------------------------------------

describe("GET /api/alerts — crowd density breaches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("generates a HIGH-priority alert for a critical gate", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({ crowdDensity: { "gate-a": "critical", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Gate A is critical.",
        recommendedAction: "Open Gate E.",
        priority: "high",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    expect(json.length).toBeGreaterThanOrEqual(1);
    const alert = json.find((a: { source: string }) => a.source === "gate-a");
    expect(alert).toBeDefined();
    expect(alert.priority).toBe("high");
    expect(alert.summary).toBe("Gate A is critical.");
    expect(alert.recommendedAction).toBe("Open Gate E.");
  });

  it("generates a MEDIUM-priority alert for a high-density gate", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({ crowdDensity: { "gate-a": "high", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Gate A is high density.",
        recommendedAction: "Monitor and prepare overflow.",
        priority: "medium",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    const alert = json.find((a: { source: string }) => a.source === "gate-a");
    expect(alert).toBeDefined();
    expect(alert.priority).toBe("medium");
  });

  it("does NOT generate alerts for low or moderate crowd levels", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          crowdDensity: {
            "gate-a": "moderate",
            "gate-b": "low",
            "gate-c": "low",
            "gate-d": "moderate",
            "gate-e": "low",
          },
        }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn(),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Transit delay breaches
// ---------------------------------------------------------------------------

describe("GET /api/alerts — transit delay breaches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("generates a MEDIUM-priority alert for a delayed transit line", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          transitStatus: {
            "train-1": { status: "delayed", note: "Signal fault." },
            "bus-1": { status: "on_time" },
            "bus-2": { status: "on_time" },
            "rideshare-1": { status: "on_time" },
          },
        }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Blue Line is delayed.",
        recommendedAction: "Advise fans to take Route 42.",
        priority: "medium",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    const alert = json.find((a: { source: string }) => a.source === "train-1");
    expect(alert).toBeDefined();
    expect(alert.priority).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// Incident breaches
// ---------------------------------------------------------------------------

describe("GET /api/alerts — incident breaches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("generates a HIGH-priority alert for an unresolved security incident", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          incidents: [
            {
              id: "incident-1",
              zone: "North",
              type: "security",
              description: "Suspicious item found at Gate A.",
              timestamp: new Date().toISOString(),
              resolved: false,
            },
          ],
        }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Security incident at Gate A.",
        recommendedAction: "Evacuate North zone.",
        priority: "high",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    const alert = json.find((a: { source: string }) => a.source === "incident-1");
    expect(alert).toBeDefined();
    expect(alert.priority).toBe("high");
  });

  it("generates a HIGH-priority alert for an unresolved medical incident", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          incidents: [
            {
              id: "incident-med-1",
              zone: "East",
              type: "medical",
              description: "Fan requires medical assistance near Gate B.",
              timestamp: new Date().toISOString(),
              resolved: false,
            },
          ],
        }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Medical incident at Gate B.",
        recommendedAction: "Deploy First Aid Station B.",
        priority: "high",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    const alert = json.find((a: { source: string }) => a.source === "incident-med-1");
    expect(alert).toBeDefined();
    expect(alert.priority).toBe("high");
  });

  it("does NOT generate an alert for a resolved incident", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          incidents: [
            {
              id: "incident-resolved",
              zone: "South",
              type: "congestion",
              description: "Old resolved incident.",
              timestamp: new Date(Date.now() - 60_000).toISOString(),
              resolved: true,
            },
          ],
        }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn(),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Alert shape
// ---------------------------------------------------------------------------

describe("GET /api/alerts — response shape", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("each alert has required fields: id, timestamp, priority, summary, recommendedAction, source", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({ crowdDensity: { "gate-a": "critical", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Critical crowd at Gate A.",
        recommendedAction: "Redirect fans.",
        priority: "high",
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    for (const alert of json) {
      expect(alert).toHaveProperty("id");
      expect(alert).toHaveProperty("timestamp");
      expect(alert).toHaveProperty("priority");
      expect(alert).toHaveProperty("summary");
      expect(alert).toHaveProperty("recommendedAction");
      expect(alert).toHaveProperty("source");
    }
  });

  it("alerts are sorted: high priority before medium", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({
          crowdDensity: { "gate-a": "critical", "gate-b": "high", "gate-c": "low", "gate-d": "low", "gate-e": "low" },
        }),
    }));

    let callCount = 0;
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          summary: "Alert",
          recommendedAction: "Act",
          priority: callCount === 1 ? "high" : "medium",
        });
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    if (json.length >= 2) {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      for (let i = 0; i < json.length - 1; i++) {
        expect(priorityOrder[json[i].priority]).toBeLessThanOrEqual(
          priorityOrder[json[i + 1].priority]
        );
      }
    }
  });

  it("handles Gemini parse error gracefully — includes rawText in alert", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () =>
        makeState({ crowdDensity: { "gate-a": "critical", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } }),
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        rawText: "Gemini returned free text instead of JSON.",
        parseError: true,
      }),
    }));

    const { GET } = await import("../alerts/route");
    const res = await GET(makeAlertRequest());
    const json = await res.json();

    expect(json.length).toBeGreaterThanOrEqual(1);
    const alert = json[0];
    expect(alert.summary).toBeTruthy();
    expect(alert.recommendedAction).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Dedup: oscillation cooldown
// ---------------------------------------------------------------------------

describe("GET /api/alerts — dedup: oscillation cooldown", () => {
  // Test the cooldown logic: breach activates, clears, reactivates
  // This is integrated with how the route.ts file holds _seenBreachIds state

  it("clears _seenBreachIds when a breach resolves (allow re-alert on reactivation)", async () => {
    // Since _seenBreachIds is a module singleton held in route.ts,
    // we test it by simulating state changes and checking alert generation.
    // This test documents the behavior: cleared breaches should alert again immediately if they reactivate.

    let callCount = 0;
    const getStateMock = vi.fn();
    const geminiMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return Promise.resolve({
        summary: "Breach detected.",
        recommendedAction: "Take action.",
        priority: "medium",
      });
    });

    vi.resetModules();
    vi.doMock("../../../lib/simEngine", () => ({
      getState: getStateMock,
    }));
    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: geminiMock,
    }));

    const { GET } = await import("../alerts/route");

    // First call: gate-a is high
    getStateMock.mockReturnValue(
      makeState({ crowdDensity: { "gate-a": "high", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } })
    );
    await GET(makeAlertRequest());
    expect(callCount).toBe(1);

    // Second call: gate-a cleared
    getStateMock.mockReturnValue(
      makeState({ crowdDensity: { "gate-a": "low", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } })
    );
    await GET(makeAlertRequest());
    expect(callCount).toBe(1); // No new alert for cleared breach

    // Third call: gate-a reactivated immediately (after fix, _seenBreachIds was cleared when breach resolved)
    // With the old buggy code, this would NOT generate an alert (still in cooldown).
    // With the fix, _seenBreachIds is cleared when breach resolves, so alert is generated.
    getStateMock.mockReturnValue(
      makeState({ crowdDensity: { "gate-a": "high", "gate-b": "low", "gate-c": "low", "gate-d": "low", "gate-e": "low" } })
    );
    await GET(makeAlertRequest());
    // This documents the fixed behavior: reactivated breaches get new alerts.
    // If this test fails, it means _seenBreachIds wasn't cleared or the fix broke.
    expect(callCount).toBe(2);
  });
});
