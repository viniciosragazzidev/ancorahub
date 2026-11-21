import { NextRequest, NextResponse } from "next/server";

import { runQualificationCadenceJob } from "@/features/qualification-turbo/cadence-job";
import { runRecoveryCadenceJob } from "@/features/lead-recovery/cadence-job";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Reminder cadence of the qualification (Coolify, every 2 minutes): see docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runQualificationCadenceJob();
    // Cadência única de recuperação (fase 3): desligada por padrão; só age com a empresa ligada e a conferência jurídica registrada.
    const recovery = await runRecoveryCadenceJob().catch((error) => {
      console.error("[qualification-cadence-job] recovery_failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
      return { failed: true as const };
    });
    return NextResponse.json({ success: true, result, recovery });
  } catch (error) {
    console.error("[qualification-cadence-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) {
  return handle(request);
}

async function handlePOST(request: NextRequest) {
  return handle(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("qualification-cadence", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("qualification-cadence", handlePOST));
