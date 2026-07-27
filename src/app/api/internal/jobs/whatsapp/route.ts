import { NextRequest, NextResponse } from "next/server";

import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processMetaOutboundBatch(10);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[WhatsApp outbound job] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "Outbound job unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
