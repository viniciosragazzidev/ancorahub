import { NextRequest, NextResponse } from "next/server";

import { runEngagementCollector } from "@/features/engagement/collector";
import { runTeamManagementG6Jobs } from "@/features/team-management/g6-jobs";

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

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
