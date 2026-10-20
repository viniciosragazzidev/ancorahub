import { NextRequest, NextResponse } from "next/server";

import { runMetaConversionSender } from "@/features/meta-ads/meta-conversion-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends the lead stage events (Conversions API for CRM) of tenants that turned it on. */
export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  return GET(request);
}
