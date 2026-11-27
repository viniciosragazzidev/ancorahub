"use client";

import { AttentionDrawerButton } from "./attention-drawer";
import type { AttentionItem } from "./attention";
import { funnelHeadline } from "./qualidade-funil-text";
import q from "./qualidade-funil.module.css";
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
  entries: _entries,
  attention = null,
  customRange = null,
}: {
  /** "Precisa de você" no topo, como na visão geral (artifact de 27/11/2026). */
  attention?: AttentionItem[] | null;
  /** Filtro por fila (20/11/2026): intervalo e fila no topo, como na Qualidade. */
  queues?: DashboardBranch[];
  queueId?: string | null;
  /** Entradas por turno: desde 27/11/2026 ficam na visão geral ("Entradas por hora"); aceito e ignorado aqui. */
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
  const periodText = customRange ? `Entre ${customRangeLabel(customRange)}` : period === "today" ? "Hoje" : period === "7d" ? "Nos últimos 7 dias" : "Nos últimos 30 dias";
  void _entries;

  return (
    <DirectorLiteChrome now={now} tab="funnel" period={period} branchId={branchId} branches={branches} firstName={firstName} queues={queues} queueId={queueId} customRange={customRange} allowCustomRange headline={funnelHeadline(data, periodText)} action={attention ? <AttentionDrawerButton items={attention} /> : null}>
      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} widerHref={dashboardHref("funnel", "7", branchId)} now={now} />
      {insights ? <section className={`${q.card} ${q.pad20}`} aria-label="Onde param, onde perdemos e qualidade por campanha" style={{ marginTop: 20 }}>{insights}</section> : null}
    </DirectorLiteChrome>
  );
}
