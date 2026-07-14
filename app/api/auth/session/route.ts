/**
 * app/api/auth/session/route.ts
 * GET /api/auth/session
 *
 * Returns the current session role from the signed cookie, or null if there
 * is no valid session. Used by client components to hydrate auth state.
 *
 * Response:
 *   200 { role: "ops_staff" }  — authenticated session present
 *   200 { role: null }          — no session / expired / tampered
 */

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  return NextResponse.json(
    { role: payload?.role ?? null },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
