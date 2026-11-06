import { NextRequest, NextResponse } from "next/server";

import { drainLeadDistributionBacklog, runPriorityLeadDistribution } from "@/features/lead-distribution/jobs";
import { processDutyPresenceReminders } from "@/features/lead-distribution/duty-presence";
import { processDutyShiftReminders } from "@/features/lead-distribution/duty-shift-reminders";
import { backgroundRoute } from "@/shared/db/background-pool";
import { readJobHeartbeats, withJobHeartbeat } from "@/features/live-status/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One run at a time per process (26/10): Coolify fires every 2 minutes and a slow run used to get
// a second and a third one stacked on top, all fighting for the same DB sockets.
const RUNNING_KEY = Symbol.for("ancorahub.jobs.distribution.running");
const processState = globalThis as typeof globalThis & { [RUNNING_KEY]?: number };
const STALE_RUN_MS = 4 * 60_000;

// Each phase has a ceiling (26/10): a run hung for 10 minutes on an await that never returned and,
// holding the guard above, every following run was skipped. Past the ceiling the run answers and
// frees the guard; the hung work is left behind and the next run starts clean.
const DUTY_PRESENCE_TIMEOUT_MS = 60_000;
const DUTY_SHIFT_REMINDER_TIMEOUT_MS = 15_000;
const DRAIN_TIMEOUT_MS = 150_000;
// Recently qualified hot/warm leads without a broker (03/11): its own budget is 25 s, the ceiling 30 s.
const PRIORITY_TIMEOUT_MS = 30_000;
const DEDICATED_PRIORITY_FRESH_MS = 3 * 60_000;

class PhaseTimeoutError extends Error {
  constructor(phase: string, ms: number) {
    super(`${phase} passed ${ms} ms`);
    this.name = "PhaseTimeoutError";
  }
}

/** How long each phase of the current run took; returned in the response so the task log shows it (29/10). */
type PhaseTimes = Record<string, number>;

async function timedPhase<T>(phase: string, timeoutMs: number, work: () => Promise<T>, times?: PhaseTimes): Promise<T> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PhaseTimeoutError(phase, timeoutMs)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    if (times) times[phase] = Date.now() - startedAt;
    console.info("[distribution-job] phase", { phase, ms: Date.now() - startedAt });
  }
}

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
  const phaseMs: PhaseTimes = {};
  const errors: Record<string, string> = {};
  // Hot and warm leads qualified in the last hours go before everything (03/11): they must have a
  // broker within 3 minutes, and behind the plantão phases and the backlog one waited 30 minutes.
  let priority: Awaited<ReturnType<typeof runPriorityLeadDistribution>> | { skipped: "dedicated_job_running" } | null = null;
  let priorityFailed = false;
  try {
    // With /distribution-priority running every minute (06/11), this pass only covers for it when it stopped.
    priority = await dedicatedPriorityJobIsRunning()
      ? { skipped: "dedicated_job_running" }
      : await timedPhase("priority", PRIORITY_TIMEOUT_MS, () => runPriorityLeadDistribution(), phaseMs);
  } catch (error) {
    priorityFailed = true;
    errors.priority = describeError(error);
    console.error("[distribution-job] priority pass failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
  }
  // The plantão link goes next (26/10): with the drain first, a slow backlog held every
  // reminder of the afternoon presencial for over 30 minutes.
  let dutyPresence: Awaited<ReturnType<typeof processDutyPresenceReminders>> | { enabled: boolean; error: true };
  let dutyPresenceFailed = false;
  try {
    dutyPresence = await timedPhase("duty_presence", DUTY_PRESENCE_TIMEOUT_MS, () => processDutyPresenceReminders(), phaseMs);
  } catch (error) {
    dutyPresenceFailed = true;
    errors.duty_presence = describeError(error);
    console.error("[duty-presence] reminder sweep failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    dutyPresence = { enabled: true, error: true };
  }
  let dutyShiftReminder: Awaited<ReturnType<typeof processDutyShiftReminders>> | { enabled: boolean; error: true };
  let dutyShiftReminderFailed = false;
  try {
    dutyShiftReminder = await timedPhase("duty_shift_reminder_24h", DUTY_SHIFT_REMINDER_TIMEOUT_MS, () => processDutyShiftReminders(), phaseMs);
  } catch (error) {
    dutyShiftReminderFailed = true;
    errors.duty_shift_reminder_24h = describeError(error);
    console.error("[duty-shift-reminder] sweep failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    dutyShiftReminder = { enabled: true, error: true };
  }
  let result: Awaited<ReturnType<typeof drainLeadDistributionBacklog>> | null = null;
  let distributionFailed = false;
  try {
    result = await timedPhase("drain", DRAIN_TIMEOUT_MS, () => drainLeadDistributionBacklog({ maxBatches: 4 }), phaseMs);
  } catch (error) {
    distributionFailed = true;
    errors.drain = describeError(error);
    console.error("[distribution-job] backlog drain failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
  }
  const success = !distributionFailed && !dutyPresenceFailed && !dutyShiftReminderFailed && !priorityFailed;
  return NextResponse.json({ success, priority, result, dutyPresence, dutyShiftReminder, phaseMs, ...(Object.keys(errors).length ? { errors } : {}) }, { status: success ? 200 : 500 });
}

/** The minute-by-minute priority job answered fine in the last 3 minutes. Any doubt runs the pass here. */
async function dedicatedPriorityJobIsRunning() {
  try {
    const heartbeat = (await readJobHeartbeats()).get("distribution-priority");
    return Boolean(heartbeat && heartbeat.outcome === "ok" && Date.now() - new Date(heartbeat.finishedAt).getTime() < DEDICATED_PRIORITY_FRESH_MS);
  } catch {
    return false;
  }
}

/** Name and a short message only: never a stack or data. */
function describeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : "UnknownError";
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("distribution", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("distribution", handlePOST));
