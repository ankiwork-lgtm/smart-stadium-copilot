// @vitest-environment jsdom
/**
 * src/components/__tests__/ChatPanel.test.tsx
 *
 * Unit tests for ChatPanel component.
 * Covers:
 *   - Welcome message localisation (en / es / fr)
 *   - Volunteer vs fan welcome text
 *   - Placeholder text by mode and language
 *   - Send button disabled when input is empty
 *   - Streaming: user message added, assistant reply shown, error on failure
 */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
import React from "react";
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ChatPanel } from "../ChatPanel";
import { renderWithContext } from "./test-utils";

// jsdom doesn't implement scrollIntoView — stub it out
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Welcome message
// ---------------------------------------------------------------------------

describe("ChatPanel — welcome message localisation", () => {
  it("shows English fan welcome by default", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    expect(
      screen.getByText(/I'm Stadium Copilot/i)
    ).toBeInTheDocument();
  });

  it("shows Spanish fan welcome when language=es", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "es" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Soy Stadium Copilot/i)).toBeInTheDocument();
    });
  });

  it("shows French fan welcome when language=fr", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "fr" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Je suis Stadium Copilot/i)).toBeInTheDocument();
    });
  });

  it("shows English volunteer welcome when role=volunteer", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "volunteer", language: "en" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Volunteer mode active/i)).toBeInTheDocument();
    });
  });

  it("shows Spanish volunteer welcome when language=es + role=volunteer", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "volunteer", language: "es" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Modo voluntario activo/i)).toBeInTheDocument();
    });
  });

  it("shows French volunteer welcome when language=fr + role=volunteer", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "volunteer", language: "fr" },
    });
    await waitFor(() => {
      expect(screen.getByText(/Mode bénévole actif/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Placeholder text
// ---------------------------------------------------------------------------

describe("ChatPanel — placeholder text", () => {
  it("uses Spanish placeholder when language=es", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "es" },
    });
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Escribe tu pregunta/i)
      ).toBeInTheDocument();
    });
  });

  it("uses French placeholder when language=fr", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "fr" },
    });
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Posez votre question/i)
      ).toBeInTheDocument();
    });
  });

  it("uses transport-specific placeholder for mode=transport (en)", async () => {
    renderWithContext(<ChatPanel mode="transport" />, {
      initialContext: { role: "fan", language: "en" },
    });
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/trains, buses/i)
      ).toBeInTheDocument();
    });
  });

  it("uses sustainability placeholder for mode=sustainability (en)", async () => {
    renderWithContext(<ChatPanel mode="sustainability" />, {
      initialContext: { role: "fan", language: "en" },
    });
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/recycling/i)
      ).toBeInTheDocument();
    });
  });

  it("uses wayfinding placeholder for mode=wayfinding (en)", async () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/directions, facilities/i)
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Input area behaviour
// ---------------------------------------------------------------------------

describe("ChatPanel — input / send button", () => {
  it("send button is disabled when input is empty", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    expect(sendBtn).toBeDisabled();
  });

  it("send button becomes enabled when input has text", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });
    const sendBtn = screen.getByRole("button", { name: /Send message/i });

    fireEvent.change(textarea, { target: { value: "Where is Gate A?" } });
    expect(sendBtn).toBeEnabled();
  });

  it("send button is disabled when input is only whitespace", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /Send message/i })).toBeDisabled();
  });

  it("textarea has correct aria-label", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    expect(
      screen.getByRole("textbox", { name: /Type your message/i })
    ).toBeInTheDocument();
  });

  it("message list region has aria-live=polite", () => {
    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const log = document.querySelector('[aria-live="polite"]');
    expect(log).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Streaming / fetch behaviour (with fetch mock)
// ---------------------------------------------------------------------------

describe("ChatPanel — streaming send", () => {
  it("adds user message to the chat on send", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Hello!"));
        controller.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(stream, { status: 200 })
    );

    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });
    fireEvent.change(textarea, { target: { value: "Where is Gate A?" } });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByText("Where is Gate A?")).toBeInTheDocument();
  });

  it("shows assistant reply after streaming completes", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Gate A is in the North Zone."));
        controller.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(stream, { status: 200 })
    );

    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });
    fireEvent.change(textarea, { target: { value: "Where is Gate A?" } });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    expect(
      await screen.findByText("Gate A is in the North Zone.")
    ).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });
    fireEvent.change(textarea, { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    expect(
      await screen.findByText(/trouble reaching the assistant/i)
    ).toBeInTheDocument();
  });

  it("shows error message when fetch returns non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500 })
    );

    renderWithContext(<ChatPanel mode="wayfinding" />, {
      initialContext: { role: "fan", language: "en" },
    });
    const textarea = screen.getByRole("textbox", { name: /Type your message/i });
    fireEvent.change(textarea, { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));

    expect(
      await screen.findByText(/trouble reaching the assistant/i)
    ).toBeInTheDocument();
  });
});
