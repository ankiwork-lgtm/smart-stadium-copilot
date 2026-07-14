/**
 * lib/types.ts
 * Shared TypeScript types used across the app.
 * Source of truth — import from here, never redefine locally.
 */

// ---------------------------------------------------------------------------
// §3.2 — Simulated Live State
// ---------------------------------------------------------------------------

export type CrowdLevel = "low" | "moderate" | "high" | "critical";

export type TransitStatusEntry = {
  status: "on_time" | "delayed" | "closed";
  note?: string;
};

export type Incident = {
  id: string;
  zone: string;
  type: "congestion" | "medical" | "security" | "maintenance" | "weather";
  description: string;
  timestamp: string; // ISO 8601
  resolved: boolean;
};

export type EventLogEntry = {
  timestamp: string; // ISO 8601
  type: "alert" | "recommendation" | "incident";
  text: string;
};

export type LiveState = {
  timestamp: string; // ISO 8601 — when this snapshot was generated
  crowdDensity: Record<string, CrowdLevel>; // keyed by gate id, e.g. "gate-a"
  transitStatus: Record<string, TransitStatusEntry>; // keyed by transit id, e.g. "train-1"
  incidents: Incident[];
  weather: {
    condition: string; // e.g. "Sunny", "Partly Cloudy", "Thunderstorm"
    tempC: number;
  };
  eventLog: EventLogEntry[];
};

// ---------------------------------------------------------------------------
// §3.3 — User / Session Context
// The ops_staff role is verified server-side via HMAC-signed session cookie
// (see lib/auth.ts). Fan and volunteer remain self-declared (lower trust).
// ---------------------------------------------------------------------------

export type UserRole = "fan" | "ops_staff" | "volunteer";

export type Language = "en" | "es" | "fr";

export type AccessibilityNeed = "mobility" | "vision" | "hearing" | "sensory";

export type UserContext = {
  role: UserRole;
  language: Language;
  accessibilityNeeds?: AccessibilityNeed[];
  currentLocationHint?: string; // free text, e.g. "near Gate B"
};

// ---------------------------------------------------------------------------
// §4 — Reasoning Layer I/O types
// ---------------------------------------------------------------------------

export type AssistantMode =
  | "wayfinding"
  | "ops_alert"
  | "briefing"
  | "transport"
  | "translation"
  | "sustainability";

export type AssistantRequest = {
  userMessage: string;
  userContext: UserContext;
  mode: AssistantMode;
  liveState?: LiveState; // required for ops_alert / briefing; optional for wayfinding
};

export type AssistantResponse =
  | { success: true; text: string }
  | { success: false; error: true; fallbackMessage: string };

// ---------------------------------------------------------------------------
// Venue data types (mirrors data/venue.json shape)
// ---------------------------------------------------------------------------

export type Gate = {
  id: string;
  name: string;
  label: string;
  zone: string;
  accessible: boolean;
  coords: [number, number]; // [x, y] in SVG-space
  description: string;
};

export type Facility = {
  id: string;
  name: string;
  type:
    | "restroom"
    | "sensory_room"
    | "first_aid"
    | "concession"
    | "recycling"
    | "water_refill";
  accessible: boolean;
  nearGate: string;
  zone: string;
  coords: [number, number];
  description: string;
};

export type TransitOption = {
  id: string;
  mode: "train" | "bus" | "rideshare";
  line?: string;
  stop?: string;
  pickupZone?: string;
  nearGate: string;
  frequency?: string;
  travelTimeToCenter?: string;
  firstService?: string;
  lastService?: string;
  note?: string;
};

export type SustainabilityPoint = {
  id: string;
  name: string;
  type: "recycling" | "water_refill" | "solar" | "compost";
  nearGate: string;
  zone: string;
  coords: [number, number];
  description: string;
};

export type VenueData = {
  venueName: string;
  city: string;
  event: string;
  capacity: number;
  gates: Gate[];
  facilities: Facility[];
  transitOptions: TransitOption[];
  sustainabilityPoints: SustainabilityPoint[];
};

// ---------------------------------------------------------------------------
// Alert types — shared between /api/alerts route and AlertsFeed component
// ---------------------------------------------------------------------------

export type AlertPriority = "low" | "medium" | "high";

export type Alert = {
  id: string;
  timestamp: string; // ISO 8601
  priority: AlertPriority;
  summary: string;
  recommendedAction: string;
  source: string;
  rawText?: string; // present only when JSON parse failed
};
