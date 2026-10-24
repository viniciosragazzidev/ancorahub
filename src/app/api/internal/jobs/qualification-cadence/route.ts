import { NextRequest, NextResponse } from "next/server";

import { runQualificationCadenceJob } from "@/features/qualification-turbo/cadence-job";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Reminder cadence of the qualification (Coolify, every 2 minutes): see docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runQualificationCadenceJob();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[qualification-cadence-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
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
