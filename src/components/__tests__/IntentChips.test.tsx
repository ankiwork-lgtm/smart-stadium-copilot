// @vitest-environment jsdom
/**
 * src/components/__tests__/IntentChips.test.tsx
 *
 * Unit tests for IntentChips component.
 * Covers: chip rendering, active/inactive state, onChipSelect callback,
 * aria-pressed attribute.
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { IntentChips, INTENT_CHIPS } from "../IntentChips";

afterEach(() => cleanup());

describe("IntentChips", () => {
  it("renders all four chips", () => {
    render(<IntentChips activeChip={null} onChipSelect={vi.fn()} />);
    for (const chip of INTENT_CHIPS) {
      expect(screen.getByText(chip.label)).toBeInTheDocument();
    }
  });

  it("renders the wrapping group with correct aria-label", () => {
    render(<IntentChips activeChip={null} onChipSelect={vi.fn()} />);
    expect(
      screen.getByRole("group", { name: "Quick intent selection" })
    ).toBeInTheDocument();
  });

  it("sets aria-pressed=false on inactive chips", () => {
    render(<IntentChips activeChip={null} onChipSelect={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("sets aria-pressed=true only on the active chip", () => {
    render(<IntentChips activeChip="Transport" onChipSelect={vi.fn()} />);
    const transportBtn = screen.getByRole("button", { name: /Transport/i });
    expect(transportBtn).toHaveAttribute("aria-pressed", "true");

    // All others remain false
    const otherButtons = screen
      .getAllByRole("button")
      .filter((b) => !b.textContent?.includes("Transport"));
    for (const btn of otherButtons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("calls onChipSelect with the correct ChipConfig when a chip is clicked", () => {
    const handler = vi.fn();
    render(<IntentChips activeChip={null} onChipSelect={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /Directions/i }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Directions", mode: "wayfinding" })
    );
  });

  it("calls onChipSelect with Sustainability chip config", () => {
    const handler = vi.fn();
    render(<IntentChips activeChip={null} onChipSelect={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /Sustainability/i }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Sustainability", mode: "sustainability" })
    );
  });

  it("each chip button carries a title (description) attribute", () => {
    render(<IntentChips activeChip={null} onChipSelect={vi.fn()} />);
    for (const chip of INTENT_CHIPS) {
      expect(screen.getByTitle(chip.description)).toBeInTheDocument();
    }
  });

  it("clicking the same chip again calls onChipSelect again", () => {
    const handler = vi.fn();
    render(<IntentChips activeChip="Directions" onChipSelect={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /Directions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Directions/i }));

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
