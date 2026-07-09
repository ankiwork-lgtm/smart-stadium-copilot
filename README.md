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
| **Volunteer** | Two-way bilingual translation assist for any language pairing |

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
| Framework | **Next.js 15** (App Router) | SSR + API routes in one project; Vercel-native |
| Language | **TypeScript 5** | End-to-end types across lib, API, and UI |
| AI | **Google Gemini 2.5 Flash** (`@google/genai` SDK) | Fastest Gemini model, long-context system prompts, streaming support |
| Styling | **Tailwind CSS 3** | Rapid dark-theme UI, responsive grid |
| State | **React Context** (`UserContextProvider`) | Lightweight — no Redux needed for this scope |
| Data | **Static JSON** + **module-level singleton** (`simEngine.ts`) | No database required; server-process state survives between polls |
| Deploy | **Vercel** | Zero-config Next.js deploy, edge-friendly |

---

## 📁 Project Structure

```
smart-stadium-copilot/
├── app/                    # Next.js App Router pages & API routes
│   ├── page.tsx            # Landing page (Fan App / Ops Console links)
│   ├── fan/                # Fan App route
│   ├── ops/                # Ops Console route
│   └── api/
│       ├── assistant/      # POST — streaming Gemini chat
│       ├── sim-data/       # GET — advance simulation + return LiveState
│       │   └── trigger-spike/  # POST — force congestion spike
│       ├── alerts/         # GET — threshold-breach alerts (AI-generated)
│       ├── briefing/       # POST — AI shift briefing
│       ├── venue/          # GET — static venue.json
│       └── warmup/         # GET — pre-warm Gemini connection
├── lib/
│   ├── gemini.ts           # All Gemini calls (askAssistant, stream, structured)
│   ├── simEngine.ts        # Simulation tick engine + triggerSpike()
│   └── types.ts            # Shared TypeScript types (source of truth)
├── src/
│   ├── app/                # Client pages (fan/page.tsx, ops/page.tsx)
│   └── components/         # All React components
│       ├── AppShell.tsx    # Nav bar, role toggle, language picker
│       ├── ChatPanel.tsx   # Streaming chat UI (shared across fan + ops)
│       ├── VenueMap.tsx    # SVG map with highlighted pins
│       ├── IntentChips.tsx # Quick-select mode chips
│       ├── CrowdDashboard.tsx
│       ├── AlertsFeed.tsx
│       ├── BriefingPanel.tsx
│       ├── SustainabilityCard.tsx
│       └── AccessibilityPrefsModal.tsx
└── data/
    └── venue.json          # Static venue data (gates, facilities, transit, sustainability)
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
echo 'GEMINI_API_KEY=your_key_here' > .env.local

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
