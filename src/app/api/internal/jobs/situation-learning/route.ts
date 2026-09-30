import { NextRequest, NextResponse } from "next/server";

import { runSituationLearningJob } from "@/features/situation-learning/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Learning of new situations (Coolify, every 30 minutes): see docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSituationLearningJob();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[situation-learning-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
