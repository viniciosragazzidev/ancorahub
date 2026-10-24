import { NextRequest, NextResponse } from "next/server";

import { syncBrokerWahaMessages } from "@/features/waha-cadence/sync";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncBrokerWahaMessages({ limit: 100 });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[waha-sync] failed", { errorCode: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return NextResponse.json({ success: false, error: "WAHA_SYNC_FAILED" }, { status: 502 });
  }
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
