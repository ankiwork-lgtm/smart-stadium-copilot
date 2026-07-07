/**
 * app/api/sim-data/trigger-spike/route.ts
 * POST /api/sim-data/trigger-spike
 *
 * Calls triggerSpike() to deterministically force a congestion event —
 * intended as a reliable live-demo button so the presenter can always
 * produce a dramatic crowd-spike on cue.
 *
 * No request body required. Returns updated LiveState.
 *
 * Response: application/json — LiveState object
 *
 * Task 3.3 [MUST]
 */

import { NextResponse } from "next/server";
import { triggerSpike } from "../../../../lib/simEngine";

export async function POST(): Promise<NextResponse> {
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
