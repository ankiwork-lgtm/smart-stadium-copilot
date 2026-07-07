/**
 * app/api/venue/route.ts
 * GET /api/venue
 *
 * Returns the static venue data from data/venue.json.
 * Cached at the CDN edge — no server computation needed.
 *
 * Response: application/json — VenueData
 *
 * Task 3.6 [MUST]
 */

import { NextResponse } from "next/server";
import venueJson from "../../../data/venue.json";
import type { VenueData } from "../../../lib/types";

const venue = venueJson as VenueData;

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(venue, {
    headers: {
      // Static file — safe to cache for the duration of a match day
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
    },
  });
}
