import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type CommissionRuleRecord = {
  id: string;
  tenantId: string;
  carrierId: string | null;
  carrierName: string | null;
  planId: string | null;
  planName: string | null;
  name: string;
  type: "unica" | "escalonada";
  percentages: number[];
  appliesToAll: boolean;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCommissionRules(): Promise<CommissionRuleRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const rows = await db
    .select({
      id: schema.commissionRules.id,
      tenantId: schema.commissionRules.tenantId,
      carrierId: schema.commissionRules.carrierId,
      carrierName: sql<string | null>`${schema.carriers.name}`,
      planId: schema.commissionRules.planId,
      planName: sql<string | null>`${schema.carrierPlans.name}`,
      name: schema.commissionRules.name,
      type: schema.commissionRules.type,
      percentages: schema.commissionRules.percentages,
      appliesToAll: schema.commissionRules.appliesToAll,
      active: schema.commissionRules.active,
      createdBy: schema.commissionRules.createdBy,
      createdAt: schema.commissionRules.createdAt,
      updatedAt: schema.commissionRules.updatedAt,
    })
    .from(schema.commissionRules)
    .leftJoin(schema.carriers, eq(schema.commissionRules.carrierId, schema.carriers.id))
    .leftJoin(schema.carrierPlans, eq(schema.commissionRules.planId, schema.carrierPlans.id))
    .where(eq(schema.commissionRules.tenantId, context.tenantId))
    .orderBy(schema.commissionRules.createdAt);

  return rows.map((row) => ({
    ...row,
    percentages: Array.isArray(row.percentages) ? row.percentages : [100],
  }));
}

export async function getCommissionRuleById(ruleId: string): Promise<CommissionRuleRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [row] = await db
    .select({
      id: schema.commissionRules.id,
      tenantId: schema.commissionRules.tenantId,
      carrierId: schema.commissionRules.carrierId,
      carrierName: sql<string | null>`${schema.carriers.name}`,
      planId: schema.commissionRules.planId,
      planName: sql<string | null>`${schema.carrierPlans.name}`,
      name: schema.commissionRules.name,
      type: schema.commissionRules.type,
      percentages: schema.commissionRules.percentages,
      appliesToAll: schema.commissionRules.appliesToAll,
      active: schema.commissionRules.active,
      createdBy: schema.commissionRules.createdBy,
      createdAt: schema.commissionRules.createdAt,
      updatedAt: schema.commissionRules.updatedAt,
    })
    .from(schema.commissionRules)
    .leftJoin(schema.carriers, eq(schema.commissionRules.carrierId, schema.carriers.id))
    .leftJoin(schema.carrierPlans, eq(schema.commissionRules.planId, schema.carrierPlans.id))
    .where(
      and(
        eq(schema.commissionRules.id, ruleId),
        eq(schema.commissionRules.tenantId, context.tenantId),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    percentages: Array.isArray(row.percentages) ? row.percentages : [100],
  };
}

export type CarrierOption = { id: string; name: string };
export type PlanOption = { id: string; name: string; carrierId: string };

export async function getCarrierOptions(): Promise<CarrierOption[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({ id: schema.carriers.id, name: schema.carriers.name })
    .from(schema.carriers)
    .where(
      and(
        eq(schema.carriers.tenantId, context.tenantId),
        eq(schema.carriers.status, "active"),
      ),
    )
    .orderBy(schema.carriers.name);
}

export async function getPlanOptions(carrierId: string): Promise<PlanOption[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({ id: schema.carrierPlans.id, name: schema.carrierPlans.name, carrierId: schema.carrierPlans.carrierId })
    .from(schema.carrierPlans)
    .where(
      and(
        eq(schema.carrierPlans.tenantId, context.tenantId),
        eq(schema.carrierPlans.carrierId, carrierId),
        eq(schema.carrierPlans.active, true),
      ),
    )
    .orderBy(schema.carrierPlans.name);
}
