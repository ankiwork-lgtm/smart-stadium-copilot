/**
 * app/api/auth/logout/route.ts
 * POST /api/auth/logout
 *
 * Clears the session cookie, ending the authenticated session.
 *
 * Response: 200 { ok: true }
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Set-Cookie": clearSessionCookie() } }
  );
}
