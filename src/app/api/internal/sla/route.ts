import { NextRequest, NextResponse } from "next/server";
import { runSlaSweep } from "@/features/leads/sla";
import { runFeedbackSlaSweep } from "@/features/leads/feedback-sla";
import { runQualificationTimeoutSweep } from "@/features/ai-agent/qualification-timeout-sweep";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const [result, feedback, qualTimeout] = await Promise.all([
      runSlaSweep(),
      runFeedbackSlaSweep(),
      runQualificationTimeoutSweep(),
    ]);
    return NextResponse.json({ success: true, result, feedback, qualTimeout });
  } catch (error) {
    console.error("[SLA cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "SLA sweep unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(handleGET);
export const POST = backgroundRoute(handlePOST);
