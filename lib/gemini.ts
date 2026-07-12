/**
 * lib/gemini.ts
 * Single shared reasoning-layer wrapper for the Smart Stadium Companion.
 *
 * Design principles (design.md §4):
 *  - One function (askAssistant) reused by every API route — never called client-side.
 *  - Grounding via system-prompt injection; the model NEVER invents facilities.
 *  - Streaming for chat modes; full-text + JSON.parse for structured output modes.
 *  - Typed failure response so the UI can show a friendly message, not a crash (NFR2).
 *
 * Modes implemented:
 *  "wayfinding"     — fan navigation, accessibility-aware           (tasks 2.1–2.3)
 *  "transport"      — transit status, leave-by times               (task 2.7)
 *  "ops_alert"      — structured JSON alert for ops dashboard       (task 2.6)
 *  "briefing"       — structured JSON shift summary for ops         (task 2.6)
 *  "translation"    — two-way bilingual rendering for volunteers    (task 2.8)
 *  "sustainability" — recycling, water refill, green tips           (task 6.3)
 */

import { GoogleGenAI } from "@google/genai";
import type {
  AssistantMode,
  AssistantResponse,
  LiveState,
  UserContext,
  VenueData,
} from "./types";

// ---------------------------------------------------------------------------
// Client singleton — one instance per server process
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AskAssistantParams = {
  userMessage: string;
  userContext: UserContext;
  mode: AssistantMode;
  liveState?: LiveState;
  venueData?: VenueData;
};

/** Structured output shape expected for ops_alert / briefing modes. */
export type StructuredOpsOutput = {
  summary: string;
  recommendedAction: string;
  priority: "low" | "medium" | "high";
};

// ---------------------------------------------------------------------------
// Main public function — non-streaming (full response)
// ---------------------------------------------------------------------------

/**
 * Calls Gemini 2.5 Flash with grounded context and returns the full response text.
 * For ops_alert and briefing modes, also attempts to parse strict JSON.
 *
 * Use askAssistantStream() for chat-mode streaming.
 */
export async function askAssistant(
  params: AskAssistantParams
): Promise<AssistantResponse> {
  try {
    const client = getClient();
    const { systemPrompt, userTurn } = buildPrompt(params);

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userTurn }] }],
      config: { systemInstruction: systemPrompt },
    });

    const text = response.text ?? "";
    return { success: true, text };
  } catch (err) {
    console.error("[gemini] askAssistant error:", err);
    return {
      success: false,
      error: true,
      fallbackMessage: buildFallbackMessage(params.mode),
    };
  }
}

// ---------------------------------------------------------------------------
// Streaming variant — yields text chunks via AsyncIterable
// ---------------------------------------------------------------------------

/**
 * Calls Gemini 2.5 Flash with streaming and yields raw text chunks.
 * Consumers pipe this into a Next.js streamed Response (see /api/assistant).
 *
 * On failure, yields a single fallback message chunk so the stream never hangs.
 */
export async function* askAssistantStream(
  params: AskAssistantParams
): AsyncGenerator<string> {
  try {
    const client = getClient();
    const { systemPrompt, userTurn } = buildPrompt(params);

    const stream = await client.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userTurn }] }],
      config: { systemInstruction: systemPrompt },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (err) {
    console.error("[gemini] askAssistantStream error:", err);
    yield buildFallbackMessage(params.mode);
  }
}

// ---------------------------------------------------------------------------
// Structured output helper (ops_alert / briefing)
// ---------------------------------------------------------------------------

/**
 * Calls askAssistant and attempts to parse the response as StructuredOpsOutput JSON.
 * On parse failure, falls back to raw text wrapped in a StructuredOpsOutput shape.
 * Design.md §4: "safe fallback to raw text on parse failure"
 */
export async function askAssistantStructured(
  params: AskAssistantParams
): Promise<StructuredOpsOutput | { rawText: string; parseError: true }> {
  const result = await askAssistant(params);

  if (!result.success) {
    return {
      rawText: result.fallbackMessage,
      parseError: true,
    };
  }

  // Strip any markdown code fences the model may add
  const cleaned = result.text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/im, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as StructuredOpsOutput;
    // Basic shape validation
    if (
      typeof parsed.summary === "string" &&
      typeof parsed.recommendedAction === "string" &&
      ["low", "medium", "high"].includes(parsed.priority)
    ) {
      return parsed;
    }
    throw new Error("Shape mismatch");
  } catch (parseErr) {
    console.warn("[gemini] JSON parse failed, using raw text fallback:", parseErr);
    return { rawText: result.text, parseError: true };
  }
}

// ---------------------------------------------------------------------------
// Prompt builder — §8 template with slot substitution
// ---------------------------------------------------------------------------

type BuiltPrompt = { systemPrompt: string; userTurn: string };

function buildPrompt(params: AskAssistantParams): BuiltPrompt {
  const { userMessage, userContext, mode, liveState, venueData } = params;

  const audienceLabel =
    userContext.role === "fan"
      ? "stadium fans"
      : userContext.role === "volunteer"
      ? "staff volunteers"
      : "operations staff";

  const venueSection = venueData
    ? buildVenueSection(venueData, mode)
    : "No venue data provided.";

  const liveSection = liveState
    ? buildLiveStateSection(liveState, mode)
    : "No live data available for this session.";

  const accessibilityClause =
    userContext.accessibilityNeeds && userContext.accessibilityNeeds.length > 0
      ? `Accessibility needs: ${userContext.accessibilityNeeds.join(", ")}. Always prioritise accessible routes and facilities.`
      : "No specific accessibility needs declared.";

  const modeInstruction = buildModeInstruction(mode, userContext.language);

  // Build exhaustive name list for hard grounding enforcement
  const knownNames = venueData
    ? [
        ...venueData.gates.map((g) => `${g.name} (${g.label})`),
        ...venueData.facilities.map((f) => f.name),
        ...(venueData.transitOptions?.map((t) => t.line ?? t.mode) ?? []),
        ...(venueData.sustainabilityPoints?.map((s) => s.name) ?? []),
      ].join(", ")
    : "none provided";

  const systemPrompt = `You are Stadium Copilot, an AI assistant for ${audienceLabel} at a simulated FIFA World Cup 2026 venue.

CONTEXT (venue knowledge — treat as ground truth, do not invent beyond this):
${venueSection}

CURRENT LIVE CONDITIONS (simulated for this demo):
${liveSection}

USER CONTEXT:
- Role: ${userContext.role}
- Language: ${languageLabel(userContext.language)}
- ${accessibilityClause}

STRICT GROUNDING RULES:
1. Only reference gates, facilities, transit options, and sustainability points that appear in the venue data above.
2. COMPLETE LIST of known entities at this venue: ${knownNames}. If the user asks about ANYTHING not on this list (e.g. "Gate F", "VIP lounge", "spa", "Team Entrance"), respond with: "I'm sorry, I don't have information about that facility or location in this venue's data." Never guess, never invent, never apologise and then describe it anyway.
3. Never fabricate crowd figures, transit times, or incident details not present in the live conditions above.
4. If you are genuinely unsure whether something exists, err on the side of "I don't have that information" rather than inventing a plausible-sounding answer.

${modeInstruction}`;

  return { systemPrompt, userTurn: userMessage };
}

// ---------------------------------------------------------------------------
// Venue data serialiser — injects only what each mode needs (token efficiency)
// ---------------------------------------------------------------------------

function buildVenueSection(venue: VenueData, mode: AssistantMode): string {
  const parts: string[] = [`Venue: ${venue.venueName}, ${venue.city} — ${venue.event}`];

  // All modes get gates (they are always referenced for location context)
  parts.push(
    "GATES:\n" +
      venue.gates
        .map(
          (g) =>
            `- ${g.name} (${g.label}, Zone: ${g.zone}, Accessible: ${g.accessible ? "Yes" : "No"}): ${g.description}`
        )
        .join("\n")
  );

  if (mode === "wayfinding" || mode === "translation" || mode === "sustainability") {
    parts.push(
      "FACILITIES:\n" +
        venue.facilities
          .map(
            (f) =>
              `- [${f.id}] ${f.name} (Type: ${f.type}, Accessible: ${f.accessible ? "Yes" : "No"}, Near: ${f.nearGate}, Zone: ${f.zone}): ${f.description}`
          )
          .join("\n")
    );
    parts.push(
      "SUSTAINABILITY POINTS:\n" +
        venue.sustainabilityPoints
          .map((s) => `- [${s.id}] ${s.name} (Type: ${s.type}, Near: ${s.nearGate}, Zone: ${s.zone}): ${s.description}`)
          .join("\n")
    );
  }

  if (mode === "transport" || mode === "translation") {
    parts.push(
      "TRANSIT OPTIONS:\n" +
        venue.transitOptions
          .map(
            (t) =>
              `- [${t.id}] ${t.line ?? t.mode} (${t.mode}): Stop/Zone: ${t.stop ?? t.pickupZone ?? "N/A"}, Near: ${t.nearGate}` +
              (t.frequency ? `, Frequency: ${t.frequency}` : "") +
              (t.travelTimeToCenter ? `, Travel time: ${t.travelTimeToCenter}` : "") +
              (t.firstService ? `, First: ${t.firstService}` : "") +
              (t.lastService ? `, Last: ${t.lastService}` : "") +
              (t.note ? `\n  Note: ${t.note}` : "")
          )
          .join("\n")
    );
  }

  if (mode === "ops_alert" || mode === "briefing") {
    // Ops needs the full picture
    parts.push(
      "FACILITIES (summary):\n" +
        venue.facilities
          .map((f) => `- ${f.name} (${f.type}, Zone: ${f.zone}, Near: ${f.nearGate})`)
          .join("\n")
    );
    parts.push(
      "TRANSIT OPTIONS:\n" +
        venue.transitOptions
          .map((t) => `- ${t.line ?? t.mode} near ${t.nearGate}`)
          .join("\n")
    );
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Live state serialiser
// ---------------------------------------------------------------------------

function buildLiveStateSection(state: LiveState, mode: AssistantMode): string {
  const parts: string[] = [
    `Snapshot time: ${state.timestamp}`,
    `Weather: ${state.weather.condition}, ${state.weather.tempC}°C`,
  ];

  // Crowd density — relevant for wayfinding (route avoidance) and ops
  if (mode !== "translation") {
    const crowdLines = Object.entries(state.crowdDensity)
      .map(([gateId, level]) => `  ${gateId}: ${level}`)
      .join("\n");
    parts.push(`Crowd density by gate:\n${crowdLines}`);
  }

  // Transit status — relevant for transport and briefing
  if (mode === "transport" || mode === "briefing" || mode === "ops_alert") {
    const transitLines = Object.entries(state.transitStatus)
      .map(
        ([id, s]) =>
          `  ${id}: ${s.status}${s.note ? ` — ${s.note}` : ""}`
      )
      .join("\n");
    parts.push(`Transit status:\n${transitLines}`);
  }

  // Active (unresolved) incidents — relevant for ops + wayfinding (avoid areas)
  const activeIncidents = state.incidents.filter((i) => !i.resolved);
  if (activeIncidents.length > 0) {
    parts.push(
      "Active incidents:\n" +
        activeIncidents
          .map((i) => `  [${i.type.toUpperCase()}] Zone ${i.zone}: ${i.description}`)
          .join("\n")
    );
  } else {
    parts.push("Active incidents: None");
  }

  // Event log — only for briefing mode
  if (mode === "briefing" && state.eventLog.length > 0) {
    const recent = state.eventLog.slice(-10);
    parts.push(
      "Recent event log (last 10 entries):\n" +
        recent
          .map((e) => `  [${e.type.toUpperCase()}] ${e.timestamp}: ${e.text}`)
          .join("\n")
    );
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Mode-specific instruction blocks
// ---------------------------------------------------------------------------

function buildModeInstruction(mode: AssistantMode, language: string): string {
  const lang = languageLabel(language);

  switch (mode) {
    case "wayfinding":
      return `INSTRUCTIONS (wayfinding mode):
- Respond in ${lang}.
- Give clear, step-by-step directions using gate names, zones, and facility names from the data.
- If the user has accessibility needs, recommend only accessible routes and facilities.
- If crowd density at the nearest gate is "high" or "critical", suggest an alternative lower-density route.
- Mention relevant sustainability points (recycling, water refill) when naturally relevant.
- Keep the response friendly, concise, and actionable — no more than 3–4 sentences.`;

    case "transport":
      return `INSTRUCTIONS (transport mode):
- Respond in ${lang}.
- Use only the transit options listed in the data. Do not invent routes, stop names, or travel times not in the data.
- Always proactively state the current status of relevant transit services from the live conditions (on_time or delayed, with the delay note if any).
- Always include a "leave-by" recommendation: assume the match ends at a typical 90-minute full-time plus stoppage (~95 min). Compute: leave-by = match end − travel time to destination − 30 min post-match crowd buffer. State the leave-by time clearly (e.g. "Leave by approximately 10:45 PM to avoid the post-match rush").
- If any transit service is delayed, say so prominently at the top and suggest the best alternative from the data.
- List the key transit options (train, bus, rideshare) that are relevant, with their gate proximity.
- Keep the response concise and practical — max 5–6 sentences.`;

    case "sustainability":
      return `INSTRUCTIONS (sustainability mode):
- Respond in ${lang}.
- Your goal is to help the user make eco-friendly choices at the venue.
- Always surface the nearest recycling station and water refill point from the sustainability points data — include the name, zone, and nearest gate even if the user didn't ask explicitly.
- Mention the FIFA 2026 Zero-Waste initiative context where relevant.
- If the user asks a general question, list all sustainability points and their locations briefly.
- Keep the response friendly, practical, and encouraging — max 4–5 sentences.`;

    case "ops_alert":
      return `INSTRUCTIONS (ops_alert mode):
- You are briefing an operations staff member, not a fan.
- Analyse the live conditions and the user's question. Identify any threshold breaches or emerging risks.
- Return ONLY valid JSON in this exact shape — no markdown, no prose outside the JSON:
{
  "summary": "<one-sentence description of the situation>",
  "recommendedAction": "<specific, actionable step for ops staff>",
  "priority": "low" | "medium" | "high"
}
- Use "high" priority if any gate is "critical" or a security/medical incident is active.
- Use "medium" if crowd density is "high" or transit is delayed.
- Use "low" for informational alerts.`;

    case "briefing":
      return `INSTRUCTIONS (briefing mode):
- You are generating a shift briefing summary for the incoming operations team.
- Synthesize the event log and current live conditions into a structured report.
- Return ONLY valid JSON in this exact shape — no markdown, no prose outside the JSON:
{
  "summary": "<2–3 sentence overview of what happened this shift>",
  "recommendedAction": "<top priority action for the incoming team>",
  "priority": "low" | "medium" | "high"
}
- Be factual and specific. Reference actual gate IDs, incident types, and transit issues from the data.`;

    case "translation": // falls through from sustainability above
      return `INSTRUCTIONS (translation / volunteer-assist mode):
- The user message may be in any language.
- Detect the source language and provide a response in BOTH ${lang} AND English, clearly labelled.
- Format:
  [${lang}]: <response in ${lang}>
  [English]: <response in English>
- Use only venue data provided. Do not invent any locations or services.
- Keep both versions concise and clear.`;

    default:
      return `INSTRUCTIONS: Respond helpfully in ${lang} using only the venue data provided.`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function languageLabel(code: string): string {
  const map: Record<string, string> = {
    en: "English",
    es: "Spanish (Español)",
    fr: "French (Français)",
  };
  return map[code] ?? "English";
}

function buildFallbackMessage(mode: AssistantMode): string {
  if (mode === "sustainability") {
    // Generic message — venue-specific locations are not hardcoded here to
    // avoid serving stale data if venue.json is updated.
    return "I'm having trouble reaching the assistant right now. For recycling stations and water refill points, please check the venue map or ask a staff member at any gate.";
  }
  if (mode === "ops_alert" || mode === "briefing") {
    // Return a valid JSON fallback so structured callers don't break
    return JSON.stringify({
      summary: "Assistant temporarily unavailable.",
      recommendedAction: "Please retry in a few seconds or check Gemini API status.",
      priority: "low",
    });
  }
  return "I'm having trouble reaching the assistant right now. Please try again in a few seconds.";
}
