/**
 * lib/auth.ts
 *
 * Lightweight server-side session auth using HMAC-SHA256 signed tokens stored
 * in an httpOnly cookie. No external dependencies — uses Node.js built-in
 * `crypto` module.
 *
 * Token format (base64url-encoded JSON + HMAC signature):
 *   "<base64url(payload)>.<hex-signature>"
 *
 * Where payload is: { role: UserRole, iat: number }
 *
 * The session secret is read from the SESSION_SECRET env var. In development,
 * a fallback secret is used so the app starts without configuration. Set a
 * strong random value in production.
 *
 * OPS_STAFF_PIN: the PIN required to obtain an ops_staff session. Defaults to
 * "1234" for demo purposes; set OPS_STAFF_PIN in .env.local for your own value.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { UserRole } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "stadium_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-insecure-secret-change-in-production";

const OPS_STAFF_PIN = process.env.OPS_STAFF_PIN ?? "1234";

/** Session cookie max-age in seconds (8 hours). */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type SessionPayload = {
  role: UserRole;
  /** Issued-at timestamp (ms since epoch). */
  iat: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
}

function b64url(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function fromB64url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a signed session token for the given role.
 * Returns the token string to be stored in a cookie.
 */
export function createSessionToken(role: UserRole): string {
  const payload: SessionPayload = { role, iat: Date.now() };
  const encoded = b64url(JSON.stringify(payload));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verifies a session token and returns the payload if valid, or null if the
 * token is missing, malformed, or has an invalid signature.
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // Constant-time comparison to prevent timing attacks
  const expected = sign(encoded);
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(fromB64url(encoded)) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies the ops_staff PIN using a constant-time comparison.
 * Returns true if the PIN matches.
 */
export function verifyOpsPin(pin: string): boolean {
  const given = Buffer.from(pin, "utf8");
  const expected = Buffer.from(OPS_STAFF_PIN, "utf8");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** The Set-Cookie header value for a new ops session. */
export function makeSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Path=/`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}

/** The Set-Cookie header value that clears the session cookie. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
