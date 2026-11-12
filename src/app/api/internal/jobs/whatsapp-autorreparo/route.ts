import { NextRequest, NextResponse } from "next/server";

import { runAvisoVesperaReconexao } from "@/features/whatsapp-autorreparo/aviso";
import { runVigiaSaude } from "@/features/whatsapp-autorreparo/vigia";
import { withJobHeartbeat } from "@/features/live-status/heartbeat";
import { backgroundRoute } from "@/shared/db/background-pool";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vigia de saúde e aviso de véspera. Os dois ficam desligados enquanto a flag global estiver off. */
async function handle(request: NextRequest) {
  if (!isBearerAuthorized(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const vigia = await runVigiaSaude();
    const aviso = await runAvisoVesperaReconexao();
    return NextResponse.json({ success: true, vigia, aviso });
  } catch (error) {
    console.error("[whatsapp-autorreparo-job] failed", error instanceof Error ? { name: error.name, message: error.message.slice(0, 180) } : { name: "UnknownError" });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export const GET = backgroundRoute(withJobHeartbeat("whatsapp-autorreparo", handle));
export const POST = backgroundRoute(withJobHeartbeat("whatsapp-autorreparo", handle));
