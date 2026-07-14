// @vitest-environment jsdom
/**
 * src/components/__tests__/CrowdDashboard.test.tsx
 *
 * Unit tests for CrowdDashboard component.
 * Covers:
 *   - Loading skeleton while fetching
 *   - Error state when fetch fails
 *   - Gate cards rendered with correct crowd level labels
 *   - Summary strip (critical / high counts, nominal message)
 *   - Trigger Spike button visibility controlled by hideSpikeButton prop
 *   - onSpikeTriggered callback invoked after spike
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, act } from "@testing-library/react";
import type { LiveState } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const VENUE_STUB = {
  venueName: "Test Stadium",
  city: "Test City",
  event: "Test Event",
  capacity: 50000,
  gates: [],
  facilities: [],
  transitOptions: [],
  sustainabilityPoints: [],
};

function makeLiveState(overrides: Partial<LiveState> = {}): LiveState {
  return {
    timestamp: new Date().toISOString(),
    crowdDensity: {
      "gate-a": "low",
      "gate-b": "moderate",
      "gate-c": "high",
      "gate-d": "critical",
    },
    transitStatus: {
      "train-1": { status: "on_time" },
    },
    incidents: [],
    weather: { condition: "Sunny", tempC: 22 },
    eventLog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CrowdDashboard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading skeleton while waiting for data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {})
    );
    // Dynamic import to get a fresh module with cleared cache
    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);
    expect(screen.getByLabelText("Loading crowd data")).toBeInTheDocument();
  });

  it("shows error state when sim-data fetch fails and no cached state", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Unable to fetch live data/i)).toBeInTheDocument();
    });
  });

  it("renders gate cards with correct crowd level labels after data loads", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(JSON.stringify(makeLiveState()), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Low")).toBeInTheDocument();
      expect(screen.getByText("Moderate")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    });
  });

  it("shows '1 Critical' and '1 High' in the summary strip", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(JSON.stringify(makeLiveState()), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/1 Critical/i)).toBeInTheDocument();
      expect(screen.getByText(/1 High/i)).toBeInTheDocument();
    });
  });

  it("shows 'All gates nominal' when no high/critical gates", async () => {
    const normalState = makeLiveState({
      crowdDensity: { "gate-a": "low", "gate-b": "moderate" },
    });
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(JSON.stringify(normalState), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/All gates nominal/i)).toBeInTheDocument();
    });
  });

  it("hides Trigger Spike button when hideSpikeButton=true", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(makeLiveState({ crowdDensity: { "gate-a": "low" } })),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard hideSpikeButton />);

    // wait until loading state is gone
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading crowd data")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Trigger/i })).not.toBeInTheDocument();
  });

  it("shows Trigger Spike button when hideSpikeButton=false (default)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(makeLiveState({ crowdDensity: { "gate-a": "low" } })),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    render(<CrowdDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Trigger simulated congestion spike/i })
      ).toBeInTheDocument();
    });
  });

  it("calls onSpikeTriggered after a successful spike", async () => {
    const spikeResult = makeLiveState({
      crowdDensity: { "gate-a": "critical" },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const s = String(url);
      if (s.includes("trigger-spike")) {
        return Promise.resolve(
          new Response(JSON.stringify(spikeResult), { status: 200 })
        );
      }
      if (s.includes("/api/sim-data")) {
        return Promise.resolve(
          new Response(
            JSON.stringify(makeLiveState({ crowdDensity: { "gate-a": "low" } })),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(VENUE_STUB), { status: 200 })
      );
    });

    const { CrowdDashboard } = await import("../CrowdDashboard");
    const handler = vi.fn();
    render(<CrowdDashboard onSpikeTriggered={handler} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Trigger simulated congestion spike/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Trigger simulated congestion spike/i })
      );
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
