import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import type { AvailableCatalogPlan } from "@/features/global-catalog/types";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import type { SaleCatalog } from "./conversation-sale-core";
import { mergeSaleCatalog } from "./sale-catalog-merge";

/**
 * Operadoras e planos da conversa da venda: catálogo antigo (`carriers` + `carrier_plans` ativos) e catálogo novo
 * (global liberado para a corretora e privado), os mesmos que a tela do lead oferece. Falha do catálogo novo não
 * derruba a conversa: segue com o antigo.
 */
export async function loadSaleCatalog(context: TenantContext): Promise<SaleCatalog> {
  const db = getDatabase();
  const [legacy, available] = await Promise.all([
    db.select({ carrierId: schema.carriers.id, carrierName: schema.carriers.name, planId: schema.carrierPlans.id, planName: schema.carrierPlans.name, planType: schema.carrierPlans.type })
      .from(schema.carriers)
      .leftJoin(schema.carrierPlans, and(eq(schema.carrierPlans.carrierId, schema.carriers.id), eq(schema.carrierPlans.tenantId, context.tenantId), eq(schema.carrierPlans.active, true)))
      .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active")))
      .orderBy(asc(schema.carriers.name)),
    listAvailableCatalogPlans(context).catch((error) => {
      console.error("[registrar-venda] catálogo novo indisponível", error instanceof Error ? error.name : "unknown");
      return [] as AvailableCatalogPlan[];
    }),
  ]);
  return mergeSaleCatalog(legacy, available);
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
