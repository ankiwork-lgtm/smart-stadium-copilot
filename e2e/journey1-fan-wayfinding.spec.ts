/**
 * e2e/journey1-fan-wayfinding.spec.ts
 *
 * Journey 1: Fan asks a wayfinding question → receives a chat response →
 *            the VenueMap highlights the relevant location pin.
 *
 * Strategy: the chat is backed by a live Gemini API call which can be slow
 * and non-deterministic. We therefore send a question that reliably produces
 * a response containing an identifiable venue keyword ("Gate A" / "gate-a"),
 * and then assert that the map highlight annotation appears — using a generous
 * 45-second timeout to accommodate streaming latency.
 *
 * Skipped automatically when GEMINI_API_KEY is absent (CI without secrets).
 */

import { test, expect } from "@playwright/test";

const hasApiKey = !!process.env.GEMINI_API_KEY;

test.describe("Journey 1 — Fan wayfinding", () => {
  test.skip(!hasApiKey, "GEMINI_API_KEY not set — skipping live AI call");

  test("fan submits wayfinding question and map highlights a location", async ({ page }) => {
    await page.goto("/fan");

    // Wait for the chat input to be ready
    const chatInput = page.getByRole("textbox", { name: /ask.*stadium|message|chat/i });
    await expect(chatInput).toBeVisible({ timeout: 15_000 });

    // Activate the Wayfinding intent chip if present
    const wayfindingChip = page.getByRole("button", { name: /wayfinding/i });
    if (await wayfindingChip.isVisible()) {
      await wayfindingChip.click();
    }

    // Type a question that predictably references Gate A
    await chatInput.fill("How do I get to Gate A from the south entrance?");
    await chatInput.press("Enter");

    // An assistant message should appear (streaming or complete)
    const assistantMessage = page.locator("[data-testid='assistant-message'], [aria-label*='assistant'], .chat-message--assistant").first();
    // Fallback: any response text containing gate-related content
    const anyResponse = page.getByText(/gate/i);
    await expect(anyResponse.first()).toBeVisible({ timeout: 45_000 });

    // The venue map highlight annotation should appear once a gate is mentioned
    // The fan page shows: "X location(s) highlighted from the assistant's response"
    const highlightNotice = page.getByText(/location.*highlighted|highlighted.*location/i);
    await expect(highlightNotice).toBeVisible({ timeout: 50_000 });
  });
});

test.describe("Journey 1 — Fan wayfinding (offline / mock)", () => {
  test("fan page loads with intent chips and chat input ready", async ({ page }) => {
    await page.goto("/fan");

    // Page title / heading visible
    await expect(page.getByRole("heading", { name: /fan assistant/i })).toBeVisible();

    // Dismiss any auto-opened accessibility modal so it doesn't block assertions
    const skipBtn = page.locator("#a11y-modal-skip");
    try {
      await skipBtn.waitFor({ state: "visible", timeout: 2_000 });
      await skipBtn.click();
      await expect(skipBtn).not.toBeVisible({ timeout: 3_000 });
    } catch {
      // Modal is not open — nothing to dismiss
    }

    // Intent chips render — chip labels are: Directions, Transport, Accessibility, Sustainability
    const chips = page.getByRole("button", { name: /directions|transport|accessibility|sustainability/i });
    await expect(chips.first()).toBeVisible();

    // Chat input is present and enabled
    const chatInput = page.getByRole("textbox");
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();
  });

  test("selecting an intent chip updates the active mode indicator", async ({ page }) => {
    await page.goto("/fan");

    // Dismiss any auto-opened accessibility modal (first-visit) so it
    // doesn't intercept pointer events for the chip click.
    const skipBtn = page.locator("#a11y-modal-skip");
    try {
      await skipBtn.waitFor({ state: "visible", timeout: 2_000 });
      await skipBtn.click();
      await expect(skipBtn).not.toBeVisible({ timeout: 3_000 });
    } catch {
      // Modal is not open — nothing to dismiss
    }

    // Chip labels: "Directions" (mode=wayfinding), "Transport", "Accessibility", "Sustainability"
    const directionsChip = page.locator("#chip-directions");
    await expect(directionsChip).toBeVisible({ timeout: 10_000 });
    await directionsChip.click();

    // The mode badge uses aria-label="Current mode: wayfinding"
    const modeBadge = page.getByLabel(/current mode: wayfinding/i);
    await expect(modeBadge).toBeVisible({ timeout: 5_000 });
  });
});
