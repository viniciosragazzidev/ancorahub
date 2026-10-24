import { NextRequest, NextResponse } from "next/server";

import { runMetaConversionSender } from "@/features/meta-ads/meta-conversion-service";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends the lead stage events (Conversions API for CRM) of tenants that turned it on. */
async function handleGET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runMetaConversionSender({ limit: 100 });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[meta-conversions job] failed", error instanceof Error ? error.message.slice(0, 160) : "unknown_error");
    return NextResponse.json({ success: false, error: "Meta conversions job unavailable" }, { status: 500 });
  }
}

async function handlePOST(request: NextRequest) {
  return GET(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(handleGET);
export const POST = backgroundRoute(handlePOST);
