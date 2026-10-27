import { NextRequest, NextResponse } from "next/server";

import { runEngagementCollector } from "@/features/engagement/collector";
import { runTeamManagementG6Jobs } from "@/features/team-management/g6-jobs";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [result, teamManagement] = await Promise.all([
      runEngagementCollector(),
      runTeamManagementG6Jobs(),
    ]);
    return NextResponse.json({ success: true, result, teamManagement });
  } catch (error) {
    console.error("[engagement cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Engagement collector unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("engagement", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("engagement", handlePOST));
