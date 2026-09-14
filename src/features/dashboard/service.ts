import "server-only";

import type { TenantContext } from "@/shared/auth/types";
import { getAttentionSnapshot, getCommercialOverview, getFunnelSnapshot } from "@/features/reports/metrics/metrics-service";
import type { PeriodValue } from "@/shared/period";
import { resolveDashboardProfile, type DashboardViewModel } from "./contracts";

/** Single server-side aggregator for the global operational dashboard. */
export async function getDashboardViewModel(context: TenantContext, period: PeriodValue = 7): Promise<DashboardViewModel> {
  const profile = resolveDashboardProfile(context);
  const [commercial, attention, funnel] = await Promise.all([
    getCommercialOverview(context, period, { includeFinancial: false }),
    getAttentionSnapshot(context, period),
    getFunnelSnapshot(context, period),
  ]);
  const attentionCount = attention.items.reduce((total, item) => total + item.count, 0);
  return {
    header: {
      title: profile.profile === "broker" ? "Minha operação" : "Visão da operação",
      description: profile.attentionTitle,
    },
    metrics: [
      { id: "leads-received", label: "Leads recebidos", value: funnel.received, description: `Últimos ${period} dias` },
      { id: "conversion", label: "Conversão", value: `${commercial.conversion.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, description: "No período", tone: commercial.conversion.rate >= 10 ? "success" : "default" },
      { id: "attention", label: "Precisam de atenção", value: attentionCount, description: "Exceções operacionais", tone: attentionCount > 0 ? "warning" : "success" },
      { id: "sales", label: "Vendas", value: commercial.sales, description: "No período", tone: commercial.sales > 0 ? "success" : "default" },
    ],
    attention: attention.items.filter((item) => item.count > 0).map((item) => ({ ...item, tone: item.count > 5 ? "danger" as const : "warning" as const })),
    primary: {
      id: profile.primarySectionId,
      title: profile.profile === "broker" ? "Próximo trabalho" : profile.profile === "supervisor" ? "Prioridades da equipe" : profile.profile === "manager" ? "Saúde da unidade" : "Saúde das unidades",
      description: `Resumo operacional dos últimos ${period} dias.`,
    },
    secondary: { id: "funnel", title: "Funil compacto", description: `${funnel.received} leads recebidos no período.` },
  };
}
