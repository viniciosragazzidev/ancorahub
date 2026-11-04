import { NextRequest, NextResponse } from "next/server";

import { runCustomerWaitingSweep } from "@/features/customer-waiting/sweep";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, result: await runCustomerWaitingSweep() });
  } catch (error) {
    console.error("[customer-waiting cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Customer waiting sweep unavailable" }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("customer-waiting", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("customer-waiting", handlePOST));
