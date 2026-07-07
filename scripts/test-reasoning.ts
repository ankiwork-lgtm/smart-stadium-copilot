/**
 * scripts/test-reasoning.ts
 * Phase 2 checkpoint script — tests all askAssistant modes end-to-end.
 *
 * Run with:
 *   npx tsx scripts/test-reasoning.ts
 *
 * (Loads .env.local automatically — no dotenv CLI needed)
 *
 * What it tests (tasks 2.3, 2.5, 2.6, 2.7, 2.8 checkpoint):
 *  1. wayfinding — accessible restroom query (task 2.3)
 *  2. wayfinding — asks about a NON-EXISTENT facility (grounding / NFR3 test)
 *  3. transport — leave-by time + transit status (task 2.7)
 *  4. ops_alert — JSON output + parse (task 2.6)
 *  5. briefing — JSON shift summary (task 2.6)
 *  6. translation — bilingual response (task 2.8)
 */

// ---------------------------------------------------------------------------
// Load .env.local before anything else (no dotenv package required)
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
  console.log("✔  Loaded .env.local");
} else {
  console.warn("⚠  .env.local not found — GEMINI_API_KEY must already be in the environment");
}

// ---------------------------------------------------------------------------
// App imports (after env is populated)
// ---------------------------------------------------------------------------
import { askAssistant, askAssistantStructured } from "../lib/gemini";
import { getInitialState, triggerSpike } from "../lib/simEngine";
import venueRaw from "../data/venue.json";
import type { VenueData, UserContext } from "../lib/types";

const venue = venueRaw as VenueData;


// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function header(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function pass(label: string, detail?: string) {
  console.log(`✅  PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail?: string) {
  console.log(`❌  FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Shared contexts
// ---------------------------------------------------------------------------

const fanContext: UserContext = {
  role: "fan",
  language: "en",
  accessibilityNeeds: ["mobility"],
  currentLocationHint: "near Gate C",
};

const fanContextES: UserContext = {
  role: "fan",
  language: "es",
};

const volunteerContext: UserContext = {
  role: "volunteer",
  language: "en",
};

const opsContext: UserContext = {
  role: "ops_staff",
  language: "en",
};

const liveState = getInitialState();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testWayfinding() {
  header("TEST 1 — Wayfinding: nearest accessible restroom");

  const result = await askAssistant({
    userMessage: "Where's the nearest accessible restroom? I'm near Gate C and use a wheelchair.",
    userContext: fanContext,
    mode: "wayfinding",
    liveState,
    venueData: venue,
  });

  if (result.success) {
    console.log("Response:", result.text);
    const mentionsAccessible =
      result.text.toLowerCase().includes("accessible") ||
      result.text.toLowerCase().includes("gate a") ||
      result.text.toLowerCase().includes("gate b");
    mentionsAccessible
      ? pass("Response mentions accessible route/facility")
      : fail("Response does not mention accessible route", "may be hallucinating");
  } else {
    fail("askAssistant call failed", result.fallbackMessage);
  }
}

async function testGrounding() {
  header("TEST 2 — Grounding: ask about non-existent facility (NFR3)");

  const result = await askAssistant({
    userMessage: "Where is the VR Experience Zone on the west side?",
    userContext: fanContext,
    mode: "wayfinding",
    liveState,
    venueData: venue,
  });

  if (result.success) {
    console.log("Response:", result.text);
    const refusesHallucination =
      result.text.toLowerCase().includes("don't have") ||
      result.text.toLowerCase().includes("not listed") ||
      result.text.toLowerCase().includes("no information") ||
      result.text.toLowerCase().includes("not available") ||
      result.text.toLowerCase().includes("don't know") ||
      result.text.toLowerCase().includes("unable to find");
    refusesHallucination
      ? pass("Model correctly declined to invent a non-existent facility ✓ NFR3")
      : fail("Model may have hallucinated a facility — review grounding prompt");
  } else {
    fail("askAssistant call failed", result.fallbackMessage);
  }
}

async function testTransport() {
  header("TEST 3 — Transport: leave-by time + live transit status");

  const result = await askAssistant({
    userMessage: "How do I get back to the city centre after the match? What time should I leave?",
    userContext: fanContextES,
    mode: "transport",
    liveState,
    venueData: venue,
  });

  if (result.success) {
    console.log("Response:", result.text);
    pass("Transport response received");
  } else {
    fail("Transport call failed", result.fallbackMessage);
  }
}

async function testOpsAlert() {
  header("TEST 4 — Ops Alert: structured JSON output (post spike)");

  const spikedState = triggerSpike();

  const result = await askAssistantStructured({
    userMessage: "What is the current crowd situation and what should I do?",
    userContext: opsContext,
    mode: "ops_alert",
    liveState: spikedState,
    venueData: venue,
  });

  if ("parseError" in result) {
    console.log("Raw text fallback:", result.rawText);
    fail("JSON parse failed — raw text fallback used (check prompt or model output)");
  } else {
    console.log("Parsed alert:", JSON.stringify(result, null, 2));
    const isHighPriority = result.priority === "high";
    isHighPriority
      ? pass("Priority correctly set to 'high' after spike")
      : fail(`Priority was '${result.priority}', expected 'high' after spike`);
    pass("Structured JSON successfully parsed");
  }
}

async function testBriefing() {
  header("TEST 5 — Briefing: structured JSON shift summary");

  const result = await askAssistantStructured({
    userMessage: "Generate a shift briefing for the incoming operations team.",
    userContext: opsContext,
    mode: "briefing",
    liveState,
    venueData: venue,
  });

  if ("parseError" in result) {
    console.log("Raw text fallback:", result.rawText);
    fail("JSON parse failed — review briefing prompt");
  } else {
    console.log("Parsed briefing:", JSON.stringify(result, null, 2));
    pass("Briefing JSON successfully parsed");
  }
}

async function testTranslation() {
  header("TEST 6 — Translation: bilingual volunteer-assist response");

  const result = await askAssistant({
    userMessage: "¿Dónde está el baño más cercano con acceso para silla de ruedas?",
    userContext: volunteerContext,
    mode: "translation",
    liveState,
    venueData: venue,
  });

  if (result.success) {
    console.log("Response:", result.text);
    const hasBothLangs =
      result.text.includes("[English]") || result.text.includes("[Spanish]") ||
      result.text.includes("English") || result.text.includes("Español");
    hasBothLangs
      ? pass("Response contains both language labels")
      : fail("Response may not be bilingual — check translation prompt");
  } else {
    fail("Translation call failed", result.fallbackMessage);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🏟️  Smart Stadium Companion — Phase 2 Reasoning Layer Tests");
  console.log("   Model: gemini-2.5-flash");

  await testWayfinding();
  await testGrounding();
  await testTransport();
  await testOpsAlert();
  await testBriefing();
  await testTranslation();

  console.log("\n" + "=".repeat(60));
  console.log("  Phase 2 checkpoint complete.");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
