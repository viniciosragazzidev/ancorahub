import { NextRequest, NextResponse } from "next/server";

import { drainLeadDistributionBacklog } from "@/features/lead-distribution/jobs";
import { processDutyPresenceReminders } from "@/features/lead-distribution/duty-presence";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One run at a time per process (26/10): Coolify fires every 2 minutes and a slow run used to get
// a second and a third one stacked on top, all fighting for the same DB sockets.
const RUNNING_KEY = Symbol.for("ancorahub.jobs.distribution.running");
const processState = globalThis as typeof globalThis & { [RUNNING_KEY]?: number };
const STALE_RUN_MS = 10 * 60_000;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const runningSince = processState[RUNNING_KEY];
  if (runningSince && Date.now() - runningSince < STALE_RUN_MS) {
    return NextResponse.json({ success: true, skipped: "previous_run_still_running", runningForMs: Date.now() - runningSince });
  }
  processState[RUNNING_KEY] = Date.now();
  try {
    return await runDistributionJob();
  } finally {
    processState[RUNNING_KEY] = undefined;
  }
}

async function runDistributionJob() {
  // The plantão link goes first (26/10): with the drain first, a slow backlog held every
  // reminder of the afternoon presencial for over 30 minutes.
  let dutyPresence: Awaited<ReturnType<typeof processDutyPresenceReminders>> | { enabled: boolean; error: true };
  let dutyPresenceFailed = false;
  try {
    dutyPresence = await processDutyPresenceReminders();
  } catch (error) {
    dutyPresenceFailed = true;
    console.error("[duty-presence] reminder sweep failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    dutyPresence = { enabled: true, error: true };
  }
  let result: Awaited<ReturnType<typeof drainLeadDistributionBacklog>> | null = null;
  let distributionFailed = false;
  try {
    result = await drainLeadDistributionBacklog({ maxBatches: 4 });
  } catch (error) {
    distributionFailed = true;
    console.error("[distribution-job] backlog drain failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
  }
  const success = !distributionFailed && !dutyPresenceFailed;
  return NextResponse.json({ success, result, dutyPresence }, { status: success ? 200 : 500 });
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(handleGET);
export const POST = backgroundRoute(handlePOST);
