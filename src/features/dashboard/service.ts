import "server-only";

import type { TenantContext } from "@/shared/auth/types";
import { getAttentionSnapshot, getCommercialOverview, getFunnelSnapshot } from "@/features/reports/metrics/metrics-service";
import type { PeriodValue } from "@/shared/period";
import { resolveDashboardProfile, type DashboardViewModel } from "./contracts";
import { and, count, eq, gte, isNull, isNotNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { periodStart } from "@/shared/period";

export type DomainDashboard = { title: string; description: string; metrics: readonly { label: string; value: number | string }[]; actionHref: string };

export async function getDomainDashboard(context: TenantContext, domain: "team" | "tasks" | "conversations" | "distribution" | "sales"): Promise<DomainDashboard> {
  const db = getDatabase();
  const since = periodStart(7);
  const scope = context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined;
  if (domain === "tasks") {
    const [open, overdue, today] = await Promise.all([
      db.select({ value: count() }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), isNull(schema.leadTasks.completedAt))),
      db.select({ value: count() }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), isNull(schema.leadTasks.completedAt), gte(schema.leadTasks.dueAt, since))),
      db.select({ value: count() }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), gte(schema.leadTasks.createdAt, since))),
    ]);
    return { title: "Visão de tarefas", description: "Execução e pendências do período.", metrics: [{ label: "Em aberto", value: Number(open[0]?.value ?? 0) }, { label: "Com prazo", value: Number(overdue[0]?.value ?? 0) }, { label: "Criadas", value: Number(today[0]?.value ?? 0) }], actionHref: "/tarefas" };
  }
  if (domain === "conversations") {
    const [messages, incoming] = await Promise.all([
      db.select({ value: count() }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), gte(schema.whatsappMessages.sentAt, since))),
      db.select({ value: count() }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.direction, "incoming"), gte(schema.whatsappMessages.sentAt, since))),
    ]);
    return { title: "Visão de atendimento", description: "Mensagens e conversas recentes.", metrics: [{ label: "Mensagens", value: Number(messages[0]?.value ?? 0) }, { label: "Recebidas", value: Number(incoming[0]?.value ?? 0) }], actionHref: "/conversas" };
  }
  if (domain === "distribution") {
    const [received, assigned] = await Promise.all([
      db.select({ value: count() }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), scope, gte(schema.leads.createdAt, since), isNull(schema.leads.deletedAt))),
      db.select({ value: count() }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), scope, gte(schema.leads.createdAt, since), isNull(schema.leads.deletedAt), isNotNull(schema.leads.corretorId))),
    ]);
    return { title: "Visão de distribuição", description: "Fluxo de leads no período.", metrics: [{ label: "Recebidos", value: Number(received[0]?.value ?? 0) }, { label: "Atribuídos", value: Number(assigned[0]?.value ?? 0) }], actionHref: "/distribuicao" };
  }
  if (domain === "sales") {
    const rows = await db.select({ value: count() }).from(schema.sales).where(and(eq(schema.sales.tenantId, context.tenantId), gte(schema.sales.saleDate, since), context.role === "broker" ? eq(schema.sales.brokerId, context.userId) : undefined));
    return { title: "Visão de vendas", description: "Resultado comercial recente.", metrics: [{ label: "Vendas", value: Number(rows[0]?.value ?? 0) }], actionHref: "/vendas" };
  }
  const [members, active] = await Promise.all([
    db.select({ value: count() }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"))),
    db.select({ value: count() }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), scope, isNull(schema.leads.deletedAt), eq(schema.leads.status, "in_contact"))),
  ]);
  return { title: "Visão da equipe", description: "Pessoas e operação dentro do seu escopo.", metrics: [{ label: "Membros ativos", value: Number(members[0]?.value ?? 0) }, { label: "Em atendimento", value: Number(active[0]?.value ?? 0) }], actionHref: "/equipe" };
}

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
