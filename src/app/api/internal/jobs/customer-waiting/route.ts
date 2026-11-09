import { NextRequest, NextResponse } from "next/server";

import { runCustomerWaitingSweep } from "@/features/customer-waiting/sweep";
import { runPostSaleAutoSweep } from "@/features/post-sale-audit/auto-sweep";
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
  // One deadline for the whole route (maxDuration 120 s): the régua only gets the time left (Vigia, 09/11).
  const routeStartedAt = Date.now();
  const result = await runCustomerWaitingSweep().catch((error) => {
    console.error("[customer-waiting cron] failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  });
  // Pós-venda R0 (cliente que volta a escrever): mesma cadência, desligada por empresa por padrão.
  const postSaleR0 = await runPostSaleR0Sweep().catch((error) => {
    console.error("[post-sale-r0 cron] failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  });
  // Pós-venda, régua automática R1 a R5 (Fase 4): só a cada 15 min (minutos 0 a 4 de cada quarto de hora),
  // desligada por empresa por padrão. Também falha sozinha.
  const remainingMs = 105_000 - (Date.now() - routeStartedAt);
  const postSaleAuto = remainingMs < 5_000 ? { skipped: "route_time_exhausted" as const } : await runPostSaleAutoSweep(new Date(), { budgetMs: Math.min(40_000, remainingMs) }).catch((error) => {
    console.error("[post-sale-auto cron] failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  });
  if (!result) return NextResponse.json({ success: false, error: "Customer waiting sweep unavailable", postSaleR0, postSaleAuto }, { status: 500 });
  return NextResponse.json({ success: true, result, postSaleR0, postSaleAuto });
}

async function handleGET(request: NextRequest) { return handle(request); }
async function handlePOST(request: NextRequest) { return handle(request); }

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("customer-waiting", handleGET));
export const POST = backgroundRoute(withJobHeartbeat("customer-waiting", handlePOST));
