import { NextRequest, NextResponse } from "next/server";

import { runStaleStageJob } from "@/features/leads/stale-stage-sweep";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Regra de chat parado (Coolify, todo dia às 9h de SP): ver docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runStaleStageJob();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[stale-stages-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

export const GET = backgroundRoute(withJobHeartbeat("stale-stages", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("stale-stages", handlePOST));
