/**
 * lib/__tests__/rateLimiter.test.ts
 *
 * Unit tests for lib/rateLimiter.ts
 *
 * Covers:
 *  - createRateLimiter: allows requests within the limit
 *  - createRateLimiter: blocks the request that exceeds the limit
 *  - createRateLimiter: retryAfterMs is positive and ≤ windowMs
 *  - createRateLimiter: resets counter when the window rolls over
 *  - createRateLimiter: keys are independent (different IPs don't share quota)
 *  - createRateLimiter: GC removes expired entries
 *  - getClientIp: returns first x-forwarded-for entry
 *  - getClientIp: falls back to "unknown" when header is absent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRateLimiter, getClientIp } from "../rateLimiter";

// ---------------------------------------------------------------------------
// createRateLimiter
// ---------------------------------------------------------------------------

describe("createRateLimiter()", () => {
  it("allows requests up to the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("ip-1")).toEqual({ allowed: true });
    expect(limiter.check("ip-1")).toEqual({ allowed: true });
    expect(limiter.check("ip-1")).toEqual({ allowed: true });
  });

  it("blocks the request that would exceed the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    limiter.check("ip-1");
    limiter.check("ip-1");
    limiter.check("ip-1");
    const result = limiter.check("ip-1");
    expect(result.allowed).toBe(false);
  });

  it("returns a positive retryAfterMs ≤ windowMs on block", () => {
    const WINDOW = 10_000;
    const limiter = createRateLimiter({ limit: 1, windowMs: WINDOW });
    limiter.check("ip-1");
    const result = limiter.check("ip-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(WINDOW);
    }
  });

  it("treats different IP keys as independent buckets", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("ip-a");
    limiter.check("ip-a");
    // ip-a is exhausted, ip-b should still be allowed
    expect(limiter.check("ip-a").allowed).toBe(false);
    expect(limiter.check("ip-b").allowed).toBe(true);
  });

  it("resets the counter after the window expires", () => {
    vi.useFakeTimers();
    const WINDOW = 5_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: WINDOW });

    limiter.check("ip-1");
    limiter.check("ip-1");
    expect(limiter.check("ip-1").allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(WINDOW + 1);

    expect(limiter.check("ip-1").allowed).toBe(true);
    vi.useRealTimers();
  });

  it("GC prunes entries that are older than 2× windowMs", () => {
    vi.useFakeTimers();
    const WINDOW = 1_000;
    const limiter = createRateLimiter({ limit: 5, windowMs: WINDOW });

    // Create an entry for ip-old
    limiter.check("ip-old");
    expect(limiter._bucketSize()).toBe(1);

    // Advance past 2× window so the entry is stale
    vi.advanceTimersByTime(WINDOW * 2 + 1);

    // A new request for a different IP triggers GC
    limiter.check("ip-new");
    expect(limiter._bucketSize()).toBe(1); // only ip-new remains

    vi.useRealTimers();
  });

  it("a limit of 1 allows exactly one request before blocking", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("solo").allowed).toBe(true);
    expect(limiter.check("solo").allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

describe("getClientIp()", () => {
  function makeReq(xForwardedFor: string | null) {
    return {
      headers: {
        get: (name: string) => (name === "x-forwarded-for" ? xForwardedFor : null),
      },
    };
  }

  it("returns the first IP from a single-entry x-forwarded-for header", () => {
    expect(getClientIp(makeReq("203.0.113.5"))).toBe("203.0.113.5");
  });

  it("returns the first IP from a comma-separated x-forwarded-for list", () => {
    expect(getClientIp(makeReq("203.0.113.5, 10.0.0.1, 192.168.1.1"))).toBe("203.0.113.5");
  });

  it("trims whitespace around the extracted IP", () => {
    expect(getClientIp(makeReq("  203.0.113.5  , 10.0.0.1"))).toBe("203.0.113.5");
  });

  it("returns 'unknown' when x-forwarded-for header is absent", () => {
    expect(getClientIp(makeReq(null))).toBe("unknown");
  });
});
