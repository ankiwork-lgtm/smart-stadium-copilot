/**
 * lib/rateLimiter.ts
 * Lightweight in-process token-bucket rate limiter.
 *
 * Usage (one limiter instance per route):
 *   const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
 *   const { allowed, retryAfterMs } = limiter.check(ip);
 *
 * Design:
 *  - Fixed-window counter per key (IP string).
 *  - No external dependency — works in any Node.js/Edge runtime.
 *  - Entries are garbage-collected after their window expires + 1 window of
 *    grace, so the Map never grows unboundedly over a long server session.
 *  - Thread-safe for single-process Node.js (event-loop concurrency model).
 *
 * Limitations (acceptable for a demo / single-process deployment):
 *  - State is per-process; a multi-instance serverless deployment would need
 *    a shared store (e.g. Upstash Redis) for cross-instance limiting.
 *  - IP extraction relies on the caller supplying the correct header;
 *    spoofing is possible without a trusted proxy layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RateLimiterOptions = {
  /** Maximum number of requests allowed per window per key. */
  limit: number;
  /** Length of each window in milliseconds. */
  windowMs: number;
};

export type CheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

type BucketEntry = {
  count: number;
  windowStart: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs } = options;
  const buckets = new Map<string, BucketEntry>();

  /**
   * Check and record a request for the given key (typically an IP address).
   * Returns { allowed: true } if the request is within the limit, or
   * { allowed: false, retryAfterMs } when the limit is exceeded.
   */
  function check(key: string): CheckResult {
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      // New window — reset counter
      buckets.set(key, { count: 1, windowStart: now });
      gc(now);
      return { allowed: true };
    }

    if (entry.count >= limit) {
      const retryAfterMs = windowMs - (now - entry.windowStart);
      return { allowed: false, retryAfterMs };
    }

    entry.count += 1;
    return { allowed: true };
  }

  /**
   * Remove entries whose window has expired by more than one full window
   * (i.e. they haven't been seen in 2× windowMs). Called on every new-window
   * reset to amortise GC cost across requests.
   */
  function gc(now: number): void {
    const expiry = 2 * windowMs;
    for (const [key, entry] of buckets.entries()) {
      if (now - entry.windowStart > expiry) {
        buckets.delete(key);
      }
    }
  }

  // Expose bucket size for testing only — not part of the public API contract.
  function _bucketSize(): number {
    return buckets.size;
  }

  return { check, _bucketSize };
}

// ---------------------------------------------------------------------------
// IP extraction helper
// ---------------------------------------------------------------------------

/**
 * Returns the best-effort client IP from a Next.js request.
 * Reads x-forwarded-for (set by Vercel / most reverse proxies) and falls
 * back to a sentinel string so rate limiting still applies if the header
 * is absent (rather than skipping it entirely).
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; first entry is the client
    return forwarded.split(",")[0].trim();
  }
  // Fallback: no IP header — use a fixed key so the limiter still applies
  return "unknown";
}
