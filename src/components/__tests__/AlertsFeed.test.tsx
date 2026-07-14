// @vitest-environment jsdom
/**
 * src/components/__tests__/AlertsFeed.test.tsx
 *
 * Unit tests for AlertsFeed component.
 * Covers:
 *   - Loading skeleton while fetching
 *   - Empty state when no alerts
 *   - Alert cards rendered with correct priority labels
 *   - Expand/collapse of recommended action
 *   - onNewHighAlert callback when new high alerts appear
 *   - Refresh button renders
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import type { Alert } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    timestamp: new Date().toISOString(),
    priority: "high",
    summary: "Gate C is critically congested",
    recommendedAction: "Redirect fans to Gate A",
    source: "gate-c",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AlertsFeed", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading skeleton before data arrives", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    expect(screen.getByLabelText("Loading alerts")).toBeInTheDocument();
  });

  it("shows empty state when alert list is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    await waitFor(() => {
      expect(screen.getByText(/No active alerts/i)).toBeInTheDocument();
    });
  });

  it("renders a high-priority alert card", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([makeAlert()]), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    await waitFor(() => {
      expect(screen.getByText("Gate C is critically congested")).toBeInTheDocument();
      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });
  });

  it("renders medium and low priority labels", async () => {
    const alerts = [
      makeAlert({ id: "a1", priority: "high", summary: "High alert" }),
      makeAlert({ id: "a2", priority: "medium", summary: "Medium alert" }),
      makeAlert({ id: "a3", priority: "low", summary: "Low alert" }),
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(alerts), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    await waitFor(() => {
      expect(screen.getByText("HIGH")).toBeInTheDocument();
      expect(screen.getByText("MED")).toBeInTheDocument();
      expect(screen.getByText("LOW")).toBeInTheDocument();
    });
  });

  it("expands recommended action on click", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([makeAlert()]), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);

    await waitFor(() => {
      expect(screen.getByText("Gate C is critically congested")).toBeInTheDocument();
    });

    expect(screen.queryByText("Redirect fans to Gate A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Gate C is critically congested"));

    await waitFor(() => {
      expect(screen.getByText("Redirect fans to Gate A")).toBeInTheDocument();
    });
  });

  it("collapses recommended action on second click", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([makeAlert()]), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);

    await waitFor(() => screen.getByText("Gate C is critically congested"));

    fireEvent.click(screen.getByText("Gate C is critically congested"));
    await waitFor(() => screen.getByText("Redirect fans to Gate A"));

    fireEvent.click(screen.getByText("Gate C is critically congested"));
    await waitFor(() => {
      expect(screen.queryByText("Redirect fans to Gate A")).not.toBeInTheDocument();
    });
  });

  it("calls onNewHighAlert when high alerts appear for first time", async () => {
    const handler = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([makeAlert({ priority: "high" })]), {
        status: 200,
      })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed onNewHighAlert={handler} />);
    await waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  it("does not call onNewHighAlert when high count has not increased", async () => {
    const handler = vi.fn();
    const alerts = [makeAlert({ priority: "low" })];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(alerts), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed onNewHighAlert={handler} />);
    await waitFor(() => screen.getByText("LOW"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("shows error message when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    await waitFor(() => {
      expect(screen.getByText(/Could not fetch alerts/i)).toBeInTheDocument();
    });
  });

  it("renders the Refresh button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    const { AlertsFeed } = await import("../AlertsFeed");
    render(<AlertsFeed />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Refresh alerts/i })
      ).toBeInTheDocument();
    });
  });
});
