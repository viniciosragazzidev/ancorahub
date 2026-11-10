import { NextRequest, NextResponse } from "next/server";

import { runDailyLeadsReportJob } from "@/features/reports/daily-leads-report";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Relatório das 18h por WhatsApp (Coolify, 21:00 UTC = 18h de SP): ver docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDailyLeadsReportJob();
    // Falha de envio vira 500 para o heartbeat marcar erro (09/11 quebrou em silêncio com "ok").
    const failed = !result.skipped && result.results.some((item) => item.reason === "failed");
    return NextResponse.json({ success: !failed, result }, { status: failed ? 500 : 200 });
  } catch (error) {
    console.error("[daily-report-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

export const GET = backgroundRoute(withJobHeartbeat("daily-report", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("daily-report", handlePOST));
