/**
 * app/api/briefing/route.ts
 * POST /api/briefing
 *
 * Generates a structured ops shift-briefing by calling
 * askAssistantStructured(mode: "briefing") with the current event log
 * injected via liveState.
 *
 * No request body required (briefing is always scoped to current state).
 * An optional { language } body field is accepted (defaults to "en").
 *
 * Response: application/json
 * {
 *   summary:           string,
 *   recommendedAction: string,
 *   priority:          "low"|"medium"|"high",
 *   generatedAt:       string,  // ISO 8601
 *   rawText?:          string,  // present only if JSON parse failed
 *   parseError?:       true,
 * }
 *
 * Task 3.5 [SHOULD]
 */

import { NextRequest, NextResponse } from "next/server";
import { getState } from "../../../lib/simEngine";
import { askAssistantStructured } from "../../../lib/gemini";
import venueJson from "../../../data/venue.json";
import type { VenueData } from "../../../lib/types";

const venue = venueJson as VenueData;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Optional language override in the body
  let language: "en" | "es" | "fr" = "en";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.language === "es" || body?.language === "fr") {
      language = body.language;
    }
  } catch {
    // ignore — language defaults to "en"
  }

  try {
    const state = getState();

    const result = await askAssistantStructured({
      userMessage:
        "Generate a shift briefing for the incoming operations team based on the event log and current live conditions.",
      userContext: { role: "ops_staff", language },
      mode: "briefing",
      liveState: state,
      venueData: venue,
    });

    const generatedAt = new Date().toISOString();

    if ("parseError" in result) {
      return NextResponse.json({
        summary: result.rawText,
        recommendedAction: "Review full log for details.",
        priority: "low" as const,
        generatedAt,
        rawText: result.rawText,
        parseError: true,
      });
    }

    return NextResponse.json({ ...result, generatedAt });
  } catch (err) {
    console.error("[api/briefing] error:", err);
    return NextResponse.json(
      { error: "Failed to generate shift briefing." },
      { status: 500 }
    );
  }
}
