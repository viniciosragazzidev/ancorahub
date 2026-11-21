import { DashboardHeader } from "@/components/dashboard-header";
import { LiteUrlSelect } from "@/components/lite/controls/url-select";
import litePage from "@/components/lite/page/lite-page.module.css";
import { businessDaysBack, businessTurnStart } from "@/features/dashboard/essential/business-window";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { RecoveryFunnelView } from "@/features/lead-recovery/components/recovery-funnel-view";
import { getRecoveryFunnel } from "@/features/lead-recovery/metrics";
import { getTurboAdminData } from "@/features/qualification-turbo/actions";
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

/** Funil de recuperação (plano de recuperação, fase 2). Filtros: só intervalo e fila. */
export default async function QualificacaoRecuperacaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }
  const params = await searchParams;
  const period = parseOverviewPeriod(single(params.periodo) ?? "7");
  const queues = await listLeadQualityQueues(context.tenantId);
  const rawQueue = single(params.fila);
  const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
  const queueName = queues.find((queue) => queue.id === queueId)?.name ?? null;
  const now = new Date();
  const turbo = await getTurboAdminData().catch(() => null);
  const templatesNotApproved = (turbo?.templates ?? [])
    .filter((template) => template.touch !== "t0" && template.status !== "APPROVED")
    .map((template) => ({ name: template.name, label: template.label, status: template.status }));
  const data = await getRecoveryFunnel({
    tenantId: context.tenantId,
    since: businessTurnStart(now, businessDaysBack(PERIOD_DAYS[period])),
    queueId,
    periodText: PERIOD_TEXT[period],
    queueName,
    templatesNotApproved,
    now,
  });
  const periodValue = period === "today" ? "hoje" : period === "7d" ? "7" : "30";
  return (
    <>
      <DashboardHeader breadcrumb="Qualificação" title="Recuperação" summary={`${data.numbers.recovered.toLocaleString("pt-BR")} recuperados · ${PERIOD_TEXT[period].toLowerCase()} · ${queueName ?? "todas as filas"}`} />
      <main className={litePage.stack}>
        <RecoveryFunnelView
          data={data}
          canEdit={context.role === "director"}
          filters={(
            <>
              <LiteUrlSelect label="Intervalo" param="periodo" value={periodValue} defaultValue="7" options={[{ value: "hoje", label: "Hoje" }, { value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }]} />
              <LiteUrlSelect label="Fila" param="fila" value={queueId ?? ""} defaultValue="" options={[{ value: "", label: "Todas as filas" }, ...queues.map((queue) => ({ value: queue.id, label: queue.name }))]} />
            </>
          )}
        />
      </main>
    </>
  );
}
