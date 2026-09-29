/**
 * Tipos públicos e utilitários puros do módulo de métricas.
 *
 * ⚠️  Este arquivo NÃO contém `import "server-only"` propositalmente:
 * ele exporta apenas interfaces e funções puras (sem acesso a BD) para que
 * Client Components possam importar os tipos sem puxar o grafo server-only.
 *
 * Funções e queries que acessam banco devem permanecer em `metrics-service.ts`.
 */

import type { PeriodValue } from "@/shared/period";
import { periodStart } from "@/shared/period";
import { previousWindowStart } from "./metrics-math";

// ---------------------------------------------------------------------------
// Tipos primitivos compartilhados
// ---------------------------------------------------------------------------

export interface CohortConversion {
  readonly received: number;
  readonly converted: number;
  readonly lost: number;
  /** Percentual 0–100. */
  readonly rate: number;
}

export interface PeriodWindows {
  readonly currentStart: Date;
  readonly previousStart: Date;
  readonly days: number;
}

export function resolveWindows(period: PeriodValue): PeriodWindows {
  const currentStart = periodStart(period);
  return {
    currentStart,
    previousStart: previousWindowStart(currentStart, period),
    days: period,
  };
}

// ---------------------------------------------------------------------------
// Interfaces dos snapshots — usadas por Server e Client Components
// ---------------------------------------------------------------------------

export interface CommercialOverview {
  readonly conversion: CohortConversion;
  readonly previousConversion: CohortConversion;
  readonly sales: number;
  readonly previousSales: number;
  readonly revenue: number | null;
  readonly previousRevenue: number | null;
  readonly avgTicket: number | null;
  readonly previousAvgTicket: number | null;
}

export interface TenantSlaParams {
  readonly firstContactMinutes: number;
  readonly stagnantDays: number;
}

export interface AttentionItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly count: number;
  /** Rota de drill-down com a população exata. */
  readonly href: string;
}

export interface AttentionSnapshot {
  readonly items: readonly AttentionItem[];
  readonly sla: TenantSlaParams;
}

export interface SourcePerformanceRow {
  readonly source: string;
  readonly leads: number;
  readonly converted: number;
  readonly sales: number;
  readonly revenue: number | null;
}

export interface FunnelSnapshot {
  readonly rows: readonly {
    stage: import("./metrics-math").FunnelStage;
    inStage: number;
    reached: number;
    progressionToNext: number | null;
  }[];
  readonly lost: number;
  readonly biggestBottleneck: number | null;
  readonly received: number;
}

export interface LeadTimelinePoint {
  readonly date: string;
  readonly received: number;
  readonly converted: number;
}

// ---------------------------------------------------------------------------
// Utilitários puros (sem acesso a BD)
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  meta_lead_ads: "Meta Lead Ads",
  manual: "Cadastro manual",
  webhook: "Webhook",
  extension: "Extensão de navegador",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
