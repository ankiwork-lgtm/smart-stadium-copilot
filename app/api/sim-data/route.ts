/**
 * app/api/sim-data/route.ts
 * GET /api/sim-data
 *
 * Advances the simulation by one tick and returns the current LiveState.
 * The UI polls this every ~5 s to update the crowd dashboard.
 *
 * Response: application/json — LiveState object
 *
 * Task 3.2 [MUST]
 */

import { NextResponse } from "next/server";
import { tick } from "../../../lib/simEngine";

export async function GET(): Promise<NextResponse> {
  try {
    const state = tick();
    return NextResponse.json(state);
  } catch (err) {
    console.error("[api/sim-data] tick error:", err);
    return NextResponse.json(
      { error: "Failed to advance simulation state." },
      { status: 500 }
    );
  }
}
