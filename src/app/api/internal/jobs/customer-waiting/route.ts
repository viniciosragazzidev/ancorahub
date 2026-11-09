import { NextRequest, NextResponse } from "next/server";

import { runCustomerWaitingSweep } from "@/features/customer-waiting/sweep";
import { runPostSaleR0Sweep } from "@/features/post-sale-audit/r0-sweep";
import { backgroundRoute } from "@/shared/db/background-pool";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isBearerAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // Each sweep fails alone: an error in "cliente aguardando" never stops the R0 sweep, and vice versa (Vigia).
  const result = await runCustomerWaitingSweep().catch((error) => {
    console.error("[customer-waiting cron] failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  });
  // Pós-venda R0 (cliente que volta a escrever): mesma cadência, desligada por empresa por padrão.
  const postSaleR0 = await runPostSaleR0Sweep().catch((error) => {
    console.error("[post-sale-r0 cron] failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  });
  if (!result) return NextResponse.json({ success: false, error: "Customer waiting sweep unavailable", postSaleR0 }, { status: 500 });
  return NextResponse.json({ success: true, result, postSaleR0 });
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("customer-waiting", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("customer-waiting", handlePOST));
