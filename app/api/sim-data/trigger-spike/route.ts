/**
 * app/api/sim-data/trigger-spike/route.ts
 * POST /api/sim-data/trigger-spike
 *
 * Calls triggerSpike() to deterministically force a congestion event —
 * intended as a reliable live-demo button so the presenter can always
 * produce a dramatic crowd-spike on cue.
 *
 * Auth: requires a valid ops_staff session cookie. Returns 401 if the
 * caller has no verified session, 403 if the session role is not ops_staff.
 *
 * No request body required. Returns updated LiveState.
 *
 * Response: application/json — LiveState object
 *
 * Task 3.3 [MUST]
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerSpike } from "../../../../lib/simEngine";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Auth check ---
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Please log in as ops_staff." },
      { status: 401 }
    );
  }

  if (session.role !== "ops_staff") {
    return NextResponse.json(
      { error: "Forbidden. ops_staff role required." },
      { status: 403 }
    );
  }

  try {
    const state = triggerSpike();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[api/sim-data/trigger-spike] error:", err);
    return NextResponse.json(
      { error: "Failed to trigger spike." },
      { status: 500 }
    );
  }
}
