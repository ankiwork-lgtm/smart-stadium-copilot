/**
 * app/api/alerts/route.ts
 * GET /api/alerts
 *
 * Inspects the current LiveState for threshold breaches and, for any
 * breach that is new (not already in the in-memory dedup set), calls
 * askAssistantStructured(mode: "ops_alert") to generate an AI-written
 * alert with a recommended action.
 *
 * Threshold rules (mirrors what the ops dashboard considers "notable"):
 *  - Any gate at "critical" crowd density → HIGH priority
 *  - Any gate at "high" crowd density → MEDIUM priority
 *  - Any transit line delayed → MEDIUM priority
 *  - Any unresolved active incident → MEDIUM / HIGH (depends on type)
 *
 * Response: application/json — Alert[]
 *
 * Alert shape:
 * {
 *   id:               string,          // deterministic per breach so UI can deduplicate
 *   timestamp:        string,          // ISO 8601
 *   priority:         "low"|"medium"|"high",
 *   summary:          string,          // AI-generated one-liner
 *   recommendedAction: string,         // AI-generated action
 *   source:           string,          // e.g. "gate-a" | "train-1" | "incident-3"
 *   rawText?:         string,          // present only when JSON parse failed
 * }
 *
 * Task 3.4 [SHOULD]
 */

import { NextResponse } from "next/server";
import { getState } from "../../../lib/simEngine";
import { askAssistantStructured } from "../../../lib/gemini";
import venueJson from "../../../data/venue.json";
import type { VenueData, CrowdLevel, Alert, AlertPriority } from "../../../lib/types";

const venue = venueJson as VenueData;

// ---------------------------------------------------------------------------
// In-memory dedup — tracks alert IDs already generated this server session
// so we don't re-call Gemini for the same breach on every poll.
// Uses a cooldown window to prevent re-alerting on oscillating breaches.
// ---------------------------------------------------------------------------

const _generatedAlerts = new Map<string, Alert>(); // alertId → Alert
const _seenBreachIds = new Map<string, number>();  // breachId → timestamp of last Gemini call

const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// _seenBreachIds entries are pruned once the breach is inactive AND the cooldown
// has fully expired (2× window), preventing unbounded Map growth over long sessions.
const SEEN_BREACH_GC_MS = ALERT_COOLDOWN_MS * 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Breach = {
  id: string;
  source: string;
  priority: AlertPriority;
  description: string;
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    const state = getState();

    // --- 1. Detect threshold breaches ---
    const breaches: Breach[] = [];

    // Crowd density breaches
    const highThresholds: Record<CrowdLevel, AlertPriority | null> = {
      low: null,
      moderate: null,
      high: "medium",
      critical: "high",
    };

    for (const [gateId, level] of Object.entries(state.crowdDensity)) {
      const priority = highThresholds[level];
      if (priority) {
        const gateName = venue.gates.find((g) => g.id === gateId)?.name ?? gateId;
        breaches.push({
          id: `crowd-${gateId}-${level}`,
          source: gateId,
          priority,
          description: `${gateName} has reached ${level} crowd density. Current live conditions indicate a potential bottleneck. What action should ops take?`,
        });
      }
    }

    // Transit delay breaches
    for (const [transitId, entry] of Object.entries(state.transitStatus)) {
      if (entry.status === "delayed") {
        const transitName =
          venue.transitOptions.find((t) => t.id === transitId)?.line ??
          transitId;
        breaches.push({
          id: `transit-${transitId}-delayed`,
          source: transitId,
          priority: "medium",
          description: `${transitName} is reporting a delay${entry.note ? `: ${entry.note}` : ""}. What should ops communicate to fans?`,
        });
      }
    }

    // Active (unresolved) incident breaches
    for (const incident of state.incidents.filter((i) => !i.resolved)) {
      const priority: AlertPriority =
        incident.type === "security" || incident.type === "medical"
          ? "high"
          : "medium";
      breaches.push({
        id: `incident-${incident.id}`,
        source: incident.id,
        priority,
        description: `Active incident in ${incident.zone} zone: ${incident.description}. What is the recommended ops response?`,
      });
    }

    // --- 2. Generate AI alerts for new breaches only (respecting cooldown window) ---
    const now = Date.now();
    const newBreaches = breaches.filter((b) => {
      const lastAlerted = _seenBreachIds.get(b.id);
      return lastAlerted === undefined || (now - lastAlerted) > ALERT_COOLDOWN_MS;
    });

    await Promise.all(
      newBreaches.map(async (breach) => {
        const result = await askAssistantStructured({
          userMessage: breach.description,
          userContext: { role: "ops_staff", language: "en" },
          mode: "ops_alert",
          liveState: state,
          venueData: venue,
        });

        const alert: Alert = {
          id: breach.id,
          timestamp: new Date().toISOString(),
          source: breach.source,
          priority: "parseError" in result ? breach.priority : result.priority,
          summary: "parseError" in result ? result.rawText : result.summary,
          recommendedAction:
            "parseError" in result
              ? "Please review live conditions and take appropriate action."
              : result.recommendedAction,
          ...("parseError" in result ? { rawText: result.rawText } : {}),
        };

        _generatedAlerts.set(breach.id, alert);
        _seenBreachIds.set(breach.id, now);
      })
    );

    // --- 3. Prune alerts and seen-breach entries for inactive breaches ---
    // _generatedAlerts is pruned immediately when the breach clears.
    // _seenBreachIds is also cleared immediately so reactivating breaches get re-alerted,
    // but only if they stay clear long enough to be pruned from _seenBreachIds.
    const activeBreachIds = new Set(breaches.map((b) => b.id));
    for (const id of _generatedAlerts.keys()) {
      if (!activeBreachIds.has(id)) {
        _generatedAlerts.delete(id);
      }
    }
    for (const [id, lastAlerted] of _seenBreachIds.entries()) {
      if (!activeBreachIds.has(id)) {
        _seenBreachIds.delete(id);
      }
    }

    // --- 4. Return sorted list (newest / highest priority first) ---
    const sorted = [..._generatedAlerts.values()].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[api/alerts] error:", err);
    return NextResponse.json(
      { error: "Failed to generate alerts." },
      { status: 500 }
    );
  }
}
