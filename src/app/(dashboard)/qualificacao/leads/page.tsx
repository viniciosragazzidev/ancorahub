import { DashboardHeader } from "@/components/dashboard-header";
import { LiteUrlSelect } from "@/components/lite/controls/url-select";
import litePage from "@/components/lite/page/lite-page.module.css";
import { EntriesView } from "@/features/dashboard/components/director-lite/entries-view";
import { businessDaysBack, businessTurnStart } from "@/features/dashboard/essential/business-window";
import { getEntriesByTurn } from "@/features/dashboard/entries/entries-by-turn";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { QualificationLeadsWorkspace } from "@/features/lead-journey/components/qualification-leads-workspace";
import { listQualificationLeads, QUALIFICATION_LEADS_LIMIT } from "@/features/lead-journey/queries";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { AuthorizationError } from "@/shared/auth/errors";
import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

const PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30 } as const;
const PERIOD_TEXT = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" } as const;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Leads na qualificação (plano de recuperação, fase 1): onde cada lead está, o que falta e o que acontece depois.
 * Filtros: só intervalo e fila; entradas por turno, WhatsApp x formulário, no topo.
 */
export default async function QualificacaoLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }
  const params = await searchParams;
  const period = parseOverviewPeriod(single(params.periodo) ?? "7");
  const queues = await listLeadQualityQueues(context.tenantId);
  const rawQueue = single(params.fila);
  const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
  const now = new Date();
  const since = businessTurnStart(now, businessDaysBack(PERIOD_DAYS[period]));
  const [rows, entries] = await Promise.all([
    listQualificationLeads(context.tenantId, { since, queueId }, now),
    getEntriesByTurn(context, { period, queueId }, now).catch(() => null),
  ]);
  const queueName = queues.find((queue) => queue.id === queueId)?.name ?? null;
  const periodValue = period === "today" ? "hoje" : period === "7d" ? "7" : "30";

  return (
    <>
      <DashboardHeader breadcrumb="Qualificação" title="Leads na qualificação" summary={`${rows.length.toLocaleString("pt-BR")} leads · ${PERIOD_TEXT[period].toLowerCase()} · ${queueName ?? "todas as filas"}`} />
      <main className={litePage.stack}>
        <QualificationLeadsWorkspace
          rows={rows}
          truncated={rows.length >= QUALIFICATION_LEADS_LIMIT}
          nowIso={now.toISOString()}
          filters={(
            <>
              <LiteUrlSelect label="Intervalo" param="periodo" value={periodValue} defaultValue="7" options={[{ value: "hoje", label: "Hoje" }, { value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }]} />
              <LiteUrlSelect label="Fila" param="fila" value={queueId ?? ""} defaultValue="" options={[{ value: "", label: "Todas as filas" }, ...queues.map((queue) => ({ value: queue.id, label: queue.name }))]} />
            </>
          )}
          summary={entries ? <EntriesView data={entries} queueName={queueName} periodText={PERIOD_TEXT[period]} /> : null}
        />
      </main>
    </>
  );
}
