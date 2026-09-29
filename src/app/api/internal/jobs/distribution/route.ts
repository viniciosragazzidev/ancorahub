import { NextRequest, NextResponse } from "next/server";

import { drainLeadDistributionBacklog } from "@/features/lead-distribution/jobs";
import { processDutyPresenceReminders } from "@/features/lead-distribution/duty-presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let result: Awaited<ReturnType<typeof drainLeadDistributionBacklog>> | null = null;
  let distributionFailed = false;
  try {
    result = await drainLeadDistributionBacklog({ maxBatches: 4 });
  } catch (error) {
    distributionFailed = true;
    console.error("[distribution-job] backlog drain failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
  }
  let dutyPresence: Awaited<ReturnType<typeof processDutyPresenceReminders>> | { enabled: boolean; error: true };
  let dutyPresenceFailed = false;
  try {
    dutyPresence = await processDutyPresenceReminders();
  } catch (error) {
    dutyPresenceFailed = true;
    console.error("[duty-presence] reminder sweep failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    dutyPresence = { enabled: true, error: true };
  }
  const success = !distributionFailed && !dutyPresenceFailed;
  return NextResponse.json({ success, result, dutyPresence }, { status: success ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
