import { NextRequest, NextResponse } from "next/server";

import { runAutoSaleSweep } from "@/features/auto-sale/job";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: NextRequest) {
  if (!isBearerAuthorized(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAutoSaleSweep();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[auto-sale cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Auto sale sweep unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs e webhooks usam as conexões dos robôs, nunca as das telas (24/10).
export const GET = backgroundRoute(withJobHeartbeat("auto-sale", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("auto-sale", handlePOST));
