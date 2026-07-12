# 🏟️ Smart Stadium Companion

> **FIFA World Cup 2026 Hackathon Submission**  
> GenAI-powered assistant for fans, operations staff, and volunteers at a simulated World Cup venue.

---

## What is this?

Smart Stadium Companion is a full-stack Next.js application that puts **Google Gemini 2.5 Flash** at the centre of stadium operations and fan experience. It demonstrates three integrated use-cases in a single app:

| Role | What they get |
|---|---|
| **Fan** | AI wayfinding, transport planning, accessibility guidance, sustainability tips — all streamed in real time, available in English / Spanish / French |
| **Ops Staff** | Live crowd dashboard with AI-generated alerts, one-click congestion spike simulation, and AI shift-briefing generation |
| **Volunteer** | Role toggle in the nav bar switches the chat into volunteer-assist mode — adapted welcome messages and "Volunteer assist response" headers on every AI reply |

---

## 🎯 Approach & Design Rationale

### Vertical choice
Stadium operations and fan experience at a mega-event (FIFA World Cup 2026) is a high-stakes, high-volume, multilingual environment. It creates a natural stress-test for every AI capability on show: grounded factual retrieval, real-time context injection, multilingual generation, structured JSON output for ops workflows, and streaming UX for time-sensitive queries. Three distinct user roles (Fan, Ops Staff, Volunteer) let a single demo surface all of those capabilities without feeling contrived.

### Core design philosophy
The central thesis is **grounded assistance over open-ended chat**. Rather than giving users a blank chat box backed by an unconstrained LLM, every Gemini call is tightly scoped:

1. **Context injection** — the system prompt always includes the full venue schema (`data/venue.json`), a live state snapshot from `lib/simEngine.ts`, the user's current role, their language preference, and any declared accessibility needs. The model reasons over *this specific venue* at *this specific moment*, not a generic stadium.
2. **Named-entity grounding** — an exhaustive list of real entity names (gate IDs, facility names, transit routes) is injected so the model can explicitly refuse invented locations rather than hallucinating a plausible-sounding answer.
3. **Mode-specific instructions** — each API call carries a `mode` parameter (`wayfinding`, `transport`, `ops_alert`, `briefing`, `translation`) that switches the system prompt's instruction block. This keeps responses focused and makes structured-JSON output (used by ops_alert and briefing) reliable.
4. **Streaming by default** — fan-facing chat uses the Gemini streaming API piped through a Next.js `ReadableStream` response, so the first token appears within ~300 ms. This matters for a live demo and for real fan UX where waiting feels like failure.
5. **Decoupled data layer** — `LiveState` is a plain TypeScript type consumed by `lib/gemini.ts`. The simulation engine (`lib/simEngine.ts`) is a drop-in stand-in for real venue API feeds; swapping it out requires no changes to the AI or UI layers.

### Role-based context as the UX mechanic
Switching role in the AppShell nav bar instantly changes what the AI knows about *you*: a Fan gets wayfinding and accessibility answers; an Ops staff member gets incident-aware alerts and shift briefings; a Volunteer gets adapted welcome phrasing and helper-mode responses. This demonstrates how a single model + single prompt template can power meaningfully different experiences through context alone — no fine-tuning required.

---

## 📌 Assumptions

The following assumptions were made during development. In a production deployment each would be addressed as noted.

| Assumption | Production path |
|---|---|
| **No real venue API** — all crowd, transit, and incident data is stochastic simulation | Replace `GET /api/sim-data` with a poller against the venue's crowd management / ticketing API |
| **In-memory singleton state** — `simEngine.ts` stores `LiveState` as a module-level variable inside the Next.js server process | Replace with a Redis or Pub/Sub backed store so state is consistent across serverless instances |
| **Static weather** — "Sunny, 28 °C" is hardcoded in the system prompt | Connect to a weather API (e.g. Google Weather API) and inject current conditions per tick |
| **Three languages only** — English, Spanish, French | Gemini supports all major languages; extending the picker is a UI-only change |
| **No authentication** — role is a session toggle, not a verified identity | Add OAuth / venue ticketing SSO; gate ops routes behind a verified `ops` role claim |
| **Venue modelled on a generic 80,000-seat NFL stadium in Dallas, TX** — not an actual FIFA 2026 venue | Swap `data/venue.json` for real venue data from the host-city venue operator |
| **Vercel serverless cold-start** — handled by a `/api/warmup` pre-warm call on app mount; not a substitute for provisioned concurrency at scale | Use Vercel Fluid Compute or provisioned concurrency for the assistant route in production |
| **No persistent event log** — `eventLog` resets on server restart; briefings only reflect the current process lifetime | Persist events to a database (Postgres / Firestore) for cross-session briefing continuity |

---

## ✅ What's Real vs. Simulated

| Layer | Status | Details |
|---|---|---|
| **Gemini 2.5 Flash** | ✅ **Real** | All AI responses are live Gemini API calls (streaming) |
| **Venue data** | 🟡 **Simulated** | `data/venue.json` — modelled on a realistic 80,000-seat stadium in Dallas, TX; not an actual FIFA venue |
| **Crowd density** | 🟡 **Simulated** | `lib/simEngine.ts` — stochastic random walk ±1 level per gate, every ~5 s poll |
| **Transit status** | 🟡 **Simulated** | Same engine — 8 % chance of delay per tick, 40 % recovery per tick |
| **Incidents** | 🟡 **Simulated** | 5 % chance per tick of a scripted low-severity incident; `triggerSpike()` forces a critical event deterministically |
| **Weather** | 🟡 **Simulated** | Static — "Sunny, 28 °C" |
| **User auth / ticketing** | ❌ **Not present** | Role is a session toggle (Fan / Ops / Volunteer) — no real auth |
| **Payments / ticketing** | ❌ **Not present** | Out of scope |

The **simulated-data badge** is always visible in the app so judges and users are never misled.

---

## 🛠️ Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | SSR + API routes in one project; Vercel-native |
| Language | **TypeScript 5** | End-to-end types across lib, API, and UI |
| AI | **Google Gemini 2.5 Flash** (`@google/genai` SDK) | Fastest Gemini model, long-context system prompts, streaming support |
| Styling | **Tailwind CSS 3** | Rapid dark-theme UI, responsive grid |
| State | **React 19 Context** (`UserContextProvider`) | Lightweight — no Redux needed for this scope; persisted to `localStorage` |
| Data | **Static JSON** + **module-level singleton** (`simEngine.ts`) | No database required; server-process state survives between polls |
| Testing | **Vitest 4** | Unit tests for lib and API route logic; no real Gemini calls made in tests |
| Deploy | **Vercel** | Zero-config Next.js deploy, edge-friendly |

---

## 📁 Project Structure

```
smart-stadium-copilot/
├── app/                        # Next.js App Router (root — active)
│   ├── layout.tsx              # Root layout (imports UserContextProvider from src/)
│   ├── page.tsx                # Landing page (Fan App / Ops Console links)
│   ├── globals.css             # Global styles
│   ├── fan/                    # Fan App route (page.tsx + layout.tsx)
│   ├── ops/                    # Ops Console route (page.tsx + layout.tsx)
│   └── api/
│       ├── assistant/          # POST — streaming Gemini chat
│       ├── sim-data/           # GET — advance simulation + return LiveState
│       │   └── trigger-spike/  # POST — force congestion spike
│       ├── alerts/             # GET — threshold-breach alerts (AI-generated)
│       ├── briefing/           # POST — AI shift briefing
│       ├── venue/              # GET — static venue.json
│       ├── warmup/             # GET — pre-warm Gemini connection
│       └── __tests__/          # Vitest unit tests for API routes
├── src/
│   ├── app/                    # Mirrors app/ — kept for @/* alias resolution
│   └── components/             # All React components (imported via @/components/…)
│       ├── AppShell.tsx        # Nav bar, role toggle, language picker
│       ├── ChatPanel.tsx       # Streaming chat UI (shared across fan + ops)
│       ├── VenueMap.tsx        # SVG map with highlighted pins
│       ├── IntentChips.tsx     # Quick-select mode chips
│       ├── CrowdDashboard.tsx  # Gate-level crowd density cards
│       ├── AlertsFeed.tsx      # AI-generated ops alert list
│       ├── BriefingPanel.tsx   # Shift briefing generator
│       ├── SustainabilityCard.tsx
│       ├── AccessibilityPrefsModal.tsx
│       ├── SimulatedDataBadge.tsx  # Persistent "Simulated data · Demo only" badge
│       └── UserContextProvider.tsx # React Context + localStorage persistence
├── lib/
│   ├── gemini.ts               # All Gemini calls (askAssistant, stream, structured)
│   ├── simEngine.ts            # Simulation tick engine + triggerSpike()
│   ├── types.ts                # Shared TypeScript types (source of truth)
│   └── __tests__/              # Vitest unit tests for lib modules
├── data/
│   └── venue.json              # Static venue data (gates, facilities, transit, sustainability)
├── scripts/
│   ├── hello-gemini.ts         # Smoke-test: verifies Gemini API key works
│   └── test-reasoning.ts       # Manual reasoning/prompt test harness
├── specs/
│   ├── requirements.md         # Product requirements
│   ├── design.md               # Architecture & design document
│   └── tasks.md                # Sequenced implementation task list
└── .env.example                # Template — copy to .env.local and add your key
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key for Gemini

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd smart-stadium-copilot
npm install

# 2. Set your Gemini API key
cp .env.example .env.local
# Then edit .env.local and replace the placeholder with your actual key.
# Get a key at: https://aistudio.google.com/app/apikey

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

---

## 🧪 Testing

The project uses **Vitest** for unit tests. All tests mock external dependencies — no real Gemini API calls are made.

### Test files

| File | What it covers |
|---|---|
| `lib/__tests__/gemini.test.ts` | Gemini wrapper functions (`askAssistantStructured`, stream helpers) |
| `lib/__tests__/simEngine.test.ts` | Simulation tick logic, `triggerSpike()`, state transitions |
| `lib/__tests__/venueData.test.ts` | Venue JSON schema validation and data integrity |
| `app/api/__tests__/alerts.test.ts` | Alert breach detection, priority ordering, Gemini parse-error fallback |
| `app/api/__tests__/assistant.test.ts` | Streaming assistant route behaviour and error handling |

### Commands

```bash
# Run all tests once (unit + smoke)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only the Gemini smoke-test (requires GEMINI_API_KEY)
npm run test:smoke
```

> **Note:** `npm test` runs Vitest and then `test:smoke`. The smoke-test is automatically skipped if `GEMINI_API_KEY` is not set, so CI pipelines without an API key work fine.

---

## 🎬 Demo Script — 4 Flows

> Rehearse in this exact order. Total run time: ~8–10 minutes.

---

### Flow 1 — Fan Wayfinding in Spanish (2 min)

**Shows:** Multilingual AI, grounded venue knowledge, map highlighting, accessibility awareness

1. Open `http://localhost:3000` → click **Fan App →**
2. In the **AppShell** (top nav), change language to **Español**
3. Click **♿ Preferences** → check **Mobility** → close modal
4. Click the **Directions** chip
5. Type: `¿Dónde está el baño accesible más cercano?`
6. Watch the **streamed Spanish response** — it references Gate A / Restroom Block A
7. Observe the **venue map** highlight the correct pin (Restroom Block A, North zone)

**Expected outcome:** Response is in Spanish, references only real venue facilities, highlights the accessible restroom on the map.

---

### Flow 2 — Congestion Spike → Ops Alert (2 min)

**Shows:** Real-time simulation, AI-generated operational alerts, colour-coded dashboard

1. In the **AppShell**, switch role to **Ops**
2. Click **Ops Console →** (or navigate to `/ops`)
3. Note the **Crowd Dashboard** — gates are moderate/low (green/yellow)
4. Click the **⚠️ Trigger Spike** button
5. Within seconds, **Gate A** card turns **red (Critical)**, **Gate B** turns orange (High)
6. Switch to the **Alerts** tab (or view the centre column on desktop)
7. A new AI-generated alert appears: summary, recommended action, HIGH priority badge

**Expected outcome:** Dashboard colour change is immediate; AI alert appears within ~3 s with a specific recommended action (open Gate E overflow, PA redirect).

---

### Flow 3 — Ops Shift Briefing (2 min)

**Shows:** AI structured output, event log synthesis, ops-grade communication

1. From the Ops Console, navigate to the **Briefing** tab (or right column on desktop)
2. Click **Generate Shift Briefing**
3. Wait ~2–3 s for the AI to synthesize the event log and live state
4. Read the structured briefing: **summary**, **recommended action for incoming team**, **priority level**

> 💡 If you ran Flow 2 first, the briefing will reference the congestion spike, making it more dramatic.

**Expected outcome:** A concise, factual briefing that references actual gate IDs and incident types from the simulated event log — not generic boilerplate.

---

### Flow 4 — Transport + Sustainability + Leave-By Time (2 min)

**Shows:** Multi-modal reasoning, proactive transit status, sustainability integration

1. Switch back to the **Fan App** (role: Fan, language: English)
2. Click the **Transport** chip
3. Type: `How do I get back to downtown after the match?`
4. Observe the response: lists Blue Line (Gate A), Route 42 (Gate B), Uber/Lyft (Gate D) with **leave-by time** recommendation
5. Now click the **Sustainability** chip
6. Type: `Where can I recycle my cup?`
7. Observe: response surfaces the **Recycling Station — North Plaza** and **East Plaza** with exact locations; map highlights both pins

**Expected outcome:** Transport response proactively states current transit status (on-time or delayed) and gives a concrete leave-by time. Sustainability response highlights all eco-points on the map.

---

## ❓ Judge Q&A — Prepared Answers

### "Is this real crowd data?"

No — and we're transparent about that. All crowd density, transit status, and incident data is generated by `lib/simEngine.ts`, a stochastic simulation engine. Every screen shows a **"Simulated data · Demo only"** badge. In a production deployment, this layer would be replaced by venue API feeds (ticketing scan events, CCTV crowd analytics, transit operator APIs). The Gemini reasoning layer and all prompt logic would be identical — only the data source changes.

### "How would this connect to real venue systems?"

The simulation engine (`lib/simEngine.ts`) and the AI layer (`lib/gemini.ts`) are deliberately decoupled. `LiveState` is a plain TypeScript type. In production you would:
1. Replace `GET /api/sim-data` with a poller against the venue's crowd management API
2. Replace `data/venue.json` with a CMS or venue data platform
3. Keep `lib/gemini.ts` unchanged — it only consumes `LiveState` and `VenueData` regardless of source

The architecture was designed specifically for this swap-out pattern.

### "Why Gemini 2.5 Flash specifically?"

Three reasons:
1. **Speed** — Flash is the fastest Gemini model in the family, which matters for streaming UX where fans expect near-instant first-token latency
2. **Long-context system prompts** — our prompt injects the full venue schema (gates, facilities, transit, sustainability), live state snapshot, and user context. Flash handles this comfortably within its context window
3. **Structured output** — ops_alert and briefing modes require strict JSON. Flash reliably follows JSON-schema instructions, and our `askAssistantStructured()` wrapper adds a safe plain-text fallback if it ever doesn't

---

## 🌿 Sustainability Features

- **Recycling Station** locations surfaced in every sustainability query
- **Water refill points** highlighted on the venue map
- **FIFA 2026 Zero-Waste Initiative** context injected into all sustainability responses
- **Sustainability Card** on the Ops Console shows simulated waste diversion and transit mode share

---

## ♿ Accessibility

- **AccessibilityPrefsModal** — one-time session prompt for mobility, vision, hearing, and sensory needs
- Accessibility needs are injected into every Gemini prompt, biasing responses toward accessible routes
- Gate C is flagged non-accessible in venue data; AI will never recommend it to mobility-impaired users
- **Sensory Room** (Gate B, East zone) is surfaced for sensory needs automatically

---

## 🔒 Grounding & Safety

The system prompt includes four strict grounding rules:
1. Only reference entities listed in `venue.json`
2. An **exhaustive named-entity list** is injected so the model can explicitly refuse unknown locations (e.g. "Gate F", "VIP lounge") with "I don't have information about that facility"
3. Never fabricate crowd figures or transit times not in the live state
4. If uncertain, err on "I don't have that information" over inventing a plausible-sounding answer

Error resilience: `askAssistantStream` catches all Gemini errors and yields a friendly fallback message. The UI never crashes or shows a raw error.

---

## 📜 License

Built for the FIFA World Cup 2026 AI Hackathon. Demo/educational use only.  
Not affiliated with FIFA, Dallas Cowboys Stadium, or any official venue operator.
