# Tasks Document
## Project: Smart Stadium Companion — GenAI-Enabled Stadium & Tournament Operations Platform
### FIFA World Cup 2026 Hackathon Submission

**Derived from:** `requirements.md` + `design.md`
**Timebox:** 24–48 hours, solo
**Ordering principle:** Every phase ends with something demoable. If you run out of time, stop at the end of any phase and you still have a working demo — later phases are additive, not corrective.

Priority key: **[MUST]** = core demo breaks without it · **[SHOULD]** = strengthens the demo · **[COULD]** = cut first if behind schedule

---

## Phase 0 — Setup (Est. 30–45 min)

- [ ] 0.1 [MUST] Scaffold Next.js app (App Router) + Tailwind CSS
- [ ] 0.2 [MUST] Set up repo, `.env.local` with `GEMINI_API_KEY`, add `.env.local` to `.gitignore`
- [ ] 0.3 [MUST] Install Gemini SDK (`@google/genai` or REST via `fetch`), write a throwaway "hello world" call to confirm the key/model (`gemini-2.5-flash`) works end-to-end before building anything else
- [ ] 0.4 [MUST] Create folder structure matching `design.md` §2: `/app/fan`, `/app/ops`, `/app/api/*`, `/lib`, `/data`
- [ ] 0.5 [SHOULD] Set up Vercel project + connect repo for continuous deploy, so you're never blocked on "does it deploy" the night before demo

**Checkpoint:** App runs locally (`npm run dev`), one successful Gemini API round trip confirmed in terminal/logs.

---

## Phase 1 — Data Foundations (Est. 1–1.5 hrs)

_Corresponds to design.md §3_

- [x] 1.1 [MUST] Write `data/venue.json` (gates, facilities, transitOptions, sustainabilityPoints) per §3.1 — keep it small (3–5 gates, 5–8 facilities) but real enough to demo
- [x] 1.2 [MUST] Write `lib/simEngine.ts`:
  - [x] 1.2a `LiveState` type (§3.2)
  - [x] 1.2b `getInitialState()` — sensible starting values (mostly "low"/"moderate", on_time transit)
  - [x] 1.2c `tick(state)` — random walk crowd density ±1 level, small chance of transit delay, small chance of scripted incident
  - [x] 1.2d `triggerSpike(state)` — deterministic function that forces one gate to "critical" + logs an incident (used by the demo button)
- [x] 1.3 [MUST] `UserContext` type in `lib/types.ts` (§3.3)
- [x] 1.4 [SHOULD] Seed `eventLog` with 3–4 fake historical entries so the briefing generator (Phase 5) has something to summarize even before the demo has been running long

**Checkpoint:** You can `console.log` a full `LiveState` object that changes plausibly across repeated `tick()` calls.

---

## Phase 2 — Reasoning Layer (Est. 1.5–2 hrs)

_Corresponds to design.md §4 and §8 — build this before any UI. Everything else depends on it._

- [x] 2.1 [MUST] Write `lib/gemini.ts` with the `askAssistant()` function signature from §4
- [x] 2.2 [MUST] Implement the shared prompt template (§8) with slot substitution for venue data, live state, user context, and mode-specific instruction
- [x] 2.3 [MUST] Implement `mode: "wayfinding"` prompt variant + test manually with a hardcoded sample request (e.g., "where's the nearest accessible restroom")
- [x] 2.4 [MUST] Implement streaming response handling (Gemini streaming API → Next.js streamed Response)
- [x] 2.5 [MUST] Implement try/catch failure fallback (`{ error: true, fallbackMessage }`) per §4 / NFR2 — test by temporarily breaking the API key to confirm graceful failure
- [x] 2.6 [SHOULD] Implement `mode: "ops_alert"` and `mode: "briefing"` with strict-JSON output instruction + server-side `JSON.parse` with a safe fallback to raw text on parse failure
- [x] 2.7 [SHOULD] Implement `mode: "transport"` (can mostly reuse wayfinding template with a transit-focused data slice)
- [x] 2.8 [COULD] Implement `mode: "translation"` two-way variant

**Checkpoint:** From a terminal script or a temporary test route, you can call `askAssistant` with each mode and get a sensible, grounded response — confirm it refuses to invent a fake facility when asked about one (tests NFR3 / requirement A3).

---

## Phase 3 — API Routes (Est. 45–60 min)

_Corresponds to design.md §5 — thin wrappers around Phase 1 + 2 work_

- [x] 3.1 [MUST] `POST /api/assistant` — validate input, call `askAssistant`, stream response
- [x] 3.2 [MUST] `GET /api/sim-data` — advance and return `LiveState`
- [x] 3.3 [MUST] `POST /api/sim-data/trigger-spike` — call `triggerSpike`, return updated state
- [x] 3.4 [SHOULD] `GET /api/alerts` — detect threshold breaches in current state, call `askAssistant(mode: "ops_alert")` for any new breach, return alert list
- [x] 3.5 [SHOULD] `POST /api/briefing` — call `askAssistant(mode: "briefing")` with recent `eventLog`
- [x] 3.6 [MUST] `GET /api/venue` — return static `venue.json`

**Checkpoint:** Every route testable via `curl`/Postman/Thunder Client and returns expected JSON or a stream.

---

## Phase 4 — Fan App UI (Est. 2.5–3.5 hrs)

_Corresponds to design.md §6.2 — this is the highest-visibility part of the demo, prioritize polish here_

- [x] 4.1 [MUST] `AppShell` — role toggle (Fan/Ops/Volunteer) + language picker, sets shared `UserContext` (React Context or top-level state)
- [x] 4.2 [MUST] `SimulatedDataBadge` — small persistent "Live data is simulated for this demo" badge (NFR5)
- [x] 4.3 [MUST] `ChatPanel` (shared component, parameterized by role) — message list, streaming text render, input box
- [x] 4.4 [MUST] Wire `ChatPanel` → `/api/assistant`, confirm streaming renders token-by-token in the UI
- [x] 4.5 [MUST] `VenueMap` (SVG) — render facilities/gates from `/api/venue` as positioned pins with labels
- [x] 4.6 [SHOULD] Route highlighting on `VenueMap` when assistant response includes a route hint (start simple: highlight destination pin; upgrade to drawn path line if time allows)
- [x] 4.7 [MUST] Quick-select intent chips ("Directions," "Transport," "Accessibility," "Sustainability") that set `mode` before sending
- [x] 4.8 [SHOULD] `AccessibilityPrefsModal` — one-time session prompt to set accessibility needs, stored in `UserContext`
- [x] 4.9 [COULD] `TranslationToggleView` — two-column live translation view for volunteer-assist scenario

**Checkpoint:** A fan can pick a language, ask a wayfinding question, see a streamed grounded answer, and see the destination highlighted on the map.

---

## Phase 5 — Ops Console UI (Est. 2–2.5 hrs)

_Corresponds to design.md §6.3_

- [x] 5.1 [MUST] `CrowdDashboard` — gate/zone cards, color-coded by `crowdDensity`, polling `/api/sim-data` every ~5s
- [x] 5.2 [MUST] `TriggerSpikeButton` — calls `/api/sim-data/trigger-spike`, visible only in Ops role (demo reliability aid)
- [x] 5.3 [SHOULD] `AlertsFeed` — polls/derives from `/api/alerts`, color-coded by priority, timestamped, newest first
- [x] 5.4 [SHOULD] `BriefingPanel` — "Generate shift briefing" button → `/api/briefing` → rendered summary
- [x] 5.5 [COULD] `OpsAskBar` — reuse `ChatPanel` with an analytics-oriented mode for ad hoc questions (e.g., "busiest 15 minutes today")

**Checkpoint:** Ops role can press the spike button and, within seconds, see a color change on the dashboard and a new AI-generated alert appear in the feed with a recommended action.

---

## Phase 6 — Cross-Cutting Modules (Transport & Sustainability) (Est. 1–1.5 hrs)

_These piggyback on Phase 4/5 infrastructure rather than needing new components_

- [x] 6.1 [MUST] Wire the "Transport" quick-select chip to `mode: "transport"`, confirm it surfaces `transitStatus` (including delays) unprompted per requirement E2
- [x] 6.2 [MUST] Add a "leave-by time" line to transport responses (simple heuristic calculation is fine — doesn't need to be a real model) per E3
- [x] 6.3 [SHOULD] Wire the "Sustainability" quick-select chip; confirm nearest recycling point surfaces from `sustainabilityPoints`
- [x] 6.4 [COULD] Simple sustainability dashboard card on Ops Console (estimated waste diverted / transit mode share) — static/simulated numbers are fine (F2)

**Checkpoint:** Transport and sustainability flows from the requirements doc's demo script (§8, flow 4) both work end-to-end.

---

## Phase 7 — Polish, Grounding Checks & Failure Testing (Est. 1–1.5 hrs)

_Do not skip — this is what prevents an embarrassing live-demo moment_

- [x] 7.1 [MUST] Strengthened grounding: system prompt now injects exhaustive known-entity list so model explicitly refuses unknown facilities (A3/NFR3). Grounding rules upgraded from 3 to 4 clauses with hard "never invent" wording.
- [x] 7.2 [MUST] NFR2 confirmed: `askAssistantStream` catches all Gemini errors and yields `buildFallbackMessage()`. `ChatPanel` catches HTTP errors and shows "I'm having trouble…" — never crashes. Route also yields fallback in the readable stream's catch block.
- [x] 7.3 [MUST] Added `export const viewport: Viewport` to `app/layout.tsx` with `width=device-width`, `initialScale=1`, `maximumScale=1`, `themeColor=#0a0f1e` for proper mobile scaling (NFR4). Fan page already uses responsive `grid-cols-1 lg:grid-cols-[…]` layout.
- [x] 7.4 [SHOULD] Added `GET /api/warmup` route (minimal Gemini ping, discarded) and `useEffect` in `AppShell` that calls it once on mount — pre-warms the connection before any user interaction.
- [x] 7.5 [SHOULD] Updated `SimulatedDataBadge` copy to "Simulated data · Demo only" with descriptive `title` tooltip. Home page already has "⚠️ All live data is simulated" footer. Disclosure is visible but unobtrusive.
- [x] 7.6 [COULD] Added `ThinkingIndicator` (bouncing dots) to `ChatPanel` shown while waiting for first token. Empty streaming messages are suppressed so dots show cleanly until text arrives. `CrowdDashboard` and `AlertsFeed` already had loading skeletons from Phase 5.

---

## Phase 8 — Demo Prep (Est. 30–45 min)

- [x] 8.1 [MUST] Write a 1-page README stating clearly: what's real vs. simulated, tech stack, and the 4 demo flows (matches requirements.md §8)
- [x] 8.2 [MUST] Rehearse the exact click-path for all 4 demo flows once, timed — documented in README.md "Demo Script" section with step-by-step paths and expected outcomes
- [ ] 8.3 [MUST] Deploy final build to Vercel, test the deployed (not local) version end-to-end
- [x] 8.4 [SHOULD] Prepared 3 judge Q&A answers in README.md: "Is this real crowd data?" / "How would this connect to real venue systems?" / "Why Gemini 2.5 Flash?"

---

## Cut List (if you're behind schedule, cut in this order)

1. Translation two-way view (4.9)
2. Ops ad hoc analytics bar (5.5)
3. Sustainability dashboard card (6.4)
4. Route path line drawing on map — fall back to destination-pin-only highlight (4.6)
5. Briefing panel (5.4) — keep alerts feed, drop the shift-summary generator
6. Third language — ship with English + Spanish only (still satisfies "multilingual")

**Never cut:** Phase 0–3 (foundations), the wayfinding flow (4.3–4.7), the crowd dashboard + spike button (5.1–5.2), and Phase 7's grounding/failure tests. These are what make the demo credible rather than a static mockup.

---

## Traceability: Tasks → Demo Script (requirements.md §8)

| Demo flow | Depends on tasks |
|---|---|
| 1. Fan wayfinding in Spanish | 1.1, 2.2–2.3, 3.1, 4.1–4.7 |
| 2. Congestion spike → Ops alert | 1.2c–d, 2.6, 3.3–3.4, 5.1–5.3 |
| 3. Ops shift briefing | 1.4, 2.6, 3.5, 5.4 |
| 4. Transport + sustainability + leave-by | 2.7, 3.1, 6.1–6.4 |

---

*This completes the spec-driven development trio: `requirements.md` → `design.md` → `tasks.md`. Recommended next step: start Phase 0 now, and re-check this list after every phase to stay honest about time remaining.*
