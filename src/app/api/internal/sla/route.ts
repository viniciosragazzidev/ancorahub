import { NextRequest, NextResponse } from "next/server";
import { runSlaSweep } from "@/features/leads/sla";
import { runFeedbackSlaSweep } from "@/features/leads/feedback-sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const [result, feedback] = await Promise.all([runSlaSweep(), runFeedbackSlaSweep()]);
    return NextResponse.json({ success: true, result, feedback });
  } catch (error) {
    console.error("[SLA cron] failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ success: false, error: "SLA sweep unavailable" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
