"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { setSystemSetting } from "@/features/system-settings/queries";
import type { CatalogActionState, CatalogSource } from "./types";

const carrierInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da operadora.").max(160),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  ansCode: z.string().trim().max(30).optional(),
});

const planInput = z.object({
  carrierId: z.string().uuid("Operadora inválida."),
  name: z.string().trim().min(2, "Informe o nome do plano.").max(200),
  type: z.enum(["individual", "empresarial", "familiar", "pme"]),
  coverage: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
});

const availabilityInput = z.object({
  tenantId: z.string().uuid("Empresa inválida."),
  globalPlanId: z.string().uuid("Plano inválido."),
  enabled: z.enum(["true", "false"]),
});

const privateTableInput = z.object({
  planId: z.string().uuid("Plano inválido."),
  name: z.string().trim().min(2, "Informe o nome da tabela.").max(160),
  ageBand: z.string().trim().min(1, "Informe a faixa etária.").max(50),
  monthlyPrice: z.coerce.number().positive("Informe um valor mensal válido."),
  effectiveFrom: z.string().trim().min(1, "Informe a vigência."),
});

const globalTableInput = privateTableInput.omit({ planId: true }).extend({
  planId: z.string().uuid("Plano inválido."),
});

function formError(error: unknown): CatalogActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Dados inválidos." };
  if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
    return { error: "Já existe um registro com esses dados." };
  }
  return { error: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
}

async function writeCatalogAudit(input: {
  actorUserId: string;
  source: CatalogSource;
  action: string;
  entityType: string;
  entityId: string;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await getDatabase().insert(schema.catalogAuditEvents).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    tenantId: input.tenantId ?? null,
    source: input.source,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}

async function writePlatformCatalogAudit(input: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
  });
}

export async function setGlobalCatalogCapabilityAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const globalEnabled = formData.get("globalEnabled") === "true";
    const privateEnabled = formData.get("privateEnabled") === "true";
    await Promise.all([
      setSystemSetting("feature_global_catalog_enabled", String(globalEnabled)),
      setSystemSetting("feature_tenant_private_catalog_enabled", String(privateEnabled)),
    ]);
    await writePlatformCatalogAudit({
      actorUserId: admin.userId,
      action: "update_catalog_capabilities",
      targetType: "system_settings",
      targetId: "catalog_capabilities",
      metadata: { globalEnabled, privateEnabled },
    });
    revalidatePath("/super-admin/catalogo");
    revalidatePath("/catalogo/interno");
    return { success: "Capacidades do catálogo atualizadas." };
  } catch (error) {
    return formError(error);
  }
}

export async function createGlobalCarrierAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const input = carrierInput.parse({ name: formData.get("name"), ansCode: formData.get("ansCode") || undefined });
    const id = randomUUID();
    await getDatabase().insert(schema.globalCarriers).values({
      id,
      name: input.name,
      description: input.description || null,
      logoUrl: input.logoUrl || null,
      ansCode: input.ansCode || null,
      status: "draft",
      createdBy: admin.userId,
    });
    await Promise.all([
      writeCatalogAudit({ actorUserId: admin.userId, source: "global", action: "carrier.created", entityType: "global_carrier", entityId: id }),
      writePlatformCatalogAudit({ actorUserId: admin.userId, action: "catalog_carrier_created", targetType: "global_carrier", targetId: id }),
    ]);
    revalidatePath("/super-admin/catalogo");
    return { success: "Operadora oficial criada como rascunho." };
  } catch (error) {
    return formError(error);
  }
}

export async function createGlobalPlanAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const input = planInput.parse({
      carrierId: formData.get("carrierId"),
      name: formData.get("name"),
      type: formData.get("type") || "individual",
      coverage: formData.get("coverage") || undefined,
      description: formData.get("description") || undefined,
    });
    const [carrier] = await getDatabase()
      .select({ id: schema.globalCarriers.id })
      .from(schema.globalCarriers)
      .where(eq(schema.globalCarriers.id, input.carrierId))
      .limit(1);
    if (!carrier) return { error: "Operadora oficial não encontrada." };

    const id = randomUUID();
    await getDatabase().insert(schema.globalPlans).values({
      id,
      carrierId: input.carrierId,
      name: input.name,
      type: input.type,
      description: input.description || null,
      coverage: input.coverage || null,
      status: "draft",
      createdBy: admin.userId,
    });
    await Promise.all([
      writeCatalogAudit({ actorUserId: admin.userId, source: "global", action: "plan.created", entityType: "global_plan", entityId: id, metadata: { carrierId: input.carrierId } }),
      writePlatformCatalogAudit({ actorUserId: admin.userId, action: "catalog_plan_created", targetType: "global_plan", targetId: id }),
    ]);
    revalidatePath("/super-admin/catalogo");
    return { success: "Plano oficial criado como rascunho." };
  } catch (error) {
    return formError(error);
  }
}

export async function publishGlobalPlanAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const planId = z.string().uuid("Plano inválido.").parse(formData.get("planId"));
    const db = getDatabase();
    const [plan] = await db
      .select({ id: schema.globalPlans.id, carrierId: schema.globalPlans.carrierId })
      .from(schema.globalPlans)
      .where(eq(schema.globalPlans.id, planId))
      .limit(1);
    if (!plan) return { error: "Plano oficial não encontrado." };
    await db.transaction(async (tx) => {
      await tx.update(schema.globalCarriers).set({ status: "published" }).where(eq(schema.globalCarriers.id, plan.carrierId));
      await tx.update(schema.globalPlans).set({ status: "published" }).where(eq(schema.globalPlans.id, plan.id));
    });
    await Promise.all([
      writeCatalogAudit({ actorUserId: admin.userId, source: "global", action: "plan.published", entityType: "global_plan", entityId: plan.id }),
      writePlatformCatalogAudit({ actorUserId: admin.userId, action: "catalog_plan_published", targetType: "global_plan", targetId: plan.id }),
    ]);
    revalidatePath("/super-admin/catalogo");
    return { success: "Plano e sua operadora estão publicados." };
  } catch (error) {
    return formError(error);
  }
}

export async function setTenantPlanAvailabilityAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const input = availabilityInput.parse({
      tenantId: formData.get("tenantId"),
      globalPlanId: formData.get("globalPlanId"),
      enabled: formData.get("enabled"),
    });
    const db = getDatabase();
    const [plan, tenant] = await Promise.all([
      db.select({ id: schema.globalPlans.id }).from(schema.globalPlans).where(eq(schema.globalPlans.id, input.globalPlanId)).limit(1),
      db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1),
    ]);
    if (!plan) return { error: "Plano oficial não encontrado." };
    if (!tenant) return { error: "Empresa não encontrada." };
    await db
      .insert(schema.tenantCatalogPlanSettings)
      .values({
        id: randomUUID(),
        tenantId: input.tenantId,
        globalPlanId: input.globalPlanId,
        enabled: input.enabled === "true",
        updatedBy: admin.userId,
      })
      .onConflictDoUpdate({
        target: [schema.tenantCatalogPlanSettings.tenantId, schema.tenantCatalogPlanSettings.globalPlanId],
        set: { enabled: input.enabled === "true", updatedBy: admin.userId, updatedAt: new Date() },
      });
    await Promise.all([
      writeCatalogAudit({ actorUserId: admin.userId, source: "global", action: "availability.changed", entityType: "tenant_catalog_plan_setting", entityId: `${input.tenantId}:${input.globalPlanId}`, tenantId: input.tenantId, metadata: { enabled: input.enabled === "true" } }),
      writePlatformCatalogAudit({ actorUserId: admin.userId, action: "catalog_tenant_availability_changed", targetType: "tenant_catalog_plan_setting", targetId: `${input.tenantId}:${input.globalPlanId}`, metadata: { enabled: input.enabled === "true" } }),
    ]);
    revalidatePath("/super-admin/catalogo");
    return { success: "Disponibilidade atualizada para a corretora." };
  } catch (error) {
    return formError(error);
  }
}

export async function createGlobalPriceTableAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const admin = await getRequiredPlatformAdmin();
    const input = globalTableInput.parse({
      planId: formData.get("planId"),
      name: formData.get("name"),
      ageBand: formData.get("ageBand"),
      monthlyPrice: formData.get("monthlyPrice"),
      effectiveFrom: formData.get("effectiveFrom"),
    });
    const effectiveFrom = new Date(input.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) return { error: "Vigência inválida." };
    const db = getDatabase();
    const [plan] = await db
      .select({ id: schema.globalPlans.id, carrierId: schema.globalPlans.carrierId })
      .from(schema.globalPlans)
      .where(eq(schema.globalPlans.id, input.planId))
      .limit(1);
    if (!plan) return { error: "Plano oficial não encontrado." };
    const tableId = randomUUID();
    const versionId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.update(schema.globalCarriers).set({ status: "published" }).where(eq(schema.globalCarriers.id, plan.carrierId));
      await tx.update(schema.globalPlans).set({ status: "published" }).where(eq(schema.globalPlans.id, plan.id));
      await tx.insert(schema.catalogPriceTables).values({ id: tableId, planId: plan.id, name: input.name, status: "published", createdBy: admin.userId });
      await tx.insert(schema.catalogTableVersions).values({
        id: versionId,
        priceTableId: tableId,
        versionNumber: 1,
        status: "published",
        effectiveFrom,
        sourceLabel: "manual",
        publishedBy: admin.userId,
        publishedAt: new Date(),
      });
      await tx.insert(schema.catalogPriceRows).values({ id: randomUUID(), tableVersionId: versionId, ageBand: input.ageBand, monthlyPrice: String(input.monthlyPrice) });
    });
    await Promise.all([
      writeCatalogAudit({ actorUserId: admin.userId, source: "global", action: "table.published", entityType: "catalog_table_version", entityId: versionId, metadata: { planId: plan.id } }),
      writePlatformCatalogAudit({ actorUserId: admin.userId, action: "catalog_table_published", targetType: "catalog_table_version", targetId: versionId }),
    ]);
    revalidatePath("/super-admin/catalogo");
    return { success: "Tabela oficial publicada." };
  } catch (error) {
    return formError(error);
  }
}

export async function createPrivateCarrierAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");
    const input = carrierInput.parse({ name: formData.get("name"), ansCode: formData.get("ansCode") || undefined });
    const id = randomUUID();
    await getDatabase().insert(schema.tenantPrivateCarriers).values({
      id,
      tenantId: context.tenantId,
      name: input.name,
      ansCode: input.ansCode || null,
      createdBy: context.userId,
    });
    await writeCatalogAudit({ actorUserId: context.userId, tenantId: context.tenantId, source: "tenant_private", action: "carrier.created", entityType: "tenant_private_carrier", entityId: id });
    revalidatePath("/catalogo/interno");
    return { success: "Operadora interna criada." };
  } catch (error) {
    return formError(error);
  }
}

export async function createPrivatePlanAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");
    const input = planInput.parse({
      carrierId: formData.get("carrierId"),
      name: formData.get("name"),
      type: formData.get("type") || "individual",
      coverage: formData.get("coverage") || undefined,
      description: formData.get("description") || undefined,
    });
    const [carrier] = await getDatabase()
      .select({ id: schema.tenantPrivateCarriers.id })
      .from(schema.tenantPrivateCarriers)
      .where(and(eq(schema.tenantPrivateCarriers.id, input.carrierId), eq(schema.tenantPrivateCarriers.tenantId, context.tenantId)))
      .limit(1);
    if (!carrier) return { error: "Operadora interna não encontrada." };
    const id = randomUUID();
    await getDatabase().insert(schema.tenantPrivatePlans).values({
      id,
      tenantId: context.tenantId,
      carrierId: input.carrierId,
      name: input.name,
      type: input.type,
      description: input.description || null,
      coverage: input.coverage || null,
      createdBy: context.userId,
    });
    await writeCatalogAudit({ actorUserId: context.userId, tenantId: context.tenantId, source: "tenant_private", action: "plan.created", entityType: "tenant_private_plan", entityId: id, metadata: { carrierId: input.carrierId } });
    revalidatePath("/catalogo/interno");
    return { success: "Plano interno criado." };
  } catch (error) {
    return formError(error);
  }
}

export async function createPrivatePriceTableAction(formData: FormData): Promise<CatalogActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");
    const input = privateTableInput.parse({
      planId: formData.get("planId"),
      name: formData.get("name"),
      ageBand: formData.get("ageBand"),
      monthlyPrice: formData.get("monthlyPrice"),
      effectiveFrom: formData.get("effectiveFrom"),
    });
    const effectiveFrom = new Date(input.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) return { error: "Vigência inválida." };
    const db = getDatabase();
    const [plan] = await db
      .select({ id: schema.tenantPrivatePlans.id })
      .from(schema.tenantPrivatePlans)
      .where(and(eq(schema.tenantPrivatePlans.id, input.planId), eq(schema.tenantPrivatePlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) return { error: "Plano interno não encontrado." };
    const tableId = randomUUID();
    const versionId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.tenantPrivatePriceTables).values({ id: tableId, tenantId: context.tenantId, planId: plan.id, name: input.name, createdBy: context.userId });
      await tx.insert(schema.tenantPrivateTableVersions).values({
        id: versionId,
        tenantId: context.tenantId,
        priceTableId: tableId,
        versionNumber: 1,
        status: "published",
        effectiveFrom,
        sourceLabel: "manual",
        publishedBy: context.userId,
        publishedAt: new Date(),
      });
      await tx.insert(schema.tenantPrivatePriceRows).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        tableVersionId: versionId,
        ageBand: input.ageBand,
        monthlyPrice: String(input.monthlyPrice),
      });
    });
    await writeCatalogAudit({ actorUserId: context.userId, tenantId: context.tenantId, source: "tenant_private", action: "table.published", entityType: "tenant_private_table_version", entityId: versionId, metadata: { planId: plan.id } });
    revalidatePath("/catalogo/interno");
    return { success: "Tabela interna publicada." };
  } catch (error) {
    return formError(error);
  }
}
