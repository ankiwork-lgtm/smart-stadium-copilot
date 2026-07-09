/**
 * app/api/warmup/route.ts
 * GET /api/warmup
 *
 * Pre-warms the Gemini connection so the first real assistant call isn't slow.
 * Called once on app mount (see src/components/AppShell.tsx).
 *
 * The request is a minimal single-token prompt; the response is discarded.
 * If Gemini is unavailable, we return 200 anyway — this is a best-effort warm-up,
 * not a required path (never shown to the user).
 *
 * Design.md §10 / Task 7.4 [SHOULD]
 */

import { NextResponse } from "next/server";
import { askAssistant } from "../../../lib/gemini";

export async function GET(): Promise<NextResponse> {
  try {
    // Minimal warm-up: tiny prompt, no venue data, discarded result
    await askAssistant({
      userMessage: "ping",
      userContext: { role: "fan", language: "en" },
      mode: "wayfinding",
    });
  } catch {
    // Intentionally swallowed — warmup failures are non-fatal
  }
  // Always return 200 so the client never shows an error
  return NextResponse.json({ ok: true });
}
