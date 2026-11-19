import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import type { SaleCatalog, SalePlanType } from "./conversation-sale-core";

/** Operadoras ativas da corretora com os planos ativos de cada uma (as perguntas Operadora e Plano). */
export async function loadSaleCatalog(tenantId: string): Promise<SaleCatalog> {
  const db = getDatabase();
  const [carriers, plans] = await Promise.all([
    db.select({ id: schema.carriers.id, name: schema.carriers.name }).from(schema.carriers)
      .where(and(eq(schema.carriers.tenantId, tenantId), eq(schema.carriers.status, "active"))).orderBy(asc(schema.carriers.name)),
    db.select({ id: schema.carrierPlans.id, carrierId: schema.carrierPlans.carrierId, name: schema.carrierPlans.name, type: schema.carrierPlans.type }).from(schema.carrierPlans)
      .where(and(eq(schema.carrierPlans.tenantId, tenantId), eq(schema.carrierPlans.active, true))).orderBy(asc(schema.carrierPlans.name)),
  ]);
  return {
    carriers: carriers.map((carrier) => ({
      ...carrier,
      plans: plans.filter((plan) => plan.carrierId === carrier.id).map((plan) => ({ id: plan.id, name: plan.name, type: plan.type as SalePlanType })),
    })),
  };
}

export type SaleChatLeadRow = { id: string; nome: string; status: string; monthlyValue: string | null; corretorId: string | null; qualificationDetails: unknown };

/** O lead da conversa, só do corretor da sessão. */
export async function loadSaleChatLead(context: Pick<TenantContext, "tenantId" | "userId" | "role">, leadId: string): Promise<SaleChatLeadRow | null> {
  const [lead] = await getDatabase()
    .select({ id: schema.leads.id, nome: schema.leads.nome, status: schema.leads.status, monthlyValue: schema.leads.monthlyValue, corretorId: schema.leads.corretorId, qualificationDetails: schema.leads.qualificationDetails })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
    .limit(1);
  if (!lead) return null;
  if (context.role === "broker" && lead.corretorId !== context.userId) return null;
  return lead;
}
