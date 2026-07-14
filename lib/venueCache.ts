/**
 * lib/venueCache.ts
 *
 * Shared module-level cache for GET /api/venue responses.
 * Both CrowdDashboard and VenueMap call fetchVenueOnce() — keeping the
 * cache here ensures they share a single in-memory reference and the
 * network request is made at most once per page load.
 */

import type { VenueData } from "./types";

let _venueCache: VenueData | null = null;
let _venueCachePromise: Promise<VenueData> | null = null;

export async function fetchVenueOnce(): Promise<VenueData> {
  if (_venueCache) return _venueCache;
  if (_venueCachePromise) return _venueCachePromise;

  _venueCachePromise = fetch("/api/venue")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data: VenueData) => {
      _venueCache = data;
      return data;
    });

  return _venueCachePromise;
}
