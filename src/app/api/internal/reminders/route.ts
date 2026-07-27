import { NextResponse } from "next/server";
import { createLeadFeedbackReminders } from "@/features/leads/feedback-reminders";
import { createClientRenewalReminders } from "@/features/customers/renewal-reminders";
import { runTaskOverdueSweep } from "@/features/leads/task-overdue-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const [feedback, renewal, overdueTasks] = await Promise.all([
      createLeadFeedbackReminders(),
      createClientRenewalReminders(),
      runTaskOverdueSweep(),
    ]);
    return NextResponse.json({ success: true, feedback, renewal, overdueTasks });
  } catch (error) {
    console.error("[Reminders cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Reminders unavailable" }, { status: 500 });
  }
}
