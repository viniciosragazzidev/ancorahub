import { NextRequest, NextResponse } from "next/server";

import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleGET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    // Up to 12 per run: a burst of presence calls by the company number goes
    // out a few seconds apart (it waits for its turn) instead of 3 a minute.
    const result = await processMetaOutboundBatch(12);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[WhatsApp outbound job] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Outbound job unavailable" }, { status: 500 });
  }
}

async function handlePOST(request: NextRequest) {
  return GET(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("whatsapp", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("whatsapp", handlePOST));
