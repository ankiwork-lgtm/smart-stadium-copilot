/**
 * app/api/__tests__/routes.test.ts
 *
 * Integration tests for untested API routes:
 * - GET /api/sim-data
 * - GET /api/venue
 * - GET /api/warmup
 * - POST /api/sim-data/trigger-spike
 * - POST /api/briefing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LiveState, VenueData } from "../../../lib/types";

// ---------------------------------------------------------------------------
// GET /api/sim-data
// ---------------------------------------------------------------------------

describe("GET /api/sim-data", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a valid LiveState object", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      tick: () => ({
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
      }),
    }));

    const { GET } = await import("../sim-data/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data: LiveState = await res.json();
    expect(data.timestamp).toBeTruthy();
    expect(data.crowdDensity).toBeTruthy();
    expect(data.transitStatus).toBeTruthy();
    expect(data.incidents).toEqual([]);
    expect(data.weather).toBeTruthy();
    expect(data.eventLog).toBeTruthy();
  });

  it("handles simEngine errors gracefully", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      tick: () => {
        throw new Error("Simulation error");
      },
    }));

    const { GET } = await import("../sim-data/route");
    const res = await GET();

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to advance simulation state.");
  });
});

// ---------------------------------------------------------------------------
// GET /api/venue
// ---------------------------------------------------------------------------

describe("GET /api/venue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns venue data with correct structure", async () => {
    const { GET } = await import("../venue/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data: VenueData = await res.json();

    expect(data.venueName).toBeTruthy();
    expect(data.city).toBeTruthy();
    expect(data.event).toBeTruthy();
    expect(data.capacity).toBeGreaterThan(0);
    expect(Array.isArray(data.gates)).toBe(true);
    expect(data.gates.length).toBeGreaterThan(0);
    expect(Array.isArray(data.facilities)).toBe(true);
    expect(Array.isArray(data.transitOptions)).toBe(true);
  });

  it("includes cache headers for CDN", async () => {
    const { GET } = await import("../venue/route");
    const res = await GET();

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("max-age=3600");
    expect(cacheControl).toContain("stale-while-revalidate=600");
  });

  it("each gate has required properties", async () => {
    const { GET } = await import("../venue/route");
    const res = await GET();
    const data: VenueData = await res.json();

    for (const gate of data.gates) {
      expect(gate.id).toBeTruthy();
      expect(gate.name).toBeTruthy();
      expect(gate.zone).toBeTruthy();
      expect(typeof gate.accessible).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/warmup
// ---------------------------------------------------------------------------

describe("GET /api/warmup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 200 on success", async () => {
    vi.doMock("../../../lib/gemini", () => ({
      askAssistant: vi.fn().mockResolvedValue({ success: true, text: "ok" }),
    }));

    const { GET } = await import("../warmup/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 200 even if Gemini fails (non-fatal)", async () => {
    vi.doMock("../../../lib/gemini", () => ({
      askAssistant: vi.fn().mockRejectedValue(new Error("Gemini unavailable")),
    }));

    const { GET } = await import("../warmup/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("calls askAssistant with minimal warm-up prompt", async () => {
    const mockAskAssistant = vi.fn().mockResolvedValue({ success: true, text: "ok" });
    vi.doMock("../../../lib/gemini", () => ({
      askAssistant: mockAskAssistant,
    }));

    const { GET } = await import("../warmup/route");
    await GET();

    expect(mockAskAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "ping",
        userContext: { role: "fan", language: "en" },
        mode: "wayfinding",
      })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/sim-data/trigger-spike
// ---------------------------------------------------------------------------

describe("POST /api/sim-data/trigger-spike", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns updated LiveState after spike", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      triggerSpike: () => ({
        timestamp: "2026-07-01T12:00:05.000Z",
        crowdDensity: {
          "gate-a": "critical",
          "gate-b": "high",
          "gate-c": "low",
          "gate-d": "high",
          "gate-e": "low",
        },
        transitStatus: {
          "train-1": { status: "on_time" },
          "bus-1": { status: "on_time" },
          "bus-2": { status: "on_time" },
          "rideshare-1": { status: "on_time" },
        },
        incidents: [
          {
            id: "incident-spike-1",
            zone: "North",
            type: "congestion",
            description: "Congestion spike",
            timestamp: "2026-07-01T12:00:05.000Z",
            resolved: false,
          },
        ],
        weather: { condition: "Sunny", tempC: 28 },
        eventLog: [],
      }),
    }));

    const { POST } = await import("../sim-data/trigger-spike/route");
    const res = await POST();

    expect(res.status).toBe(200);
    const data: LiveState = await res.json();
    expect(data.crowdDensity["gate-a"]).toBe("critical");
    expect(data.incidents.length).toBeGreaterThan(0);
  });

  it("handles errors gracefully", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      triggerSpike: () => {
        throw new Error("Spike error");
      },
    }));

    const { POST } = await import("../sim-data/trigger-spike/route");
    const res = await POST();

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to trigger spike.");
  });
});

// ---------------------------------------------------------------------------
// POST /api/briefing
// ---------------------------------------------------------------------------

describe("POST /api/briefing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns structured briefing with all required fields", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () => ({
        timestamp: "2026-07-01T12:00:00.000Z",
        crowdDensity: {
          "gate-a": "moderate",
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
        eventLog: [
          { timestamp: "2026-07-01T11:00:00.000Z", type: "alert", text: "Pre-match briefing started" },
        ],
      }),
    }));

    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        summary: "Shift started normally, all systems on time.",
        recommendedAction: "Monitor crowd levels at Gate A.",
        priority: "low",
      }),
    }));

    const { POST } = await import("../briefing/route");
    const req = new Request("http://localhost/api/briefing", { method: "POST" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBe("Shift started normally, all systems on time.");
    expect(data.recommendedAction).toBe("Monitor crowd levels at Gate A.");
    expect(data.priority).toBe("low");
    expect(data.generatedAt).toBeTruthy();
  });

  it("accepts optional language parameter", async () => {
    const mockGemini = vi.fn().mockResolvedValue({
      summary: "Resumen de turno",
      recommendedAction: "Acción recomendada",
      priority: "medium",
    });

    vi.doMock("../../../lib/simEngine", () => ({
      getState: () => ({
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
      }),
    }));

    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: mockGemini,
    }));

    const { POST } = await import("../briefing/route");
    const req = new Request("http://localhost/api/briefing", {
      method: "POST",
      body: JSON.stringify({ language: "es" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mockGemini).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: expect.objectContaining({ language: "es" }),
      })
    );
  });

  it("handles parse error gracefully", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () => ({
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
      }),
    }));

    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockResolvedValue({
        rawText: "Gemini returned unexpected format",
        parseError: true,
      }),
    }));

    const { POST } = await import("../briefing/route");
    const req = new Request("http://localhost/api/briefing", { method: "POST" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.parseError).toBe(true);
    expect(data.rawText).toBe("Gemini returned unexpected format");
  });

  it("handles Gemini errors gracefully", async () => {
    vi.doMock("../../../lib/simEngine", () => ({
      getState: () => ({
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
      }),
    }));

    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: vi.fn().mockRejectedValue(new Error("Gemini error")),
    }));

    const { POST } = await import("../briefing/route");
    const req = new Request("http://localhost/api/briefing", { method: "POST" });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to generate shift briefing.");
  });

  it("defaults to English when language is invalid", async () => {
    const mockGemini = vi.fn().mockResolvedValue({
      summary: "Hello",
      recommendedAction: "Act",
      priority: "low",
    });

    vi.doMock("../../../lib/simEngine", () => ({
      getState: () => ({
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
      }),
    }));

    vi.doMock("../../../lib/gemini", () => ({
      askAssistantStructured: mockGemini,
    }));

    const { POST } = await import("../briefing/route");
    const req = new Request("http://localhost/api/briefing", {
      method: "POST",
      body: JSON.stringify({ language: "de" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mockGemini).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: expect.objectContaining({ language: "en" }),
      })
    );
  });
});
