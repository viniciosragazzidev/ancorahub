"use client";

/** Aba "Visão da operação" no visual Lite: painel essencial no estilo do Desempenho Lite (2026-10-26). */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { DirectorLiteChrome, type DashboardBranch, type DirectorLiteTab } from "./director-lite-chrome";
import { OperationView } from "./operation-view";
import { AttentionDrawerButton } from "./attention-drawer";
import { attentionItems } from "./attention";
import { customRangeLabel, type CustomRange } from "./custom-range";
import type { EntriesByTurn } from "@/features/dashboard/entries/entries-by-turn-core";

export type { DashboardBranch };

export function DirectorLiteDashboard({ data, period, branchId, branches, now, availableTabs, canOpenConversations = true, queues, queueId = null, entries = null, customRange = null }: {
  data: EssentialDashboard;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  now: Date;
  /** Abas que o papel abre hoje (Qualidade e Funil dependem da central de qualidade). Sem isto, as três. */
  availableTabs?: readonly DirectorLiteTab[];
  /** Sem acesso às Conversas, os nomes dos corretores ficam sem link (a tela levaria a acesso negado). */
  canOpenConversations?: boolean;
  /** Filtro por fila (20/11/2026): intervalo e fila no topo em todas as abas do Painel. */
  queues?: DashboardBranch[];
  queueId?: string | null;
  /** Entradas por turno, WhatsApp x formulário. */
  entries?: EntriesByTurn | null;
  /** Intervalo personalizado ativo (data e hora). */
  customRange?: CustomRange | null;
}) {
  const queueName = queues?.find((queue) => queue.id === queueId)?.name ?? null;
  const attention = attentionItems(data);
  // Uma frase com a situação (27/11/2026): quantos entraram no recorte e quantas coisas pedem decisão.
  const arrived = data.queues.totals.arrived;
  const when = customRange ? `Entre ${customRangeLabel(customRange)}` : period === "today" ? "Hoje" : period === "7d" ? "Nos últimos 7 dias" : "Nos últimos 30 dias";
  const leadsText = `${when} ${arrived === 1 ? "entrou 1 lead" : `entraram ${arrived.toLocaleString("pt-BR")} leads`}${queueName ? ` em ${queueName}` : ""}.`;
  const headline = `${leadsText} ${attention.length === 0 ? "Nada pedindo você agora." : attention.length === 1 ? "1 coisa pede você agora." : `${attention.length} coisas pedem você agora.`}`;
  return (
    <DirectorLiteChrome now={now} tab="overview" period={period} branchId={branchId} branches={branches} firstName={data.firstName} availableTabs={availableTabs} queues={queues} queueId={queueId} customRange={customRange} allowCustomRange headline={headline} action={<AttentionDrawerButton items={attention} />}>
      {/* Cópia 1:1 do artifact (27/11/2026): "Entradas por hora" (WhatsApp x formulário) fica dentro da visão; a
          antiga tabela por turno saiu da tela. `entries` segue aceito para não mudar a página. */}
      <OperationView data={data} canOpenConversations={canOpenConversations} period={period} current={!customRange} now={now} />
    </DirectorLiteChrome>
  );
}
