/**
 * app/api/assistant/route.ts
 * POST /api/assistant
 *
 * Thin wrapper around lib/gemini.ts askAssistantStream().
 * Accepts a JSON body, validates it, injects live state + venue data, and
 * streams the Gemini response token-by-token back to the client.
 *
 * Request body (AssistantRequest):
 *   { userMessage, userContext, mode, liveState? }
 *
 * Response:
 *   text/plain; charset=utf-8  — streamed token chunks
 *   OR 400 JSON on validation failure
 *   OR 500 JSON on unexpected server error
 *
 * Task 3.1 [MUST]
 */

import { NextRequest, NextResponse } from "next/server";
import { askAssistantStream } from "../../../lib/gemini";
import { getState } from "../../../lib/simEngine";
import venueJson from "../../../data/venue.json";
import type { AssistantMode, UserContext, VenueData } from "../../../lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MODES: AssistantMode[] = [
  "wayfinding",
  "ops_alert",
  "briefing",
  "transport",
  "translation",
];

const VALID_ROLES = ["fan", "ops_staff", "volunteer"] as const;
const VALID_LANGUAGES = ["en", "es", "fr"] as const;

const venue = venueJson as VenueData;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  // --- 1. Parse body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // --- 2. Validate required fields ---
  const { userMessage, userContext, mode } = raw;

  if (typeof userMessage !== "string" || userMessage.trim() === "") {
    return NextResponse.json(
      { error: "userMessage must be a non-empty string." },
      { status: 400 }
    );
  }

  if (!VALID_MODES.includes(mode as AssistantMode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (typeof userContext !== "object" || userContext === null) {
    return NextResponse.json(
      { error: "userContext must be an object." },
      { status: 400 }
    );
  }

  const ctx = userContext as Record<string, unknown>;

  if (!VALID_ROLES.includes(ctx.role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json(
      { error: `userContext.role must be one of: ${VALID_ROLES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (!VALID_LANGUAGES.includes(ctx.language as (typeof VALID_LANGUAGES)[number])) {
    return NextResponse.json(
      { error: `userContext.language must be one of: ${VALID_LANGUAGES.join(", ")}.` },
      { status: 400 }
    );
  }

  const validatedContext: UserContext = {
    role: ctx.role as UserContext["role"],
    language: ctx.language as UserContext["language"],
    accessibilityNeeds: Array.isArray(ctx.accessibilityNeeds)
      ? (ctx.accessibilityNeeds as UserContext["accessibilityNeeds"])
      : undefined,
    currentLocationHint:
      typeof ctx.currentLocationHint === "string"
        ? ctx.currentLocationHint
        : undefined,
  };

  // --- 3. Build stream via Gemini ---
  // Always inject the current live state so the assistant can reference it
  const liveState = getState();

  const stream = askAssistantStream({
    userMessage: userMessage.trim(),
    userContext: validatedContext,
    mode: mode as AssistantMode,
    liveState,
    venueData: venue,
  });

  // --- 4. Convert AsyncGenerator → ReadableStream ---
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } catch (err) {
        console.error("[api/assistant] stream error:", err);
        controller.enqueue(
          new TextEncoder().encode(
            "I'm having trouble reaching the assistant right now. Please try again."
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      // Allows the browser to start rendering streamed text immediately
      "Cache-Control": "no-cache, no-store",
      "Transfer-Encoding": "chunked",
    },
  });
}
