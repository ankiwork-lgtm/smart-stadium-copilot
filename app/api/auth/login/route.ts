/**
 * app/api/auth/login/route.ts
 * POST /api/auth/login
 *
 * Accepts { pin: string, role: "ops_staff" } and, if the PIN is correct,
 * sets an httpOnly signed session cookie granting the requested role.
 *
 * Currently only the "ops_staff" role requires a PIN. Fans and volunteers
 * do not need a server session — their role is self-declared (lower trust).
 *
 * Response:
 *   200 { ok: true, role: "ops_staff" }  — on success (cookie set)
 *   400 { error: string }                — missing/invalid body
 *   401 { error: string }                — wrong PIN
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOpsPin, createSessionToken, makeSessionCookie } from "../../../../lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { pin, role } = body as Record<string, unknown>;

  if (role !== "ops_staff") {
    return NextResponse.json(
      { error: "Only ops_staff role requires login." },
      { status: 400 }
    );
  }

  if (typeof pin !== "string" || pin.length === 0) {
    return NextResponse.json({ error: "pin is required." }, { status: 400 });
  }

  if (!verifyOpsPin(pin)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const token = createSessionToken("ops_staff");
  const cookieHeader = makeSessionCookie(token);

  return NextResponse.json(
    { ok: true, role: "ops_staff" },
    { status: 200, headers: { "Set-Cookie": cookieHeader } }
  );
}
