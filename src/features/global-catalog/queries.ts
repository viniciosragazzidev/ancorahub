import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { resolveTenantGlobalPlanVisibility } from "./availability";
import type { AvailableCatalogPlan } from "./types";

export async function isGlobalCatalogEnabled() {
  return (await getSystemSetting("feature_global_catalog_enabled")) !== "false";
}

export async function isTenantPrivateCatalogEnabled() {
  return (await getSystemSetting("feature_tenant_private_catalog_enabled")) !== "false";
}

/**
 * Public query interface for operational hosts. It keeps origin, tenant
 * availability and branch restrictions inside the catalog domain.
 */
export async function listAvailableCatalogPlans(
  context?: TenantContext,
): Promise<AvailableCatalogPlan[]> {
  const resolvedContext = context ?? await getRequiredTenantContext();
  const db = getDatabase();
  const [globalEnabled, privateEnabled] = await Promise.all([
    isGlobalCatalogEnabled(),
    isTenantPrivateCatalogEnabled(),
  ]);

  const globalRows = globalEnabled
    ? await db
        .select({
          planId: schema.globalPlans.id,
          carrierId: schema.globalCarriers.id,
          carrierName: schema.globalCarriers.name,
          planName: schema.globalPlans.name,
          planType: schema.globalPlans.type,
          coverage: schema.globalPlans.coverage,
          maxEntryAge: schema.globalPlans.maxEntryAge,
        })
        .from(schema.globalPlans)
        .innerJoin(schema.globalCarriers, eq(schema.globalPlans.carrierId, schema.globalCarriers.id))
        .where(
          and(
            eq(schema.globalPlans.status, "published"),
            eq(schema.globalCarriers.status, "published"),
          ),
        )
        .orderBy(asc(schema.globalCarriers.name), asc(schema.globalPlans.name))
    : [];

  const availabilityOverrides = globalRows.length > 0
    ? await db
        .select({ globalPlanId: schema.tenantCatalogPlanSettings.globalPlanId, enabled: schema.tenantCatalogPlanSettings.enabled })
        .from(schema.tenantCatalogPlanSettings)
        .where(
          and(
            eq(schema.tenantCatalogPlanSettings.tenantId, resolvedContext.tenantId),
            inArray(schema.tenantCatalogPlanSettings.globalPlanId, globalRows.map((row) => row.planId)),
          ),
        )
    : [];

  let allowedGlobalRows = resolveTenantGlobalPlanVisibility(globalRows, availabilityOverrides);
  if (resolvedContext.branchId && globalRows.length > 0) {
    const restrictions = await db
      .select({ globalPlanId: schema.branchCatalogPlanRestrictions.globalPlanId })
      .from(schema.branchCatalogPlanRestrictions)
      .where(
        and(
          eq(schema.branchCatalogPlanRestrictions.tenantId, resolvedContext.tenantId),
          eq(schema.branchCatalogPlanRestrictions.branchId, resolvedContext.branchId),
          eq(schema.branchCatalogPlanRestrictions.restricted, true),
          inArray(
            schema.branchCatalogPlanRestrictions.globalPlanId,
            globalRows.map((row) => row.planId),
          ),
        ),
      );
    const restrictedPlanIds = new Set(restrictions.map((restriction) => restriction.globalPlanId));
    allowedGlobalRows = globalRows.filter((row) => !restrictedPlanIds.has(row.planId));
  }

  const privateRows = privateEnabled
    ? await db
        .select({
          planId: schema.tenantPrivatePlans.id,
          carrierId: schema.tenantPrivateCarriers.id,
          carrierName: schema.tenantPrivateCarriers.name,
          planName: schema.tenantPrivatePlans.name,
          planType: schema.tenantPrivatePlans.type,
          coverage: schema.tenantPrivatePlans.coverage,
          maxEntryAge: schema.tenantPrivatePlans.maxEntryAge,
        })
        .from(schema.tenantPrivatePlans)
        .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivatePlans.carrierId, schema.tenantPrivateCarriers.id))
        .where(
          and(
            eq(schema.tenantPrivatePlans.tenantId, resolvedContext.tenantId),
            eq(schema.tenantPrivatePlans.active, true),
            eq(schema.tenantPrivateCarriers.active, true),
          ),
        )
        .orderBy(asc(schema.tenantPrivateCarriers.name), asc(schema.tenantPrivatePlans.name))
    : [];

  return [
    ...allowedGlobalRows.map((row) => ({ ...row, source: "global" as const })),
    ...privateRows.map((row) => ({ ...row, source: "tenant_private" as const })),
  ];
}

export async function getGlobalCatalogAdminData() {
  const db = getDatabase();
  const [enabled, privateEnabled, carriers] = await Promise.all([
    isGlobalCatalogEnabled(),
    isTenantPrivateCatalogEnabled(),
    db
      .select({
        id: schema.globalCarriers.id,
        name: schema.globalCarriers.name,
        description: schema.globalCarriers.description,
        logoUrl: schema.globalCarriers.logoUrl,
        ansCode: schema.globalCarriers.ansCode,
        status: schema.globalCarriers.status,
      })
      .from(schema.globalCarriers)
      .orderBy(asc(schema.globalCarriers.name)),
  ]);

  return { enabled, privateEnabled, carriers };
}

export async function getTenantPrivateCatalogData(context?: TenantContext) {
  const resolvedContext = context ?? await getRequiredTenantContext();
  const db = getDatabase();
  const [enabled, carriers, plans] = await Promise.all([
    isTenantPrivateCatalogEnabled(),
    db
      .select({
        id: schema.tenantPrivateCarriers.id,
        name: schema.tenantPrivateCarriers.name,
        ansCode: schema.tenantPrivateCarriers.ansCode,
        active: schema.tenantPrivateCarriers.active,
      })
      .from(schema.tenantPrivateCarriers)
      .where(eq(schema.tenantPrivateCarriers.tenantId, resolvedContext.tenantId))
      .orderBy(asc(schema.tenantPrivateCarriers.name)),
    db
      .select({
        id: schema.tenantPrivatePlans.id,
        carrierId: schema.tenantPrivatePlans.carrierId,
        carrierName: schema.tenantPrivateCarriers.name,
        name: schema.tenantPrivatePlans.name,
        type: schema.tenantPrivatePlans.type,
        active: schema.tenantPrivatePlans.active,
      })
      .from(schema.tenantPrivatePlans)
      .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivatePlans.carrierId, schema.tenantPrivateCarriers.id))
      .where(eq(schema.tenantPrivatePlans.tenantId, resolvedContext.tenantId))
      .orderBy(asc(schema.tenantPrivateCarriers.name), asc(schema.tenantPrivatePlans.name)),
  ]);

  return { enabled, carriers, plans };
}
