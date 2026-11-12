import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";

import { OPEN_DEAL_STATUSES, type OfferPlan, type OfferSnapshot } from "./contracts";

export type DealRow = typeof schema.autoSaleDeals.$inferSelect;

/**
 * O lead está numa negociação aberta (ativa, pausada ou aguardando o gestor)? Os ganchos de
 * distribuição, turbo, conversa inteligente, régua WAHA e chat parado leem daqui.
 * Sem a migração (42P01) não existe negociação: devolve false e nada muda.
 */
export async function isLeadInActiveAutoSale(tenantId: string, leadId: string): Promise<boolean> {
  try {
    const [row] = await getDatabase().select({ id: schema.autoSaleDeals.id }).from(schema.autoSaleDeals)
      .where(and(eq(schema.autoSaleDeals.tenantId, tenantId), eq(schema.autoSaleDeals.leadId, leadId), inArray(schema.autoSaleDeals.status, [...OPEN_DEAL_STATUSES])))
      .limit(1);
    return Boolean(row);
  } catch (error) {
    if (isUndefinedTableError(error)) return false;
    throw error;
  }
}

/** Ids dos leads em negociação aberta, para filtrar listas em lote (uma consulta só). */
export async function leadIdsInActiveAutoSale(tenantId: string | null): Promise<Set<string>> {
  try {
    const rows = await getDatabase().select({ leadId: schema.autoSaleDeals.leadId }).from(schema.autoSaleDeals)
      .where(and(tenantId ? eq(schema.autoSaleDeals.tenantId, tenantId) : undefined, inArray(schema.autoSaleDeals.status, [...OPEN_DEAL_STATUSES])));
    return new Set(rows.map((row) => row.leadId));
  } catch (error) {
    if (isUndefinedTableError(error)) return new Set();
    throw error;
  }
}

export async function getOpenDealForLead(tenantId: string, leadId: string): Promise<DealRow | null> {
  const [row] = await getDatabase().select().from(schema.autoSaleDeals)
    .where(and(eq(schema.autoSaleDeals.tenantId, tenantId), eq(schema.autoSaleDeals.leadId, leadId), inArray(schema.autoSaleDeals.status, [...OPEN_DEAL_STATUSES])))
    .limit(1);
  return row ?? null;
}

export async function getDeal(tenantId: string, dealId: string): Promise<DealRow | null> {
  const [row] = await getDatabase().select().from(schema.autoSaleDeals)
    .where(and(eq(schema.autoSaleDeals.tenantId, tenantId), eq(schema.autoSaleDeals.id, dealId))).limit(1);
  return row ?? null;
}

export function toOfferSnapshot(row: typeof schema.autoSaleOffers.$inferSelect, previousTotalCents: number | null): OfferSnapshot {
  return {
    id: row.id,
    version: row.version,
    input: row.input as OfferSnapshot["input"],
    plans: row.plans as OfferPlan[],
    recommendedPlanId: row.recommendedPlanId,
    recommendationReason: row.recommendationReason,
    relaxed: (row.relaxed as OfferSnapshot["relaxed"]) ?? null,
    previousOfferId: row.previousOfferId,
    previousTotalCents,
    release: row.release,
    catalogDate: row.catalogDate,
  };
}

export async function listOffers(tenantId: string, dealId: string): Promise<{ snapshot: OfferSnapshot; row: typeof schema.autoSaleOffers.$inferSelect }[]> {
  const rows = await getDatabase().select().from(schema.autoSaleOffers)
    .where(and(eq(schema.autoSaleOffers.tenantId, tenantId), eq(schema.autoSaleOffers.dealId, dealId)))
    .orderBy(asc(schema.autoSaleOffers.version));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const previous = row.previousOfferId ? byId.get(row.previousOfferId) : null;
    const previousTotal = previous ? (previous.plans as OfferPlan[])[0]?.totalCents ?? null : null;
    return { row, snapshot: toOfferSnapshot(row, previousTotal) };
  });
}

export async function listTurns(tenantId: string, dealId: string, limit = 80) {
  const rows = await getDatabase().select().from(schema.autoSaleTurns)
    .where(and(eq(schema.autoSaleTurns.tenantId, tenantId), eq(schema.autoSaleTurns.dealId, dealId)))
    .orderBy(desc(schema.autoSaleTurns.createdAt)).limit(limit);
  return rows.reverse();
}

export async function listOutbox(tenantId: string, dealId: string) {
  return getDatabase().select().from(schema.autoSaleOutbox)
    .where(and(eq(schema.autoSaleOutbox.tenantId, tenantId), eq(schema.autoSaleOutbox.dealId, dealId)))
    .orderBy(asc(schema.autoSaleOutbox.createdAt));
}
