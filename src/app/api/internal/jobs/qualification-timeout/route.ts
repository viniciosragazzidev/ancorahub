import { NextRequest, NextResponse } from "next/server";

import { runQualificationTimeoutSweep } from "@/features/ai-agent/qualification-timeout-sweep";
import { runSlaSweep } from "@/features/leads/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [result, slaResult] = await Promise.all([
      runQualificationTimeoutSweep(),
      runSlaSweep(),
    ]);
    return NextResponse.json({ success: true, result, slaResult });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 180) : "unknown_error";
    console.error("[qualification-timeout-job] failed", { message });
    return NextResponse.json({ success: false, error: "Qualification timeout sweep unavailable" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
