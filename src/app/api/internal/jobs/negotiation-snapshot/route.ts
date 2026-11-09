import { NextRequest, NextResponse } from "next/server";

import { runNegotiationSnapshotJob } from "@/features/negotiations/negotiation-snapshot";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Foto diária do Fechamento (Coolify, 02:55 UTC = 23:55 de SP): ver docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, result: await runNegotiationSnapshotJob() });
  } catch (error) {
    console.error("[negotiation-snapshot cron] failed", error instanceof Error ? error.message.slice(0, 200) : "unknown_error");
    return NextResponse.json({ success: false, error: "Negotiation snapshot unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("negotiation-snapshot", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("negotiation-snapshot", handlePOST));
