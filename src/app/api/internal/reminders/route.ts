import { NextResponse } from "next/server";
import { createLeadFeedbackReminders } from "@/features/leads/feedback-reminders";
import { createClientRenewalReminders } from "@/features/customers/renewal-reminders";
import { runTaskOverdueSweep } from "@/features/leads/task-overdue-sweep";
import { runClientReturnedAlerts } from "@/features/leads/client-returned-alerts";
import { remindPendingDutyPhotos } from "@/features/lead-distribution/duty-photo-reminders";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleGET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const [feedback, renewal, overdueTasks, clientReturned, dutyPhotos] = await Promise.all([
      createLeadFeedbackReminders(),
      createClientRenewalReminders(),
      runTaskOverdueSweep(),
      runClientReturnedAlerts(),
      remindPendingDutyPhotos(),
    ]);
    return NextResponse.json({ success: true, feedback, renewal, overdueTasks, clientReturned, dutyPhotos });
  } catch (error) {
    console.error("[Reminders cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Reminders unavailable" }, { status: 500 });
  }
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("reminders", handleGET));
