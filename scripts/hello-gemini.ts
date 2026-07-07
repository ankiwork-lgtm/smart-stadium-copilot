/**
 * Phase 0 — Task 0.3
 * Throwaway hello-world script to confirm:
 *   - GEMINI_API_KEY is loaded correctly
 *   - gemini-2.5-flash responds end-to-end
 *
 * Run ONCE from the project root:
 *   npx tsx scripts/hello-gemini.ts
 *
 * Delete or keep as a smoke-test — it is NOT used by the app itself.
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌  GEMINI_API_KEY is not set. Add it to .env.local and re-run.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function main() {
  console.log("🔗  Connecting to Gemini 2.5 Flash…");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Say 'Smart Stadium Companion is ready!' and nothing else.",
  });

  const text = response.text;
  console.log("\n✅  Gemini response:", text);
  console.log("\nPhase 0 checkpoint PASSED — Gemini API round trip confirmed.");
}

main().catch((err) => {
  console.error("❌  Gemini call failed:", err.message ?? err);
  process.exit(1);
});
