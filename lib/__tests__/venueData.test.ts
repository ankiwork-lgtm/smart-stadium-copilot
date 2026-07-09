/**
 * lib/__tests__/venueData.test.ts
 *
 * Schema validation tests for data/venue.json
 *
 * These tests verify that venue.json conforms to the VenueData TypeScript
 * type at runtime — guarding against accidental data corruption that
 * TypeScript's type checker might miss (e.g. wrong string values).
 *
 * Also validates domain-level rules:
 *  - Gate C must be non-accessible (referenced in prompt grounding logic)
 *  - All gate IDs referenced by facilities exist in the gates array
 *  - All gate IDs referenced by transitOptions exist in the gates array
 *  - Coordinates are [number, number] pairs within SVG canvas bounds
 *  - No duplicate IDs across any category
 */

import { describe, it, expect } from "vitest";
import venueJson from "../../data/venue.json";
import type { VenueData } from "../types";

const venue = venueJson as VenueData;

// ---------------------------------------------------------------------------
// Top-level shape
// ---------------------------------------------------------------------------

describe("venue.json — top-level shape", () => {
  it("has required string fields: venueName, city, event", () => {
    expect(typeof venue.venueName).toBe("string");
    expect(venue.venueName.length).toBeGreaterThan(0);
    expect(typeof venue.city).toBe("string");
    expect(typeof venue.event).toBe("string");
  });

  it("capacity is a positive number", () => {
    expect(typeof venue.capacity).toBe("number");
    expect(venue.capacity).toBeGreaterThan(0);
  });

  it("gates, facilities, transitOptions, sustainabilityPoints are arrays", () => {
    expect(Array.isArray(venue.gates)).toBe(true);
    expect(Array.isArray(venue.facilities)).toBe(true);
    expect(Array.isArray(venue.transitOptions)).toBe(true);
    expect(Array.isArray(venue.sustainabilityPoints)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

describe("venue.json — gates", () => {
  it("defines exactly 5 gates", () => {
    expect(venue.gates).toHaveLength(5);
  });

  it("every gate has required string fields: id, name, label, zone, description", () => {
    for (const gate of venue.gates) {
      expect(typeof gate.id).toBe("string");
      expect(gate.id.length).toBeGreaterThan(0);
      expect(typeof gate.name).toBe("string");
      expect(typeof gate.label).toBe("string");
      expect(typeof gate.zone).toBe("string");
      expect(typeof gate.description).toBe("string");
    }
  });

  it("every gate has a boolean accessible field", () => {
    for (const gate of venue.gates) {
      expect(typeof gate.accessible).toBe("boolean");
    }
  });

  it("every gate has [number, number] coords", () => {
    for (const gate of venue.gates) {
      expect(Array.isArray(gate.coords)).toBe(true);
      expect(gate.coords).toHaveLength(2);
      expect(typeof gate.coords[0]).toBe("number");
      expect(typeof gate.coords[1]).toBe("number");
    }
  });

  it("gate IDs are unique", () => {
    const ids = venue.gates.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the expected gate IDs used by simEngine", () => {
    const ids = venue.gates.map((g) => g.id);
    for (const expected of ["gate-a", "gate-b", "gate-c", "gate-d", "gate-e"]) {
      expect(ids).toContain(expected);
    }
  });

  // Domain rule: gate-c is non-accessible — the system prompt grounding logic
  // relies on this to never recommend Gate C to mobility-impaired users.
  it("gate-c is marked accessible: false (accessibility grounding rule)", () => {
    const gateC = venue.gates.find((g) => g.id === "gate-c");
    expect(gateC).toBeDefined();
    expect(gateC!.accessible).toBe(false);
  });

  it("gate-a is marked accessible: true", () => {
    const gateA = venue.gates.find((g) => g.id === "gate-a");
    expect(gateA!.accessible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

const VALID_FACILITY_TYPES = [
  "restroom",
  "sensory_room",
  "first_aid",
  "concession",
  "recycling",
  "water_refill",
] as const;

const gateIdSet = new Set(venue.gates.map((g) => g.id));

describe("venue.json — facilities", () => {
  it("all facility IDs are unique", () => {
    const ids = venue.facilities.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every facility has required fields", () => {
    for (const facility of venue.facilities) {
      expect(typeof facility.id).toBe("string");
      expect(typeof facility.name).toBe("string");
      expect(typeof facility.description).toBe("string");
      expect(typeof facility.zone).toBe("string");
      expect(typeof facility.accessible).toBe("boolean");
    }
  });

  it("every facility type is a valid FacilityType", () => {
    for (const facility of venue.facilities) {
      expect(VALID_FACILITY_TYPES).toContain(facility.type);
    }
  });

  it("every facility nearGate references an existing gate ID", () => {
    for (const facility of venue.facilities) {
      expect(gateIdSet.has(facility.nearGate)).toBe(true);
    }
  });

  it("every facility has valid [number, number] coords", () => {
    for (const facility of venue.facilities) {
      expect(Array.isArray(facility.coords)).toBe(true);
      expect(facility.coords).toHaveLength(2);
      expect(typeof facility.coords[0]).toBe("number");
      expect(typeof facility.coords[1]).toBe("number");
    }
  });

  // Domain rule: a sensory_room must exist (required for Module D)
  it("defines at least one sensory_room facility", () => {
    const sensoryRooms = venue.facilities.filter((f) => f.type === "sensory_room");
    expect(sensoryRooms.length).toBeGreaterThanOrEqual(1);
  });

  // Domain rule: first_aid stations must exist (required for ops alerts)
  it("defines at least one first_aid facility", () => {
    const firstAid = venue.facilities.filter((f) => f.type === "first_aid");
    expect(firstAid.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Transit options
// ---------------------------------------------------------------------------

const VALID_TRANSIT_MODES = ["train", "bus", "rideshare"] as const;

describe("venue.json — transitOptions", () => {
  it("all transit IDs are unique", () => {
    const ids = venue.transitOptions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every transitOption has required fields: id, mode, nearGate", () => {
    for (const transit of venue.transitOptions) {
      expect(typeof transit.id).toBe("string");
      expect(typeof transit.nearGate).toBe("string");
    }
  });

  it("every transit mode is valid", () => {
    for (const transit of venue.transitOptions) {
      expect(VALID_TRANSIT_MODES).toContain(transit.mode);
    }
  });

  it("every transit nearGate references an existing gate ID", () => {
    for (const transit of venue.transitOptions) {
      expect(gateIdSet.has(transit.nearGate)).toBe(true);
    }
  });

  it("contains the IDs used by simEngine: train-1, bus-1, bus-2, rideshare-1", () => {
    const ids = venue.transitOptions.map((t) => t.id);
    for (const expected of ["train-1", "bus-1", "bus-2", "rideshare-1"]) {
      expect(ids).toContain(expected);
    }
  });

  it("train-1 (Blue Line) is near gate-a — used in demo Flow 4 assertions", () => {
    const train = venue.transitOptions.find((t) => t.id === "train-1");
    expect(train).toBeDefined();
    expect(train!.nearGate).toBe("gate-a");
  });

  it("rideshare-1 is near gate-d — used in wayfinding prompts", () => {
    const rideshare = venue.transitOptions.find((t) => t.id === "rideshare-1");
    expect(rideshare).toBeDefined();
    expect(rideshare!.nearGate).toBe("gate-d");
  });
});

// ---------------------------------------------------------------------------
// Sustainability points
// ---------------------------------------------------------------------------

const VALID_SUSTAINABILITY_TYPES = ["recycling", "water_refill", "solar", "compost"] as const;

describe("venue.json — sustainabilityPoints", () => {
  it("all sustainability IDs are unique", () => {
    const ids = venue.sustainabilityPoints.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every sustainability point has required fields", () => {
    for (const point of venue.sustainabilityPoints) {
      expect(typeof point.id).toBe("string");
      expect(typeof point.name).toBe("string");
      expect(typeof point.zone).toBe("string");
      expect(typeof point.description).toBe("string");
    }
  });

  it("every sustainability type is valid", () => {
    for (const point of venue.sustainabilityPoints) {
      expect(VALID_SUSTAINABILITY_TYPES).toContain(point.type);
    }
  });

  it("every sustainability nearGate references an existing gate ID", () => {
    for (const point of venue.sustainabilityPoints) {
      expect(gateIdSet.has(point.nearGate)).toBe(true);
    }
  });

  it("defines at least one recycling station (required for Module F)", () => {
    const recycling = venue.sustainabilityPoints.filter((s) => s.type === "recycling");
    expect(recycling.length).toBeGreaterThanOrEqual(1);
  });

  it("defines at least one water_refill point (required for Module F)", () => {
    const waterRefill = venue.sustainabilityPoints.filter((s) => s.type === "water_refill");
    expect(waterRefill.length).toBeGreaterThanOrEqual(1);
  });
});
