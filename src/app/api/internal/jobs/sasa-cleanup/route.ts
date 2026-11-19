import { NextRequest, NextResponse } from "next/server";

import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { purgeOldSasaCommands } from "@/features/sasa/store";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Limpeza da Sasá (D5): apaga o texto dito e a resposta dos pedidos com mais de 90 dias; a linha fica como
 * trilha (quem, quando, ferramenta, resultado). Até 5 lotes de 5.000 por rodada. Idempotente.
 * Scheduled Task do Coolify: docs/runbooks/coolify-scheduled-tasks.md.
 */
async function handle(request: NextRequest) {
  if (!isBearerAuthorized(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    let purged = 0;
    for (let round = 0; round < 5; round += 1) {
      const result = await purgeOldSasaCommands();
      purged += result.purged;
      if (result.purged < 5_000) break;
    }
    return NextResponse.json({ success: true, purged });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/sasa_commands/.test(message) && /does not exist/.test(message)) return NextResponse.json({ success: true, skipped: "table_missing" });
    console.error("[sasa-cleanup] failed", error);
    return NextResponse.json({ success: false, error: "cleanup_failed" }, { status: 500 });
  }
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const GET = backgroundRoute(withJobHeartbeat("sasa-cleanup", handle));
export const POST = backgroundRoute(withJobHeartbeat("sasa-cleanup", handle));
