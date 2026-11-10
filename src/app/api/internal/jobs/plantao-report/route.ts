import { NextRequest, NextResponse } from "next/server";

import { runPlantaoReportJob } from "@/features/reports/plantao-report";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isBearerAuthorized(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, result: await runPlantaoReportJob() });
  } catch (error) {
    console.error("[plantao-report-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 180) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export const GET = backgroundRoute(withJobHeartbeat("plantao-report", handle));
export const POST = backgroundRoute(withJobHeartbeat("plantao-report", handle));
