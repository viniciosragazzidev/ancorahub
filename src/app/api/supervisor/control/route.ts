import { NextResponse } from "next/server";

import { getSupervisorControlData } from "@/features/supervisor-workspace/control-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Sessão encerrada." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId) {
    return NextResponse.json({ error: "Painel indisponível para este perfil." }, { status: 403, headers: { "Cache-Control": "no-store, private" } });
  }
  let data: Awaited<ReturnType<typeof getSupervisorControlData>>;
  try {
    data = await getSupervisorControlData(context);
  } catch (error) {
    console.error("[supervisor-control] snapshot unavailable", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível atualizar o painel agora." }, { status: 503, headers: { "Cache-Control": "no-store, private" } });
  }
  if (!data) return NextResponse.json({ error: "Painel indisponível para este perfil." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, private" } });
}
