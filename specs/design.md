# Design Document
## Project: Smart Stadium Companion — GenAI-Enabled Stadium & Tournament Operations Platform
### FIFA World Cup 2026 Hackathon Submission

**Status:** Draft, based on approved `requirements.md`
**GenAI model:** Google Gemini 2.5 Flash (server-side calls only)
**Stack:** Next.js (React + API routes) + Tailwind + in-memory/JSON data store + Vercel

---

## 1. Design Goals & Constraints Carried Forward

- One deployable Next.js app. No separate backend service.
- One shared GenAI reasoning layer (Gemini 2.5 Flash) behind a single server-side wrapper, reused by every module.
- All "real-time" data is simulated by an in-process data generator — must be visibly labeled as simulated in the UI (NFR5).
- Must survive LLM/API failure gracefully (NFR2).
- Responses must be grounded in the app's own venue knowledge base, not hallucinated (NFR3).
- Solo build, 24–48 hrs → favor the smallest number of moving parts that still demos all 7 modules convincingly.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App (Vercel)                    │
│                                                                   │
│  ┌───────────────────┐        ┌───────────────────────────────┐ │
│  │   Fan App (UI)     │        │   Ops Console (UI)             │ │
│  │  /app/fan/*        │        │  /app/ops/*                    │ │
│  │  - Chat            │        │  - Live dashboard               │ │
│  │  - Map overlay     │        │  - Alerts feed                  │ │
│  │  - Role/lang picker│        │  - Briefing generator           │ │
│  └─────────┬──────────┘        └───────────────┬────────────────┘ │
│            │                                    │                  │
│            ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Shared API Routes (/app/api/*)                   │ │
│  │  /api/assistant   /api/alerts   /api/briefing   /api/sim-data │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Reasoning Layer: lib/gemini.ts (single wrapper)               │ │
│  │  - injects venue knowledge base + live sim data as context     │ │
│  │  - calls Gemini 2.5 Flash (streaming)                          │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Simulated Data Layer: lib/simEngine.ts                        │ │
│  │  - venue.json (static knowledge base: gates, facilities, map)  │ │
│  │  - live state (in-memory): crowd density, transit, incidents   │ │
│  │  - tick() function mutates live state on each poll/interval     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Why this shape:** everything funnels through one Gemini wrapper and one sim-data module, so each of the 7 requirement modules (A–G) is really just "a different prompt template + a different slice of the same data," not separate systems. This is what makes solo/24–48hr feasible.

---

## 3. Data Model

### 3.1 Static Knowledge Base (`data/venue.json`) — ground truth, never hallucinated

```json
{
  "venueName": "Legacy Stadium (simulated)",
  "gates": [
    { "id": "gate-a", "name": "Gate A", "zone": "North", "accessible": true },
    { "id": "gate-b", "name": "Gate B", "zone": "East", "accessible": true },
    { "id": "gate-c", "name": "Gate C", "zone": "South", "accessible": false }
  ],
  "facilities": [
    { "id": "rest-1", "type": "restroom", "accessible": true, "nearGate": "gate-a", "coords": [120, 340] },
    { "id": "quiet-1", "type": "sensory_room", "accessible": true, "nearGate": "gate-b", "coords": [400, 210] },
    { "id": "food-1", "type": "concession", "accessible": true, "nearGate": "gate-c", "coords": [610, 500] }
  ],
  "transitOptions": [
    { "id": "train-1", "mode": "train", "line": "Blue Line", "stop": "Stadium Station" },
    { "id": "bus-1", "mode": "bus", "line": "Route 42", "stop": "Stadium Plaza" },
    { "id": "rideshare-1", "mode": "rideshare", "pickupZone": "Lot C Pickup" }
  ],
  "sustainabilityPoints": [
    { "id": "recycle-1", "type": "recycling", "nearGate": "gate-a" }
  ]
}
```

### 3.2 Simulated Live State (in-memory, mutated by `simEngine.tick()`)

```ts
type LiveState = {
  timestamp: string;
  crowdDensity: Record<gateId: string, level: "low" | "moderate" | "high" | "critical">;
  transitStatus: Record<transitId: string, { status: "on_time" | "delayed" | "closed"; note?: string }>;
  incidents: { id: string; zone: string; type: string; description: string; timestamp: string; resolved: boolean }[];
  weather: { condition: string; tempC: number };
  eventLog: { timestamp: string; type: "alert" | "recommendation" | "incident"; text: string }[];
};
```

- `tick()` runs on each API call to `/api/sim-data` (pull-based, not a real cron — simplest for a demo) and randomly walks values (e.g., crowd density has a chance to shift up/down one level per tick), occasionally injecting a scripted incident so the demo has something to show judges without waiting for randomness.
- A **"Trigger Congestion Spike" demo button** on the Ops Console lets the presenter force a spike on demand rather than hoping for one — this is a deliberate design choice for reliable live demos.

### 3.3 User/Session Model (mocked, no real auth)

```ts
type UserContext = {
  role: "fan" | "ops_staff" | "volunteer";
  language: "en" | "es" | "fr"; // extendable
  accessibilityNeeds?: ("mobility" | "vision" | "hearing" | "sensory")[];
  currentLocationHint?: string; // free text, e.g. "near Gate B"
};
```

Stored client-side (React state / localStorage), sent with every `/api/assistant` request — no backend session store needed.

---

## 4. Reasoning Layer Design (`lib/gemini.ts`)

Single function, reused by every module:

```ts
async function askAssistant({
  userMessage,
  userContext,
  liveState,
  venueData,
  mode, // "wayfinding" | "ops_alert" | "briefing" | "transport" | "translation"
}: AskAssistantParams): Promise<AssistantResponse>
```

**Design decisions:**

- **Grounding via system prompt injection, not fine-tuning.** Every call's system prompt includes: (a) the relevant slice of `venue.json`, (b) the relevant slice of `LiveState`, (c) the user's role/language/accessibility context, (d) an explicit instruction: *"Only reference gates, facilities, and transit options listed in the provided data. If asked about something not listed, say you don't have that information — do not invent it."* This directly satisfies NFR3.
- **One shared wrapper, five prompt templates** (`mode` parameter) rather than five separate integrations — keeps token/latency budget predictable and keeps the code small enough to build solo.
- **Streaming responses** from Gemini 2.5 Flash to the client via a streamed API route response, so the chat UI feels responsive even at 3–5s total generation time (NFR1).
- **Structured output for non-chat modules.** For Ops alerts (B2) and briefings (G1), the prompt instructs Gemini to return strict JSON (`{ "summary": ..., "recommendedAction": ..., "priority": "low|medium|high" }`), parsed server-side before sending to the client — this avoids fragile regex-parsing of free text in the UI.
- **Failure handling:** wrapper wraps the Gemini call in try/catch; on failure, returns a typed `{ error: true, fallbackMessage }` so the UI can show a friendly "Having trouble reaching the assistant, please try again" instead of crashing (NFR2).

---

## 5. API Routes

| Route | Method | Purpose | Consumed by |
|---|---|---|---|
| `/api/assistant` | POST | Main chat endpoint; takes `{ userMessage, userContext, mode }`, injects context, streams Gemini response | Fan App chat, Ops Q&A |
| `/api/sim-data` | GET | Returns current `LiveState`, advancing the simulation one tick | Dashboard polling (Fan + Ops) |
| `/api/sim-data/trigger-spike` | POST | Forces a congestion spike / scripted incident into `LiveState` for demo reliability | Ops Console "demo button" |
| `/api/alerts` | GET | Returns AI-generated alerts derived from current `LiveState` (calls `askAssistant` with `mode: "ops_alert"` when new threshold breaches are detected) | Ops Console alerts feed |
| `/api/briefing` | POST | Generates a natural-language shift summary from `eventLog` (`mode: "briefing"`) | Ops Console briefing panel |
| `/api/venue` | GET | Returns static `venue.json` (map + facilities) | Map component, wayfinding |

All routes are Next.js Route Handlers (`app/api/.../route.ts`), server-side only — the Gemini API key never reaches the client.

---

## 6. Frontend Component Breakdown

### 6.1 Shared / App Shell
- `AppShell` — top nav with role toggle (Fan / Ops Staff / Volunteer) and language picker; sets `UserContext`.
- `SimulatedDataBadge` — small persistent badge ("Live data is simulated for this demo") to satisfy NFR5 without over-explaining in every response.

### 6.2 Fan App (`/app/fan`)
- `ChatPanel` — message list + input, streams from `/api/assistant` with `mode` inferred from message intent (simple heuristic: keyword match for "transport", "restroom/accessible", default to `wayfinding`) or explicitly tagged by a quick-select chip row ("Directions", "Transport", "Accessibility", "Sustainability").
- `VenueMap` (SVG) — renders `venue.json` facilities as pins; highlights a path when the assistant response includes a `routeHint` (list of facility/gate IDs to connect visually).
- `AccessibilityPrefsModal` — lets a fan set accessibility needs once at session start (D1).
- `TranslationToggleView` (volunteer-assist mode) — two-column live view: fan's language / volunteer's language, both fed by the same `/api/assistant` call with `mode: "translation"` (C3).

### 6.3 Ops Console (`/app/ops`)
- `CrowdDashboard` — zone/gate cards colored by `crowdDensity` level, polling `/api/sim-data` every ~5s.
- `AlertsFeed` — scrollable list from `/api/alerts`, newest first, color-coded by priority (B5), each entry timestamped (B4).
- `TriggerSpikeButton` — calls `/api/sim-data/trigger-spike`; purely a demo reliability aid.
- `BriefingPanel` — button "Generate shift briefing" → calls `/api/briefing`, renders returned summary text.
- `OpsAskBar` — free-text input for ad hoc questions (B3, G2), same `ChatPanel`-style component reused with `mode: "ops_alert"` or a general `mode: "analytics"`.

### 6.4 Reused Across Both Surfaces
- `ChatPanel` is a single component parameterized by `role` — avoids building two separate chat UIs (resolves the open question from `requirements.md` §9: **one shared chat component, two route-level shells**, rather than fully separate codebases).

---

## 7. Module-to-Design Traceability

| Requirement Module | Design Elements |
|---|---|
| A. Navigation & Wayfinding | `ChatPanel` + `VenueMap` + `/api/assistant` (`mode: wayfinding`) + `venue.json` |
| B. Crowd Management & Real-Time Decisions | `CrowdDashboard`, `AlertsFeed`, `/api/alerts`, `/api/sim-data`, `TriggerSpikeButton` |
| C. Multilingual Assistant | `UserContext.language`, `TranslationToggleView`, prompt-level language instruction |
| D. Accessibility | `AccessibilityPrefsModal`, `UserContext.accessibilityNeeds`, facility filtering in `venue.json` |
| E. Transportation | `/api/assistant` (`mode: transport`), `transitOptions` in `venue.json`, `transitStatus` in `LiveState` |
| F. Sustainability | `sustainabilityPoints` in `venue.json`, contextual nudge logic in the wayfinding/transport prompt template |
| G. Operational Intelligence | `BriefingPanel`, `/api/briefing`, `eventLog` in `LiveState` |

---

## 8. Prompt Template Strategy (summary — full prompts belong in implementation, not design)

Each `mode` maps to a system-prompt template with this shape:

```
You are Stadium Copilot, an assistant for [fans / operations staff] at a simulated FIFA World Cup 2026 venue.

CONTEXT (venue knowledge — treat as ground truth, do not invent beyond this):
<venue_data>

CURRENT LIVE CONDITIONS (simulated):
<live_state_slice>

USER CONTEXT:
role: <role>, language: <language>, accessibility needs: <needs>

INSTRUCTIONS:
- Respond in <language>.
- Only reference facilities/gates/transit present in the provided data.
- If information is missing, say so rather than guessing.
- [mode-specific instruction, e.g. "Prioritize accessible routes." / "Return strict JSON: {...}"]

USER MESSAGE:
<userMessage>
```

This keeps grounding, language, and role-awareness consistent across every module using one template shape with slot substitution — critical for solo build speed.

---

## 9. Error & Edge Case Handling

| Case | Handling |
|---|---|
| Gemini API call fails/times out | Return friendly fallback message; log error server-side; UI shows retry button |
| User asks about a facility not in `venue.json` | Prompt instructs model to say it doesn't have that info (A3) |
| JSON parse failure on structured alert/briefing output | Fallback: display raw text response instead of structured card, log a warning |
| No accessibility needs set | Default to standard routing, no assumptions injected |
| Language not in supported set | Detect via Gemini; if unsupported, respond in English with a note that full support isn't available for that language yet |

---

## 10. Deployment & Demo Reliability Notes

- Deploy to Vercel; set `GEMINI_API_KEY` as a server-only environment variable.
- Because live judging is high-stakes, **prefer deterministic demo triggers** (spike button, scripted incident) over relying on random walk timing.
- Pre-warm the Gemini connection with a dummy call on app load to avoid a slow first response during the actual demo.

---

## 11. Open Items for Task Breakdown Phase

- Decide exact wording/order of the quick-select intent chips in `ChatPanel`.
- Decide whether translation mode (C3) is a stretch goal cut if time runs short — flagged as medium risk given solo timeline.
- Finalize the 3-language set (confirm with requirements §9).

---

*Next step in spec-driven development: proceed to `tasks.md` — a sequenced, checkable task list derived directly from the component/route breakdown above, ordered for incremental demoable progress.*
