import { requireCallAncoraDirectorAccess } from "@/features/call-ancora/director-access";
import { readCallAncoraCalls } from "@/features/call-ancora/report";
import { countCalls, REPORT_PERIODS, summarizeBrokers, type ReportPeriod } from "@/features/call-ancora/report-rules";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";
import { AuthenticationError } from "@/shared/auth/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store, max-age=0" };

/**
 * Painel do diretor: sem `brokerId`, os corretores que usaram o Call Âncora no período;
 * com `brokerId`, o histórico de ligações dele. Somente leitura.
 */
export async function GET(request: Request) {
  try {
    const context = await requireCallAncoraDirectorAccess();
    if (!context) return Response.json({ error: "Só o diretor vê o painel do Call Âncora." }, { status: 403, headers: noStore });
    const url = new URL(request.url);
    const requested = url.searchParams.get("period") ?? "7d";
    const period: ReportPeriod = requested in REPORT_PERIODS ? requested as ReportPeriod : "7d";
    const brokerId = url.searchParams.get("brokerId")?.slice(0, 120) || undefined;

    const calls = await readCallAncoraCalls({ tenantId: context.tenantId, period, brokerId, limit: brokerId ? 300 : 2000 });
    const inSession = new Set(callAncoraSessionStore.activeOwnerIds(context.tenantId));
    if (brokerId) {
      return Response.json({
        period,
        broker: { brokerId, brokerName: calls[0]?.brokerName ?? null, inSessionNow: inSession.has(brokerId), ...countCalls(calls) },
        calls,
      }, { headers: noStore });
    }
    return Response.json({ period, totals: countCalls(calls), brokers: summarizeBrokers(calls, inSession) }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "Faça login para abrir o Call Âncora." }, { status: 401, headers: noStore });
    console.error("Painel do Call Âncora indisponível", error instanceof Error ? error.message : "erro inesperado");
    return Response.json({ error: "Não foi possível carregar o painel. Tente novamente." }, { status: 500, headers: noStore });
  }
}
