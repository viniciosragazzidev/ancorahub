import { NextRequest, NextResponse } from "next/server";

import { runPriorityLeadDistribution } from "@/features/lead-distribution/jobs";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Via rápida dos leads quentes e mornos recém-qualificados (06/11): roda a cada minuto, separada da
// rodada pesada de /distribution. Com a fila acumulada, aquela rodada passou de 2 min e um lead
// quente esperava 15 min por um corretor livre (Damiana e Maria, 06/11 11:41 e 11:50).
const RUNNING_KEY = Symbol.for("ancorahub.jobs.distribution-priority.running");
const processState = globalThis as typeof globalThis & { [RUNNING_KEY]?: number };
const STALE_RUN_MS = 90_000;
// Orçamento próprio de 25 s dentro da passada; o teto garante que a rodada responda e libere a trava.
const PRIORITY_TIMEOUT_MS = 40_000;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const runningSince = processState[RUNNING_KEY];
  if (runningSince && Date.now() - runningSince < STALE_RUN_MS) {
    return NextResponse.json({ success: true, skipped: "previous_run_still_running", runningForMs: Date.now() - runningSince });
  }
  processState[RUNNING_KEY] = Date.now();
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const priority = await Promise.race([
      runPriorityLeadDistribution(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`priority passed ${PRIORITY_TIMEOUT_MS} ms`)), PRIORITY_TIMEOUT_MS); }),
    ]);
    return NextResponse.json({ success: true, priority, ms: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : "UnknownError";
    console.error("[distribution-priority-job] failed", { message });
    return NextResponse.json({ success: false, error: message, ms: Date.now() - startedAt }, { status: 500 });
  } finally {
    clearTimeout(timer);
    processState[RUNNING_KEY] = undefined;
  }
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

export const GET = backgroundRoute(withJobHeartbeat("distribution-priority", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("distribution-priority", handlePOST));
