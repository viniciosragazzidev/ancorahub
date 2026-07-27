"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { FIXED_CARRIERS } from "./constants";
import type { CatalogActionState } from "./types";

// ─── Auth helper ──────────────────────────────────────────────────────────

async function getDirectorContext() {
  const context = await getRequiredTenantContext();
  requireRole(context, "director");
  return context;
}

function actionError(error: unknown): CatalogActionState {
  if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
    return { error: "Já existe um registro com esses dados." };
  }
  return { error: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
}

// ─── Carrier seed ─────────────────────────────────────────────────────────

export async function seedCarriersAction(): Promise<CatalogActionState> {
  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    const existing = await db
      .select({ name: schema.carriers.name })
      .from(schema.carriers)
      .where(eq(schema.carriers.tenantId, context.tenantId));

    const existingNames = new Set(existing.map((c) => c.name));

    const toInsert = FIXED_CARRIERS
      .filter((name) => !existingNames.has(name))
      .map((name) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        name,
        status: "active" as const,
      }));

    if (toInsert.length > 0) {
      await db.insert(schema.carriers).values(toInsert);
    }

    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── List carriers ────────────────────────────────────────────────────────

export async function getCarriers() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const rows = await db
    .select({
      id: schema.carriers.id,
      tenantId: schema.carriers.tenantId,
      name: schema.carriers.name,
      ansCode: schema.carriers.ansCode,
      contact: schema.carriers.contact,
      phone: schema.carriers.phone,
      email: schema.carriers.email,
      status: schema.carriers.status,
      notes: schema.carriers.notes,
      planCount: sql<number>`count(${schema.carrierPlans.id})::int`,
    })
    .from(schema.carriers)
    .leftJoin(
      schema.carrierPlans,
      and(
        eq(schema.carrierPlans.carrierId, schema.carriers.id),
        eq(schema.carrierPlans.active, true),
      ),
    )
    .where(eq(schema.carriers.tenantId, context.tenantId))
    .groupBy(schema.carriers.id)
    .orderBy(schema.carriers.name);

  return rows;
}
// ─── Update carrier ───────────────────────────────────────────────────────

const carrierUpdateInput = z.object({
  carrierId: z.string().trim().min(1, "Operadora inválida."),
  ansCode: z.string().trim().max(20).optional(),
  contact: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).email("E-mail inválido.").optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(500).optional(),
});

export async function updateCarrierAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = carrierUpdateInput.safeParse({
    carrierId: formData.get("carrierId"),
    ansCode: formData.get("ansCode") || undefined,
    contact: formData.get("contact") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    const result = await getDatabase()
      .update(schema.carriers)
      .set({
        ansCode: parsed.data.ansCode || null,
        contact: parsed.data.contact || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      })
      .where(
        and(
          eq(schema.carriers.id, parsed.data.carrierId),
          eq(schema.carriers.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.carriers.id });

    if (result.length === 0) return { error: "Operadora não encontrada." };
    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Toggle carrier status ────────────────────────────────────────────────

export async function toggleCarrierAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const carrierId = z.string().trim().min(1).safeParse(formData.get("carrierId"));
  if (!carrierId.success) return { error: "Operadora inválida." };

  try {
    const context = await getDirectorContext();
    const [carrier] = await getDatabase()
      .select({ id: schema.carriers.id, status: schema.carriers.status })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.id, carrierId.data), eq(schema.carriers.tenantId, context.tenantId)))
      .limit(1);
    if (!carrier) return { error: "Operadora não encontrada." };

    await getDatabase()
      .update(schema.carriers)
      .set({ status: carrier.status === "active" ? "inactive" : "active" })
      .where(eq(schema.carriers.id, carrier.id));

    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── List plans for a carrier ─────────────────────────────────────────────

export async function getCarrierPlans(carrierId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [carrier] = await db
    .select({ id: schema.carriers.id, tenantId: schema.carriers.tenantId })
    .from(schema.carriers)
    .where(and(eq(schema.carriers.id, carrierId), eq(schema.carriers.tenantId, context.tenantId)))
    .limit(1);

  if (!carrier) return [];

  return db
    .select()
    .from(schema.carrierPlans)
    .where(and(eq(schema.carrierPlans.carrierId, carrierId), eq(schema.carrierPlans.tenantId, context.tenantId)))
    .orderBy(schema.carrierPlans.name);
}

// ─── Create plan ──────────────────────────────────────────────────────────

const planInput = z.object({
  carrierId: z.string().trim().min(1, "Operadora inválida."),
  name: z.string().trim().min(2, "Informe o nome do plano.").max(200),
  type: z.enum(["individual", "empresarial", "familiar", "pme"]),
  description: z.string().trim().max(500).optional(),
  coverage: z.string().trim().max(100).optional(),
  ansRegistration: z.string().trim().max(20).optional(),
  maxEntryAge: z.coerce.number().int().positive().optional(),
  active: z.coerce.boolean().optional(),
});

export async function createPlanAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = planInput.safeParse({
    carrierId: formData.get("carrierId"),
    name: formData.get("name"),
    type: formData.get("type") || "individual",
    description: formData.get("description") || undefined,
    coverage: formData.get("coverage") || undefined,
    ansRegistration: formData.get("ansRegistration") || undefined,
    maxEntryAge: formData.get("maxEntryAge") || undefined,
    active: formData.get("active") !== "false",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    const [carrier] = await getDatabase()
      .select({ id: schema.carriers.id })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.id, parsed.data.carrierId), eq(schema.carriers.tenantId, context.tenantId)))
      .limit(1);
    if (!carrier) return { error: "Operadora não encontrada." };

    await getDatabase().insert(schema.carrierPlans).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      carrierId: parsed.data.carrierId,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description || null,
      coverage: parsed.data.coverage || null,
      ansRegistration: parsed.data.ansRegistration || null,
      maxEntryAge: parsed.data.maxEntryAge || null,
      active: parsed.data.active ?? true,
    });

    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Update plan ───────────────────────────────────────────────────────────

const planUpdateInput = z.object({
  planId: z.string().trim().min(1, "Plano inválido."),
  name: z.string().trim().min(2, "Informe o nome do plano.").max(200),
  type: z.enum(["individual", "empresarial", "familiar", "pme"]),
  description: z.string().trim().max(500).optional(),
  coverage: z.string().trim().max(100).optional(),
  ansRegistration: z.string().trim().max(20).optional(),
  maxEntryAge: z.coerce.number().int().positive().optional().nullable(),
});

export async function updatePlanAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = planUpdateInput.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    type: formData.get("type") || "individual",
    description: formData.get("description") || undefined,
    coverage: formData.get("coverage") || undefined,
    ansRegistration: formData.get("ansRegistration") || undefined,
    maxEntryAge: formData.get("maxEntryAge") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    const result = await getDatabase()
      .update(schema.carrierPlans)
      .set({
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description || null,
        coverage: parsed.data.coverage || null,
        ansRegistration: parsed.data.ansRegistration || null,
        maxEntryAge: parsed.data.maxEntryAge ?? null,
      })
      .where(
        and(
          eq(schema.carrierPlans.id, parsed.data.planId),
          eq(schema.carrierPlans.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.carrierPlans.id });

    if (result.length === 0) return { error: "Plano não encontrado." };
    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Toggle plan active ───────────────────────────────────────────────────

export async function togglePlanAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const planId = z.string().trim().min(1).safeParse(formData.get("planId"));
  if (!planId.success) return { error: "Plano inválido." };

  try {
    const context = await getDirectorContext();
    const [plan] = await getDatabase()
      .select({ id: schema.carrierPlans.id, active: schema.carrierPlans.active })
      .from(schema.carrierPlans)
      .where(and(eq(schema.carrierPlans.id, planId.data), eq(schema.carrierPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) return { error: "Plano não encontrado." };

    await getDatabase()
      .update(schema.carrierPlans)
      .set({ active: !plan.active })
      .where(eq(schema.carrierPlans.id, plan.id));

    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Delete plan ──────────────────────────────────────────────────────────

export async function deletePlanAction(
  _previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const planId = z.string().trim().min(1).safeParse(formData.get("planId"));
  if (!planId.success) return { error: "Plano inválido." };

  try {
    const context = await getDirectorContext();
    const result = await getDatabase()
      .delete(schema.carrierPlans)
      .where(
        and(
          eq(schema.carrierPlans.id, planId.data),
          eq(schema.carrierPlans.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.carrierPlans.id });

    if (result.length === 0) return { error: "Plano não encontrado." };
    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Get plan prices ──────────────────────────────────────────────────────

export async function getPlanPrices(planId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.carrierPlanPrices.id,
      ageBand: schema.carrierPlanPrices.ageBand,
      monthlyPrice: schema.carrierPlanPrices.monthlyPrice,
    })
    .from(schema.carrierPlanPrices)
    .where(
      and(
        eq(schema.carrierPlanPrices.planId, planId),
        eq(schema.carrierPlanPrices.tenantId, context.tenantId)
      )
    )
    .orderBy(schema.carrierPlanPrices.ageBand);
}

// ─── Upsert plan prices ───────────────────────────────────────────────────

const planPriceInput = z.object({
  planId: z.string().trim().min(1, "Plano inválido."),
  prices: z.array(
    z.object({
      ageBand: z.string().trim().min(1, "Faixa etária inválida."),
      monthlyPrice: z.number().nonnegative("Preço deve ser positivo."),
    })
  ),
});

export async function upsertPlanPricesAction(
  planId: string,
  prices: { ageBand: string; monthlyPrice: number }[]
): Promise<CatalogActionState> {
  const parsed = planPriceInput.safeParse({ planId, prices });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    // Verify ownership of the plan
    const [plan] = await db
      .select({ id: schema.carrierPlans.id })
      .from(schema.carrierPlans)
      .where(and(eq(schema.carrierPlans.id, planId), eq(schema.carrierPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) return { error: "Plano não encontrado." };

    await db.transaction(async (tx) => {
      // Clear existing prices for this plan
      await tx
        .delete(schema.carrierPlanPrices)
        .where(eq(schema.carrierPlanPrices.planId, planId));

      if (parsed.data.prices.length > 0) {
        await tx.insert(schema.carrierPlanPrices).values(
          parsed.data.prices.map((p) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            planId,
            ageBand: p.ageBand,
            monthlyPrice: p.monthlyPrice.toFixed(2),
          }))
        );
      }
    });

    revalidatePath("/catalogo");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Get carrier by id (for lead form) ────────────────────────────────────

export async function getAllActivePlans() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [legacyPlans, availableCatalogPlans] = await Promise.all([
    db
      .select({
        id: schema.carrierPlans.id,
        name: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
        type: schema.carrierPlans.type,
      })
      .from(schema.carrierPlans)
      .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(
        and(
          eq(schema.carrierPlans.tenantId, context.tenantId),
          eq(schema.carrierPlans.active, true),
          eq(schema.carriers.status, "active"),
        ),
      )
      .orderBy(schema.carriers.name, schema.carrierPlans.name),
    listAvailableCatalogPlans(context),
  ]);

  const seen = new Set<string>();
  const plans: Array<{ id: string; name: string; carrierName: string; type: string }> = [];
  for (const p of legacyPlans) {
    if (!seen.has(p.id)) { seen.add(p.id); plans.push(p); }
  }
  for (const p of availableCatalogPlans) {
    if (!seen.has(p.planId)) {
      seen.add(p.planId);
      plans.push({ id: p.planId, name: p.planName, carrierName: p.carrierName, type: p.planType });
    }
  }
  return plans;
}
