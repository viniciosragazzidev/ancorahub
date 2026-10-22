import { NextRequest, NextResponse } from "next/server";

import { runOperatorCatalogJob } from "@/features/operator-catalog/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Catalogs the operator files waiting (Coolify, every 5 minutes): see docs/runbooks/coolify-scheduled-tasks.md. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runOperatorCatalogJob();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[operator-catalog-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
