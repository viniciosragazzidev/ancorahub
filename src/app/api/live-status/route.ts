import { NextResponse } from "next/server";

import { getLiveStatuses } from "@/features/live-status/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status vivos do usuário da sessão (a faixa "Agora na operação" busca de novo a cada 60 s com a aba visível).
 * Nenhum parâmetro do cliente define tenant, papel ou recorte: tudo sai da sessão. Chave desligada: lista vazia.
 */
export async function GET() {
  const context = await getRequiredTenantContext();
  const payload = await getLiveStatuses(context);
  return NextResponse.json(
    payload ? { enabled: true, ...payload } : { enabled: false, statuses: [], seals: [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
