import { NextRequest, NextResponse } from "next/server";

import { runQualificationTimeoutSweep } from "@/features/ai-agent/qualification-timeout-sweep";
import { runUnansweredInboundRecovery } from "@/features/ai-agent/unanswered-recovery";
import { runColdLeadRequalificationSweep } from "@/features/ai-qualification/cold-lead-requalification";
import { runSlaSweep } from "@/features/leads/sla";
import { flowEffectHandlers } from "@/features/attendance-flows/handlers";
import { attendanceFlowsEnabled, wakeDueRuns } from "@/features/attendance-flows/runtime";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

/**
 * DEC-127: wakes attendance flow runs whose wait is over (only with the switch
 * on). Waking only follows exits (timeouts, agent result, distribution); an
 * agent is never started here.
 */
async function wakeAttendanceRuns() {
  if (!(await attendanceFlowsEnabled())) return 0;
  return wakeDueRuns((run) => ({
    ...flowEffectHandlers({ tenantId: run.tenantId, leadId: run.leadId, actorUserId: "", legacyIntake: async () => undefined }),
    async startAgent() {
      return { started: false };
    },
  }));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobDeadlineAt = Date.now() + maxDuration * 1_000;
    const result = await runQualificationTimeoutSweep();
    // Timeout owns the 15-minute boundary; recovery must see its new qualification/conversation state.
    const unansweredRecovery = await runUnansweredInboundRecovery({ deadlineAt: jobDeadlineAt }).catch((error) => {
      console.error("[unanswered-recovery] failed", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
      return null;
    });
    const [slaResult, attendanceRuns, coldLeadRequalification] = await Promise.all([
      runSlaSweep(),
      wakeAttendanceRuns().catch((error) => {
        console.error("[attendance-flows] wake failed", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
        return -1;
      }),
      runColdLeadRequalificationSweep(),
    ]);
    return NextResponse.json({ success: true, result, slaResult, attendanceRuns, coldLeadRequalification, unansweredRecovery });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 180) : "unknown_error";
    console.error("[qualification-timeout-job] failed", { message });
    return NextResponse.json({ success: false, error: "Qualification timeout sweep unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("qualification-timeout", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("qualification-timeout", handlePOST));
