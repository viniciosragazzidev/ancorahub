import { NextRequest, NextResponse } from "next/server";
import { runSlaSweep } from "@/features/leads/sla";
import { runFeedbackSlaSweep } from "@/features/leads/feedback-sla";
import { runQualificationTimeoutSweep } from "@/features/ai-agent/qualification-timeout-sweep";
import { runSaleRegistrationReminderSweep } from "@/features/leads/sale-registration-reminder";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!isBearerAuthorized(request, secret)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const [result, feedback, qualTimeout, saleReminder] = await Promise.all([
      runSlaSweep(),
      runFeedbackSlaSweep(),
      runQualificationTimeoutSweep(),
      // Lembrete de registrar a venda de lead Convertido (11/11): 1, 3 e 5 dias depois, em horário comercial.
      runSaleRegistrationReminderSweep(),
    ]);
    return NextResponse.json({ success: true, result, feedback, qualTimeout, saleReminder });
  } catch (error) {
    console.error("[SLA cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "SLA sweep unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("sla", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("sla", handlePOST));
