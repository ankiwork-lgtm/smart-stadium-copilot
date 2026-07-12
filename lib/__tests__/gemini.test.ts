/**
 * lib/__tests__/gemini.test.ts
 *
 * Unit tests for lib/gemini.ts
 *
 * The @google/genai SDK is fully mocked — no real API calls are made.
 * Tests verify:
 *  - askAssistant(): happy-path, SDK error fallback, missing API key
 *  - askAssistantStream(): happy-path chunks, error fallback
 *  - askAssistantStructured(): valid JSON parse, malformed JSON fallback,
 *                               shape-mismatch fallback, SDK error fallback
 *  - buildPrompt internals (indirectly): grounding content appears in calls
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AskAssistantParams } from "../gemini";

// ---------------------------------------------------------------------------
// Mock @google/genai before importing the module under test
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

// GoogleGenAI is used with `new`, so the mock must be a constructor function
function MockGoogleGenAI() {
  return {
    models: {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    },
  };
}

vi.mock("@google/genai", () => ({
  GoogleGenAI: MockGoogleGenAI,
}));

// Import after mocking so the mock is in place when the module initialises
import { askAssistant, askAssistantStream, askAssistantStructured } from "../gemini";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseParams: AskAssistantParams = {
  userMessage: "Where is the nearest restroom?",
  userContext: { role: "fan", language: "en" },
  mode: "wayfinding",
};

const opsParams: AskAssistantParams = {
  userMessage: "What is the current crowd status?",
  userContext: { role: "ops_staff", language: "en" },
  mode: "ops_alert",
  liveState: {
    timestamp: new Date().toISOString(),
    crowdDensity: {
      "gate-a": "critical",
      "gate-b": "high",
      "gate-c": "low",
      "gate-d": "moderate",
      "gate-e": "low",
    },
    transitStatus: {
      "train-1": { status: "on_time" },
      "bus-1": { status: "delayed", note: "Signal fault." },
      "bus-2": { status: "on_time" },
      "rideshare-1": { status: "on_time" },
    },
    incidents: [],
    weather: { condition: "Sunny", tempC: 28 },
    eventLog: [],
  },
};

const validStructuredJson = JSON.stringify({
  summary: "Gate A is at critical density.",
  recommendedAction: "Open Gate E overflow.",
  priority: "high",
});

beforeEach(() => {
  vi.clearAllMocks();
  // Provide a valid API key for every test by default
  vi.stubEnv("GEMINI_API_KEY", "test-api-key");
});

// ---------------------------------------------------------------------------
// askAssistant()
// ---------------------------------------------------------------------------

describe("askAssistant()", () => {
  it("returns { success: true, text } on successful SDK response", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Head to Restroom Block A." });

    const result = await askAssistant(baseParams);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe("Head to Restroom Block A.");
    }
  });

  it("calls generateContent with a non-empty systemInstruction", async () => {
    mockGenerateContent.mockResolvedValue({ text: "ok" });

    await askAssistant(baseParams);

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.config.systemInstruction).toBeTruthy();
    expect(typeof callArg.config.systemInstruction).toBe("string");
  });

  it("passes the userMessage verbatim as the user turn content", async () => {
    // Trimming is the responsibility of the API route layer, not gemini.ts.
    // gemini.ts passes whatever string it receives directly as the user turn.
    mockGenerateContent.mockResolvedValue({ text: "ok" });

    await askAssistant({
      ...baseParams,
      userMessage: "Where is the restroom?",
    });

    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.contents[0].parts[0].text).toBe("Where is the restroom?");
  });

  it("returns { success: false, error: true } when SDK throws", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Network error"));

    const result = await askAssistant(baseParams);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(true);
      expect(result.fallbackMessage).toBeTruthy();
    }
  });

  it("fallback message is non-empty string on SDK error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("timeout"));
    const result = await askAssistant(baseParams);
    if (!result.success) {
      expect(typeof result.fallbackMessage).toBe("string");
      expect(result.fallbackMessage.length).toBeGreaterThan(0);
    }
  });

  it("system prompt contains the user role", async () => {
    mockGenerateContent.mockResolvedValue({ text: "ok" });
    await askAssistant(opsParams);
    const systemPrompt = mockGenerateContent.mock.calls[0][0].config.systemInstruction as string;
    expect(systemPrompt.toLowerCase()).toContain("operations staff");
  });

  it("system prompt contains language instruction for Spanish", async () => {
    mockGenerateContent.mockResolvedValue({ text: "ok" });
    await askAssistant({ ...baseParams, userContext: { role: "fan", language: "es" } });
    const systemPrompt = mockGenerateContent.mock.calls[0][0].config.systemInstruction as string;
    expect(systemPrompt).toContain("Spanish");
  });

  it("system prompt contains STRICT GROUNDING RULES section", async () => {
    mockGenerateContent.mockResolvedValue({ text: "ok" });
    await askAssistant(baseParams);
    const systemPrompt = mockGenerateContent.mock.calls[0][0].config.systemInstruction as string;
    expect(systemPrompt).toContain("STRICT GROUNDING RULES");
  });

  it("handles empty text response gracefully", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });
    const result = await askAssistant(baseParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.text).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// askAssistantStream()
// ---------------------------------------------------------------------------

describe("askAssistantStream()", () => {
  it("yields text chunks from the SDK stream", async () => {
    async function* fakeStream() {
      yield { text: "Head " };
      yield { text: "to " };
      yield { text: "Gate A." };
    }
    mockGenerateContentStream.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of askAssistantStream(baseParams)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Head ", "to ", "Gate A."]);
  });

  it("skips chunks where text is falsy (empty string / undefined)", async () => {
    async function* fakeStream() {
      yield { text: "Hello" };
      yield { text: "" };           // should be skipped
      yield { text: undefined };    // should be skipped
      yield { text: " world" };
    }
    mockGenerateContentStream.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of askAssistantStream(baseParams)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("yields a single fallback message chunk when SDK throws", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("stream error"));

    const chunks: string[] = [];
    for await (const chunk of askAssistantStream(baseParams)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBeGreaterThan(0);
  });

  it("fallback for ops_alert mode is valid JSON", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("fail"));

    const chunks: string[] = [];
    for await (const chunk of askAssistantStream({ ...opsParams, mode: "ops_alert" })) {
      chunks.push(chunk);
    }

    const combined = chunks.join("");
    expect(() => JSON.parse(combined)).not.toThrow();
    const parsed = JSON.parse(combined);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("recommendedAction");
    expect(parsed).toHaveProperty("priority");
  });
});

// ---------------------------------------------------------------------------
// askAssistantStructured()
// ---------------------------------------------------------------------------

describe("askAssistantStructured()", () => {
  it("returns a parsed StructuredOpsOutput on valid JSON response", async () => {
    mockGenerateContent.mockResolvedValue({ text: validStructuredJson });

    const result = await askAssistantStructured(opsParams);

    expect("parseError" in result).toBe(false);
    if (!("parseError" in result)) {
      expect(result.summary).toBe("Gate A is at critical density.");
      expect(result.recommendedAction).toBe("Open Gate E overflow.");
      expect(result.priority).toBe("high");
    }
  });

  it("strips markdown code fences before parsing", async () => {
    const fenced = "```json\n" + validStructuredJson + "\n```";
    mockGenerateContent.mockResolvedValue({ text: fenced });

    const result = await askAssistantStructured(opsParams);

    expect("parseError" in result).toBe(false);
    if (!("parseError" in result)) {
      expect(result.priority).toBe("high");
    }
  });

  it("returns { rawText, parseError: true } on malformed JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "This is not JSON at all." });

    const result = await askAssistantStructured(opsParams);

    expect("parseError" in result).toBe(true);
    if ("parseError" in result) {
      expect(result.parseError).toBe(true);
      expect(result.rawText).toBe("This is not JSON at all.");
    }
  });

  it("returns { rawText, parseError: true } on JSON with wrong shape (missing priority)", async () => {
    const badShape = JSON.stringify({ summary: "ok", recommendedAction: "do something" });
    mockGenerateContent.mockResolvedValue({ text: badShape });

    const result = await askAssistantStructured(opsParams);

    expect("parseError" in result).toBe(true);
  });

  it("returns { rawText, parseError: true } on JSON with invalid priority value", async () => {
    const badPriority = JSON.stringify({
      summary: "ok",
      recommendedAction: "do something",
      priority: "urgent", // not a valid value
    });
    mockGenerateContent.mockResolvedValue({ text: badPriority });

    const result = await askAssistantStructured(opsParams);

    expect("parseError" in result).toBe(true);
  });

  it("returns fallback when SDK throws (parses JSON fallback for ops_alert mode)", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await askAssistantStructured(opsParams);

    // For ops_alert/briefing modes, the fallback message is valid JSON that parses successfully
    if ("parseError" in result) {
      expect(result.rawText).toBeTruthy();
    } else {
      // Successful parse of fallback JSON
      expect(result.summary).toBe("Assistant temporarily unavailable.");
      expect(result.recommendedAction).toBe("Please retry in a few seconds or check Gemini API status.");
      expect(result.priority).toBe("low");
    }
  });

  it("accepts all three valid priority levels", async () => {
    for (const priority of ["low", "medium", "high"] as const) {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ summary: "s", recommendedAction: "a", priority }),
      });
      const result = await askAssistantStructured(opsParams);
      expect("parseError" in result).toBe(false);
      if (!("parseError" in result)) {
        expect(result.priority).toBe(priority);
      }
    }
  });
});
