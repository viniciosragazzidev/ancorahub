"use client";

/** Aba "Visão da operação" no visual Lite: painel essencial no estilo do Desempenho Lite (2026-10-26). */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { DirectorLiteChrome, type DashboardBranch, type DirectorLiteTab } from "./director-lite-chrome";
import { OperationView } from "./operation-view";

export type { DashboardBranch };

export function DirectorLiteDashboard({ data, period, branchId, branches, now, availableTabs, canOpenConversations = true }: {
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
}) {
  return (
    <DirectorLiteChrome now={now} tab="overview" period={period} branchId={branchId} branches={branches} firstName={data.firstName} availableTabs={availableTabs}>
      <OperationView data={data} canOpenConversations={canOpenConversations} />
    </DirectorLiteChrome>
  );
}
