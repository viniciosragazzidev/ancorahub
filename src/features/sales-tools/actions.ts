"use server";

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type TablePriceRow = {
  ageBand: string;
  monthlyPrice: number;
};

export type TablePlanInfo = {
  id: string;
  carrierName: string;
  name: string;
  coverage: string | null;
  type: string;
  prices: TablePriceRow[];
};

export type CustomTableData = {
  plans: TablePlanInfo[];
  allAgeBands: string[];
};

export async function getCustomTablePricesAction(
  planIds: string[],
): Promise<{ data?: CustomTableData; error?: string }> {
  if (planIds.length === 0) return { error: "Selecione ao menos um plano." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    // Fetch plan info from both sources
    const [globalPlanInfo, legacyPlanInfo, globalPrices, legacyPrices] = await Promise.all([
      db
        .select({
          id: schema.globalPlans.id,
          carrierName: schema.globalCarriers.name,
          name: schema.globalPlans.name,
          coverage: schema.globalPlans.coverage,
          type: schema.globalPlans.type,
        })
        .from(schema.globalPlans)
        .innerJoin(schema.globalCarriers, eq(schema.globalPlans.carrierId, schema.globalCarriers.id))
        .where(inArray(schema.globalPlans.id, planIds)),
      db
        .select({
          id: schema.carrierPlans.id,
          carrierName: schema.carriers.name,
          name: schema.carrierPlans.name,
          coverage: schema.carrierPlans.coverage,
          type: schema.carrierPlans.type,
        })
        .from(schema.carrierPlans)
        .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
        .where(
          and(
            eq(schema.carrierPlans.tenantId, context.tenantId),
            inArray(schema.carrierPlans.id, planIds),
          ),
        ),
      planIds.length > 0
        ? db
            .select({
              planId: schema.globalPlans.id,
              ageBand: schema.catalogPriceRows.ageBand,
              monthlyPrice: schema.catalogPriceRows.monthlyPrice,
            })
            .from(schema.catalogPriceRows)
            .innerJoin(
              schema.catalogTableVersions,
              eq(schema.catalogPriceRows.tableVersionId, schema.catalogTableVersions.id),
            )
            .innerJoin(
              schema.catalogPriceTables,
              eq(schema.catalogTableVersions.priceTableId, schema.catalogPriceTables.id),
            )
            .innerJoin(schema.globalPlans, eq(schema.catalogPriceTables.planId, schema.globalPlans.id))
            .where(
              and(
                eq(schema.catalogTableVersions.status, "published"),
                eq(schema.catalogPriceTables.status, "published"),
                inArray(schema.globalPlans.id, planIds),
              ),
            )
        : [],
      db
        .select({
          planId: schema.carrierPlanPrices.planId,
          ageBand: schema.carrierPlanPrices.ageBand,
          monthlyPrice: schema.carrierPlanPrices.monthlyPrice,
        })
        .from(schema.carrierPlanPrices)
        .where(
          and(
            eq(schema.carrierPlanPrices.tenantId, context.tenantId),
            inArray(schema.carrierPlanPrices.planId, planIds),
          ),
        ),
    ]);

    // Merge plan info
    const planInfoMap = new Map<
      string,
      { carrierName: string; name: string; coverage: string | null; type: string }
    >();
    for (const p of globalPlanInfo) planInfoMap.set(p.id, p);
    for (const p of legacyPlanInfo) planInfoMap.set(p.id, p);

    // Merge prices
    const allPrices = [...globalPrices, ...legacyPrices];
    const pricesByPlan = new Map<string, TablePriceRow[]>();
    for (const price of allPrices) {
      const existing = pricesByPlan.get(price.planId) ?? [];
      existing.push({
        ageBand: price.ageBand,
        monthlyPrice: Number(price.monthlyPrice),
      });
      pricesByPlan.set(price.planId, existing);
    }

    // Build age band set
    const allAgeBands = Array.from(new Set(allPrices.map((p) => p.ageBand))).sort();

    const plans: TablePlanInfo[] = planIds
      .map((id) => {
        const info = planInfoMap.get(id);
        if (!info) return null;
        return {
          id,
          carrierName: info.carrierName,
          name: info.name,
          coverage: info.coverage,
          type: info.type,
          prices: allAgeBands.map((band) => {
            const priceRow = pricesByPlan.get(id)?.find((p) => p.ageBand === band);
            return {
              ageBand: band,
              monthlyPrice: priceRow?.monthlyPrice ?? 0,
            };
          }),
        };
      })
      .filter((p): p is TablePlanInfo => p !== null);

    return { data: { plans, allAgeBands } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao buscar preços." };
  }
}
