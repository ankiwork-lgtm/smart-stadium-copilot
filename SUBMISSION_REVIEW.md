# Smart Stadium Copilot — Submission Review Against Criteria

**Date:** 2026-07-12  
**Reviewed:** All code changes + codebase state as of commit 7ec24cf  
**Criteria:** Code Quality, Security, Efficiency, Testing, Accessibility

---

## Executive Summary

| Criterion | Rating | Status |
|---|---|---|
| **Code Quality** | ✅ PASS | Strong architecture, minor structural gaps |
| **Security** | ✅ PASS | Comprehensive validation, no key exposure |
| **Efficiency** | ✅ PASS | Polling guards, memoization, streaming present |
| **Testing** | ⚠️ NEEDS WORK | 85% server coverage, 0% component tests |
| **Accessibility** | ⚠️ NEEDS WORK | 4 WCAG violations, strong intent |

**Overall:** 3 of 5 criteria pass. Two criteria have actionable gaps with specific fixes identified.

---

## 1. Code Quality — PASS ✅

### Strengths
- **Single type authority:** `lib/types.ts` defines all shared types; no local re-declarations
- **Config-as-data pattern:** `PRIORITY_CONFIG`, `LEVEL_CONFIG`, etc. eliminate switch sprawl
- **Task cross-references:** Every file carries JSDoc header linking to spec (§3.2, Task 4.1 [MUST])
- **Private abstraction:** Gemini client is a singleton; `buildPrompt()` is unexported
- **Recently improved:** Flat ESLint config migration removed all inline disable comments

### Gaps
1. **Duplicate `fetchVenueOnce()` cache** — Both `VenueMap.tsx` and `CrowdDashboard.tsx` declare their own module-level cache with identical code. They are NOT shared (separate JS modules). Comment claims otherwise.
   - **File:** `src/components/VenueMap.tsx:20-36` vs `src/components/CrowdDashboard.tsx:15-30`
   - **Impact:** Code duplication, misleading documentation
   - **Fix:** Extract to `src/lib/venueCache.ts`, import in both

2. **Dual `app/` directory structures** — Both `app/` and `src/app/` exist with parallel routes. Next.js uses `app/` by default, leaving `src/app/` as dead code.
   - **Impact:** Confusion about which routes are served
   - **Fix:** Consolidate to single directory

3. **Type not in central registry** — `BriefingResult` defined locally in `src/components/BriefingPanel.tsx` instead of `lib/types.ts`
   - **Impact:** Breaks the pattern

### Recommendation
**PASS** — The architecture is sound. The duplicate cache is a real DRY violation but non-critical; the structural gaps are organizational rather than design problems.

---

## 2. Security — PASS ✅

### Strengths
- **Comprehensive allowlist validation:**
  - JSON parse safety check
  - `userMessage`: length, trim, non-empty
  - `mode`, `role`, `language`: against explicit `VALID_*` arrays
  - Each `accessibilityNeeds` element validated against allowlist
  - All violations return 400
- **Prompt injection test in suite** — `app/api/__tests__/assistant.test.ts` explicitly tests the string `"; ignore all previous instructions"` returns 400
- **No client-side API key exposure** — `GEMINI_API_KEY` is server-only; no `NEXT_PUBLIC_` env vars
- **Security headers set:**
  - `X-Content-Type-Options: nosniff` on streaming response
  - `Cache-Control: no-cache, no-store` on sensitive routes
- **STRICT GROUNDING in system prompt** — Explicitly lists all known entities with instruction to never invent locations
- **Structured output validation** — `askAssistantStructured()` validates JSON shape and enum values before returning
- **localStorage defensively handled** — Spreads defaults over parsed data to ensure required fields exist

### Gaps
1. **No allowlist validation of localStorage** — `UserContextProvider.tsx:63` casts with `as UserContext` without checking role/language/needs are valid. A user editing localStorage with `role: "superadmin"` passes unchecked into client state.
   - **File:** `src/components/UserContextProvider.tsx:50-70`
   - **Mitigation:** Server-side re-validates before using

2. **No rate limiting on Gemini-calling routes** — `/api/assistant`, `/api/alerts`, `/api/briefing` have no per-IP rate limiting, allowing cost spikes
   - **Priority:** Production concern, not demo blocker

3. **No CSRF protection on state-mutating routes** — `/api/sim-data/trigger-spike` has no CSRF token
   - **Priority:** Demo acceptable; production hardening item

4. **Raw error.message exposure** — `BriefingPanel.tsx:65` shows raw HTTP error text to users
   - **Impact:** Minor information leak

### Recommendation
**PASS** — The primary attack vectors are well-handled and verified. Gaps are production-hardening concerns, not critical for a prototype.

---

## 3. Efficiency — PASS ✅

### Strengths
- **Fetch-in-progress guards:** `AlertsFeed.tsx:88`, `CrowdDashboard.tsx:137` skip polls if one is in flight
- **`visibilityState` check:** Pauses all polling when tab is hidden
- **`useMemo` for lookup maps:** `CrowdDashboard.tsx:208-216` memoizes O(n) constructions
- **`useCallback` with documented deps:** `sendMessage`, `fetchSimData`, `fetchAlerts` all correct
- **Streaming over buffering:** `/api/assistant` uses `ReadableStream` + `TextDecoder` for token-by-token delivery
- **`AbortController` for cancellation:** `ChatPanel.tsx:133` cancels in-flight requests on new message
- **Alert deduplication with GC:** `app/api/alerts/route.ts` uses 5-minute cooldown + explicit garbage collection
- **Token-efficient prompts:** `buildPrompt()` filters by mode to reduce Gemini input tokens
- **CDN cache headers:** `/api/venue` sets `max-age=3600, stale-while-revalidate=600`
- **Gemini warmup on mount:** `/api/warmup` pre-initializes client on app load

### Gaps
1. **Duplicate venue fetch** — Because caches are separate module instances, both `VenueMap` and `CrowdDashboard` fire GET `/api/venue` on fan page
   - **Impact:** One extra HTTP request per page load (bounded)
   - **Fix:** Shared cache module

2. **`handleTriggerSpike` not memoized** — `CrowdDashboard.tsx:190` recreates on every render
   - **Impact:** Minor inconsistency

3. **No code splitting** — All components statically imported; `AccessibilityPrefsModal` (used once) not lazy-loaded
   - **Priority:** Low at current scale

### Recommendation
**PASS** — Efficiency implementation is strong. The duplicate fetch is bounded and has a clear fix.

---

## 4. Testing — NEEDS WORK ⚠️

### Strengths
- **6 test files covering server paths:**
  - `lib/__tests__/simEngine.test.ts` — 24 tests with statistical invariant checking
  - `lib/__tests__/gemini.test.ts` — 17 tests across success/error/fallback
  - `lib/__tests__/venueData.test.ts` — 20+ tests including domain business rules
  - `app/api/__tests__/assistant.test.ts` — all validation paths + prompt injection
  - `app/api/__tests__/alerts.test.ts` — 17 tests with module isolation
  - `app/api/__tests__/routes.test.ts` — 15 tests across 5 routes
- **140 total tests, all passing**
- **Module singleton state isolation:** `vi.resetModules()` + dynamic import correctly isolates `_generatedAlerts` state between tests
- **Domain rules tested:** `venueData.test.ts` verifies business invariants like "gate-c non-accessible"
- **Fallback path coverage:** `gemini.test.ts` verifies fallback JSON is valid

### Gaps
1. **Zero React component tests:**
   - No tests for: `ChatPanel.tsx`, `AlertsFeed.tsx`, `CrowdDashboard.tsx`, `VenueMap.tsx`, `AccessibilityPrefsModal.tsx`, `UserContextProvider.tsx`
   - **Impact:** Entire UI layer untested
   - **Missing test patterns:**
     - Streaming read loop + abort behavior
     - Polling with visibility state
     - Modal interactions
     - Context propagation
   - **Files needed:**
     ```
     src/components/__tests__/ChatPanel.test.tsx
     src/components/__tests__/AlertsFeed.test.tsx
     src/components/__tests__/CrowdDashboard.test.tsx
     src/components/__tests__/UserContextProvider.test.tsx
     src/components/__tests__/VenueMap.test.tsx
     ```

2. **Coverage scope excludes components:** `vitest.config.ts:26` only measures `lib/` and `app/api/`; `src/components/` is outside scope
   - **Result:** 85% measured coverage, but unmeasured ~0% in components

3. **No coverage thresholds enforced:** `vitest.config.ts` has no `thresholds` property; build passes at any coverage level

4. **Polling behavior untested:** `visibilityState` guard, `fetchInProgressRef` lock, interval timing not tested

5. **No E2E tests:** No Playwright/Cypress setup; fan flow (chip → message → highlight) and ops flow (spike → alert) not integration-tested

### Recommendation
**NEEDS WORK** — Server-side tests are excellent (pattern quality, module isolation, security coverage), but the complete absence of component tests, combined with unmeasured coverage and no thresholds, means the criterion is not met. Estimated real coverage including components: ~50%.

**To pass:** Create component test files targeting 70%+ coverage, enable component coverage measurement, add thresholds to `vitest.config.ts`.

---

## 5. Accessibility — NEEDS WORK ⚠️

### Strengths
- **ARIA landmarks:** `<nav>`, `<main>` present; role buttons and groups correctly labeled
- **Live regions on dynamic content:** Chat messages (`aria-live="polite"`), alerts, briefing results
- **Keyboard navigation:** Alert cards use `role="button"`, `tabIndex={0}`, `onKeyDown` handler; modals have role/aria-modal/aria-labelledby
- **Decorative elements hidden:** Emoji throughout marked `aria-hidden="true"`
- **Form inputs labeled:** Chat textarea, send button, modal fields all have aria-label or htmlFor/id pairs
- **SVG map accessible:** `aria-label` on map, `role="img"` on gates/facilities/sustainability points
- **Accessibility modal:** Prompts users for mobility/vision/hearing/sensory needs on first visit, injects into AI prompt
- **Descriptive labels:** Gate cards have meaningful `aria-label` including name + level

### WCAG Violations

#### 1. **`userScalable: false`** — WCAG 1.4.4 Level AA
**File:** `app/layout.tsx:16`  
**Issue:** Viewport config disables browser pinch-to-zoom  
**Impact:** Users with low vision cannot zoom to read text  
**Fix:** Remove `userScalable: false` or set `userScalable: yes`

#### 2. **`<html lang="en">` hardcoded** — WCAG 3.1.1 Level A
**Files:** `app/layout.tsx:26`, `src/app/layout.tsx:25`  
**Issue:** Document language is always `"en"` even when user switches to Spanish/French  
**Impact:** Screen readers apply English pronunciation to Spanish/French content  
**Fix:** Use `useLayoutEffect` to update `document.documentElement.lang` based on `useUserContext().language`

#### 3. **Missing focus management in modal** — WCAG 2.1.2 / 2.4.3
**File:** `src/components/AccessibilityPrefsModal.tsx`  
**Issues:**
- No focus trap within dialog (Tab escapes to background)
- No initial focus on first interactive element
- No focus restoration to trigger button on close
  
**Impact:** Keyboard users cannot navigate modals; violates focus order and no-keyboard-trap requirements  
**Fix:**
- On open: `firstInteractiveElement.focus()`
- Trap focus: `keydown` on Last/First focusable elements wraps focus
- On close: Return focus to trigger button

#### 4. **No skip-to-main-content link** — WCAG 2.4.1 Level A
**File:** `src/components/AppShell.tsx`  
**Issue:** Keyboard users must Tab through entire sticky navbar before reaching main content  
**Fix:** Add hidden "Skip to main content" link as first focusable element; show on `:focus-visible`

### Minor Issues

- **SVG emoji not aria-hidden:** `VenueMap.tsx` SVG text elements with emoji can be announced by screen readers
- **Color alone indicates status:** `CrowdBar` uses color/width without text; functional because parent card has aria-label
- **Accessibility chip doesn't map to distinct mode:** `IntentChips.tsx:52` routes "Accessibility" to `wayfinding` mode instead of a dedicated mode

### Recommendation
**NEEDS WORK** — Strong intent and existing a11y patterns, but 4 direct WCAG Level A/AA failures:
- 1.4.4 (Resize Text) — `userScalable: false`
- 3.1.1 (Language of Page) — hardcoded `lang="en"`
- 2.1.2 / 2.4.3 (Focus Management) — modal focus trap missing
- 2.4.1 (Bypass Blocks) — no skip-to-main link

These affect users with low vision, keyboard-only access, and screen reader use. **All are straightforward fixes.**

---

## Prioritized Action Items

### Priority 1 (WCAG Compliance — Blocks Accessibility Pass)
1. **Remove `userScalable: false`** from `app/layout.tsx:16`
2. **Add language attribute reactivity** — Update `<html lang>` when user changes language
3. **Add focus trap + management to modal** — Open/close focus handling
4. **Add skip-to-main-content link** — First focusable element in AppShell

### Priority 2 (Testing Coverage — Blocks Testing Pass)
1. Create `src/components/__tests__/` directory
2. Write tests for: ChatPanel, AlertsFeed, CrowdDashboard, UserContextProvider, VenueMap
3. Update `vitest.config.ts` to include components in coverage measurement
4. Add coverage thresholds: `{ lines: 75, functions: 70, branches: 60, statements: 75 }`
5. Target: 70%+ component coverage

### Priority 3 (Code Quality Improvements)
1. Extract shared `fetchVenueOnce()` to `src/lib/venueCache.ts`
2. Move `BriefingResult` type to `lib/types.ts`
3. Consolidate `app/` and `src/app/` directory structures

---

## Test Coverage Summary

```
Current (Server-side only):
  Statements:   85.09% (257/302)
  Branches:     62.03% (116/187)
  Functions:    70.37% (38/54)
  Lines:        85.81% (248/289)

Unmeasured (Components):
  Est. 0% coverage
  ~140 lines of component logic

Effective (Including unmeasured):
  Est. ~50% overall coverage
```

---

## Submission Readiness

| Criterion | Status | Ready |
|---|---|---|
| Code Quality | PASS | ✅ Yes |
| Security | PASS | ✅ Yes |
| Efficiency | PASS | ✅ Yes |
| Testing | NEEDS WORK | ❌ No (0 component tests, no thresholds) |
| Accessibility | NEEDS WORK | ❌ No (4 WCAG violations) |

**Recommendation:** Address gaps in Testing and Accessibility (Priority 1 + Priority 2) before submission. These are not architectural issues — all gaps have clear, isolated fixes.

**Estimated effort:**
- Priority 1 (A11y): 2–3 hours
- Priority 2 (Testing): 4–6 hours
- Priority 3 (Cleanup): 1–2 hours
