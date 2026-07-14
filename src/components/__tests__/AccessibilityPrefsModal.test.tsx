// @vitest-environment jsdom
/**
 * src/components/__tests__/AccessibilityPrefsModal.test.tsx
 *
 * Unit tests for AccessibilityPrefsModal component.
 * Covers:
 *   - Modal is hidden until opened (first visit or forceOpen)
 *   - forceOpen shows the modal immediately
 *   - Accessibility need checkboxes are toggled correctly
 *   - Save / Skip close the modal
 *   - onClose callback is called
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessibilityPrefsModal } from "../AccessibilityPrefsModal";
import { renderWithContext } from "./test-utils";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe("AccessibilityPrefsModal", () => {
  it("does not render modal content when sessionStorage flag is already set", () => {
    sessionStorage.setItem("stadium-a11y-modal-shown", "1");
    renderWithContext(<AccessibilityPrefsModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the modal on first visit (no sessionStorage flag)", async () => {
    renderWithContext(<AccessibilityPrefsModal />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Accessibility Preferences/i)
    ).toBeInTheDocument();
  });

  it("renders modal immediately when forceOpen=true regardless of sessionStorage", () => {
    sessionStorage.setItem("stadium-a11y-modal-shown", "1");
    renderWithContext(<AccessibilityPrefsModal forceOpen />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders all four accessibility need checkboxes inside the dialog", async () => {
    renderWithContext(<AccessibilityPrefsModal forceOpen />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Mobility \/ wheelchair/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Visual impairment/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Hearing impairment/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Sensory processing/i)).toBeInTheDocument();
  });

  it("toggles a need checkbox on and off", async () => {
    const user = userEvent.setup();
    renderWithContext(<AccessibilityPrefsModal forceOpen />);
    const dialog = screen.getByRole("dialog");
    // find the first checkbox (Mobility)
    const checkboxes = within(dialog).getAllByRole("checkbox");
    const mobilityCheckbox = checkboxes[0];
    expect(mobilityCheckbox).not.toBeChecked();

    await user.click(mobilityCheckbox);
    expect(mobilityCheckbox).toBeChecked();

    await user.click(mobilityCheckbox);
    expect(mobilityCheckbox).not.toBeChecked();
  });

  it("closes modal when Skip is clicked", async () => {
    const user = userEvent.setup();
    renderWithContext(<AccessibilityPrefsModal forceOpen />);

    await user.click(screen.getByRole("button", { name: /Skip for now/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls onClose when Skip is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    renderWithContext(
      <AccessibilityPrefsModal forceOpen onClose={handleClose} />
    );

    await user.click(screen.getByRole("button", { name: /Skip for now/i }));
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledOnce();
    });
  });

  it("calls onClose when Save is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    renderWithContext(
      <AccessibilityPrefsModal forceOpen onClose={handleClose} />
    );

    await user.click(screen.getByRole("button", { name: /Save preferences/i }));
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledOnce();
    });
  });

  it("closes modal when Save is clicked", async () => {
    const user = userEvent.setup();
    renderWithContext(<AccessibilityPrefsModal forceOpen />);

    await user.click(screen.getByRole("button", { name: /Save preferences/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders a location hint input field inside the dialog", () => {
    renderWithContext(<AccessibilityPrefsModal forceOpen />);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByLabelText(/Your current location/i)
    ).toBeInTheDocument();
  });

  it("accepts text in the location hint input", async () => {
    const user = userEvent.setup();
    renderWithContext(<AccessibilityPrefsModal forceOpen />);
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText(/Your current location/i);
    await user.type(input, "Near Gate A");
    expect(input).toHaveValue("Near Gate A");
  });
});
