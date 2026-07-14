// @vitest-environment jsdom
/**
 * src/components/__tests__/VenueMap.test.tsx
 *
 * Unit tests for VenueMap component.
 * Covers:
 *   - Loading spinner shown while fetching venue data
 *   - "Map unavailable" shown when fetch fails
 *   - Venue name rendered in header after data loads
 *   - Gates rendered as SVG img roles with aria-labels
 *   - highlightedIds prop renders highlighted gate elements
 *   - Legend items rendered for all facility types
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import type { VenueData } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeVenueData(overrides: Partial<VenueData> = {}): VenueData {
  return {
    venueName: "Legacy Stadium",
    city: "Test City",
    event: "FIFA WC 2026",
    capacity: 80000,
    gates: [
      {
        id: "gate-a",
        name: "Gate A",
        label: "A",
        zone: "North",
        accessible: true,
        coords: [400, 82],
        description: "North entrance",
      },
      {
        id: "gate-b",
        name: "Gate B",
        label: "B",
        zone: "South",
        accessible: false,
        coords: [400, 598],
        description: "South entrance",
      },
    ],
    facilities: [
      {
        id: "facility-restroom-1",
        name: "Restroom Block 1",
        type: "restroom",
        accessible: true,
        nearGate: "gate-a",
        zone: "North",
        coords: [380, 120],
        description: "North restrooms",
      },
    ],
    transitOptions: [],
    sustainabilityPoints: [
      {
        id: "sp-1",
        name: "Recycling Station 1",
        type: "recycling",
        nearGate: "gate-a",
        zone: "North",
        coords: [350, 130],
        description: "Recycling point",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VenueMap", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading spinner while fetching venue data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });

  it("shows 'Map unavailable' when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(screen.getByText(/Map unavailable/i)).toBeInTheDocument();
    });
  });

  it("renders venue name in header after data loads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(screen.getByText("Legacy Stadium")).toBeInTheDocument();
    });
  });

  it("renders city name in header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(screen.getByText("Test City")).toBeInTheDocument();
    });
  });

  it("renders SVG map with correct aria-label", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /Venue map for Legacy Stadium/i })
      ).toBeInTheDocument();
    });
  });

  it("renders gate elements with aria-labels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Gate A" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Gate B" })).toBeInTheDocument();
    });
  });

  it("renders facility elements with aria-labels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Restroom Block 1" })
      ).toBeInTheDocument();
    });
  });

  it("renders legend items for facility types", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap />);
    await waitFor(() => {
      expect(screen.getByText(/restroom/i)).toBeInTheDocument();
      expect(screen.getByText(/first aid/i)).toBeInTheDocument();
      expect(screen.getByText(/recycling/i)).toBeInTheDocument();
    });
  });

  it("passes highlightedIds without crashing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeVenueData()), { status: 200 })
    );
    const { VenueMap } = await import("../VenueMap");
    render(<VenueMap highlightedIds={["gate-a", "facility-restroom-1"]} />);
    await waitFor(() => {
      expect(screen.getByText("Legacy Stadium")).toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: "Gate A" })).toBeInTheDocument();
  });
});
