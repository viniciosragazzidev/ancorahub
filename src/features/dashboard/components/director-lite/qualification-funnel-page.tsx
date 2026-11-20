"use client";

import { EntriesView } from "./entries-view";
import { customRangeLabel, type CustomRange } from "./custom-range";
import type { EntriesByTurn } from "@/features/dashboard/entries/entries-by-turn-core";
import type { FunnelPeriod, QualificationFunnel } from "@/features/qualification-turbo/funnel";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import type { DashboardBranch } from "./director-lite-dashboard";
import { dashboardHref, DirectorLiteChrome } from "./director-lite-chrome";
import { QualificationFunnelView } from "./qualification-funnel-view";

function overviewPeriod(period: FunnelPeriod): OverviewPeriod {
  if (period === "today") return "today";
  return period === 7 ? "7d" : "30d";
}

export function DirectorLiteQualificationFunnelPage({
  data,
  branchId,
  branches,
  firstName,
  now,
  insights,
  queues,
  queueId = null,
  entries,
  customRange = null,
}: {
  /** Filtro por fila (20/11/2026): intervalo e fila no topo, como na Qualidade. */
  queues?: DashboardBranch[];
  queueId?: string | null;
  /** Entradas por turno (WhatsApp x formulário) acima do funil. */
  entries?: EntriesByTurn | null;
  /** Intervalo personalizado ativo (data e hora). */
  customRange?: CustomRange | null;
  /** Funil profissional (05/11): onde param, onde perdemos e qualidade por campanha. */
  insights?: React.ReactNode;
  data: QualificationFunnel;
  /** Unidade já validada no servidor; null representa todas as unidades autorizadas. */
  branchId: string | null;
  branches: DashboardBranch[];
  firstName: string | null;
  now: Date;
}) {
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
  const period = overviewPeriod(data.period);
  const queueName = queues?.find((queue) => queue.id === queueId)?.name ?? null;
  const periodText = customRange ? customRangeLabel(customRange) : period === "today" ? "Hoje" : period === "7d" ? "Últimos 7 dias" : "Últimos 30 dias";

  return (
    <DirectorLiteChrome now={now} tab="funnel" period={period} branchId={branchId} branches={branches} firstName={firstName} queues={queues} queueId={queueId} customRange={customRange} allowCustomRange>
      {entries ? <div className="mb-6"><EntriesView data={entries} queueName={queueName} periodText={periodText} current={!customRange} /></div> : null}
      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} widerHref={dashboardHref("funnel", "7", branchId)} now={now} />
      {insights ? <div className="mt-4">{insights}</div> : null}
    </DirectorLiteChrome>
  );
}
