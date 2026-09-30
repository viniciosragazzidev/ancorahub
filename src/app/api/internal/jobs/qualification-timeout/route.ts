import { NextRequest, NextResponse } from "next/server";

import { runQualificationTimeoutSweep } from "@/features/ai-agent/qualification-timeout-sweep";
import { runColdLeadReactivationSweep } from "@/features/ai-qualification/cold-lead-reactivation-sweep";
import { runSlaSweep } from "@/features/leads/sla";
import { flowEffectHandlers } from "@/features/attendance-flows/handlers";
import { attendanceFlowsEnabled, wakeDueRuns } from "@/features/attendance-flows/runtime";

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
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [result, slaResult, attendanceRuns, coldLeadReactivation] = await Promise.all([
      runQualificationTimeoutSweep(),
      runSlaSweep(),
      wakeAttendanceRuns().catch((error) => {
        console.error("[attendance-flows] wake failed", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
        return -1;
      }),
      runColdLeadReactivationSweep(),
    ]);
    return NextResponse.json({ success: true, result, slaResult, attendanceRuns, coldLeadReactivation });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 180) : "unknown_error";
    console.error("[qualification-timeout-job] failed", { message });
    return NextResponse.json({ success: false, error: "Qualification timeout sweep unavailable" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
