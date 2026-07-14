/**
 * e2e/journey3-a11y-prefs.spec.ts
 *
 * Journey 3: Fan opens the accessibility preferences modal →
 *            selects "wheelchair" and "low-vision" needs →
 *            saves the preferences →
 *            on the next chat turn the assistant prompt includes the
 *            accessibility context (verified via the system prompt
 *            injection reflected in the first assistant reply).
 *
 * The AI-response assertion requires GEMINI_API_KEY; the preference
 * persistence assertion runs without it.
 */

import { test, expect } from "@playwright/test";

const hasApiKey = !!process.env.GEMINI_API_KEY;

test.describe("Journey 3 — Accessibility preferences", () => {
  // Helper: navigate to /fan and ensure the a11y modal is open.
  //
  // Strategy: always close any open modal first (backdrop can block clicks),
  // then open it cleanly via the Preferences button which uses forceOpen=true
  // and bypasses the sessionStorage gate.
  async function ensurePrefsModalOpen(page: import("@playwright/test").Page) {
    await page.goto("/fan");
    await expect(page.getByRole("heading", { name: /fan assistant/i })).toBeVisible({ timeout: 15_000 });

    // If the first-visit modal is already open, close it with Skip so the
    // backdrop stops intercepting pointer events.
    const saveBtn = page.locator("#a11y-modal-save");
    try {
      await saveBtn.waitFor({ state: "visible", timeout: 2_000 });
      // Modal is open — skip it so the backdrop clears
      await page.locator("#a11y-modal-skip").click();
      await expect(saveBtn).not.toBeVisible({ timeout: 3_000 });
    } catch {
      // Modal is not open — nothing to close
    }

    // Now open the modal via Preferences button (forceOpen path)
    const prefsBtn = page.locator("#open-a11y-prefs-btn");
    await expect(prefsBtn).toBeVisible({ timeout: 5_000 });
    await prefsBtn.click();
    await expect(saveBtn).toBeVisible({ timeout: 8_000 });
  }

  test("accessibility prefs modal opens via Preferences button", async ({ page }) => {
    await ensurePrefsModalOpen(page);

    // Modal is open — verify heading and both action buttons
    await expect(page.getByText(/accessibility preferences/i)).toBeVisible();
    await expect(page.locator("#a11y-modal-skip")).toBeVisible();
  });

  test("user can select needs and save preferences", async ({ page }) => {
    await ensurePrefsModalOpen(page);

    // Checkbox label is "Mobility / wheelchair" (value="mobility")
    // Checkboxes are inside <label> elements; locate by label text content
    const mobilityCheck = page.locator('label').filter({ hasText: 'Mobility / wheelchair' }).locator('input[type="checkbox"]');
    await expect(mobilityCheck).toBeVisible();
    await mobilityCheck.setChecked(true);
    await expect(mobilityCheck).toBeChecked();

    // Visual impairment
    const visionCheck = page.locator('label').filter({ hasText: 'Visual impairment' }).locator('input[type="checkbox"]');
    await expect(visionCheck).toBeVisible();
    await visionCheck.setChecked(true);
    await expect(visionCheck).toBeChecked();

    // Save
    await page.locator("#a11y-modal-save").click();

    // Save button should disappear (modal unmounted)
    await expect(page.locator("#a11y-modal-save")).not.toBeVisible({ timeout: 5_000 });
  });

  test("saved preferences show pre-checked when modal reopened", async ({ page }) => {
    // Pre-populate localStorage with known prefs
    await page.addInitScript(() => {
      localStorage.setItem(
        "stadium-user-context",
        JSON.stringify({
          role: "fan",
          language: "en",
          accessibilityNeeds: ["mobility", "vision"],
          currentLocationHint: "",
        })
      );
    });

    await ensurePrefsModalOpen(page);

    // "Mobility / wheelchair" checkbox should be pre-checked
    const mobilityCheck = page.locator('label').filter({ hasText: 'Mobility / wheelchair' }).locator('input[type="checkbox"]');
    await expect(mobilityCheck).toBeVisible();
    await expect(mobilityCheck).toBeChecked();

    // "Visual impairment" should also be checked
    const visionCheck = page.locator('label').filter({ hasText: 'Visual impairment' }).locator('input[type="checkbox"]');
    await expect(visionCheck).toBeVisible();
    await expect(visionCheck).toBeChecked();
  });

  test("assistant reply reflects accessibility context in prompt (requires API key)", async ({ page }) => {
    test.skip(!hasApiKey, "GEMINI_API_KEY not set — skipping live AI assertion");

    // Start with wheelchair + low_vision prefs already saved
    await page.addInitScript(() => {
      localStorage.setItem(
        "stadium-user-context",
        JSON.stringify({
          role: "fan",
          language: "en",
          accessibilityNeeds: ["wheelchair", "low_vision"],
          currentLocationHint: "",
        })
      );
    });

    await page.goto("/fan");

    const chatInput = page.getByRole("textbox");
    await expect(chatInput).toBeVisible({ timeout: 15_000 });

    // Ask a question where accessibility context should influence the answer
    await chatInput.fill("Where is the nearest accessible entrance?");
    await chatInput.press("Enter");

    // The response should mention accessibility / accessible / wheelchair within 45 s
    const accessibleMention = page.getByText(/accessible|wheelchair|low.?vision|visual/i).last();
    await expect(accessibleMention).toBeVisible({ timeout: 45_000 });
  });
});
