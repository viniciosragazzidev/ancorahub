"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { CommissionActionState } from "./schema";
import { commissionRuleInputSchema } from "./schema";

// ─── Auth helpers ─────────────────────────────────────────────────────────

async function getDirectorContext() {
  const context = await getRequiredTenantContext();
  requireRole(context, "director");
  return context;
}

function actionError(error: unknown): CommissionActionState {
  if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
    return { error: "Já existe um registro com esses dados." };
  }
  return {
    error:
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação.",
  };
}

// ─── Create rule ───────────────────────────────────────────────────────────

export async function createCommissionRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const raw = {
    name: formData.get("name"),
    type: formData.get("type"),
    percentages: parsePercentages(formData.get("percentages")),
    appliesToAll: formData.get("appliesToAll") === "true",
    carrierId: formData.get("carrierId") || null,
    planId: formData.get("planId") || null,
  };

  const parsed = commissionRuleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    await db.insert(schema.commissionRules).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      name: parsed.data.name,
      type: parsed.data.type,
      percentages: parsed.data.percentages,
      appliesToAll: parsed.data.appliesToAll,
      carrierId: parsed.data.carrierId || null,
      planId: parsed.data.planId || null,
      active: true,
      createdBy: context.userId,
    });

    revalidatePath("/configuracoes/comissoes");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Update rule ───────────────────────────────────────────────────────────

export async function updateCommissionRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const ruleId = z.string().trim().min(1).safeParse(formData.get("ruleId"));
  if (!ruleId.success) return { error: "Regra inválida." };

  const raw = {
    name: formData.get("name"),
    type: formData.get("type"),
    percentages: parsePercentages(formData.get("percentages")),
    appliesToAll: formData.get("appliesToAll") === "true",
    carrierId: formData.get("carrierId") || null,
    planId: formData.get("planId") || null,
  };

  const parsed = commissionRuleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    const result = await db
      .update(schema.commissionRules)
      .set({
        name: parsed.data.name,
        type: parsed.data.type,
        percentages: parsed.data.percentages,
        appliesToAll: parsed.data.appliesToAll,
        carrierId: parsed.data.carrierId || null,
        planId: parsed.data.planId || null,
      })
      .where(
        and(
          eq(schema.commissionRules.id, ruleId.data),
          eq(schema.commissionRules.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.commissionRules.id });

    if (result.length === 0) return { error: "Regra não encontrada." };
    revalidatePath("/configuracoes/comissoes");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Toggle rule active ────────────────────────────────────────────────────

export async function toggleCommissionRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const ruleId = z.string().trim().min(1).safeParse(formData.get("ruleId"));
  if (!ruleId.success) return { error: "Regra inválida." };

  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    const [rule] = await db
      .select({ id: schema.commissionRules.id, active: schema.commissionRules.active })
      .from(schema.commissionRules)
      .where(
        and(
          eq(schema.commissionRules.id, ruleId.data),
          eq(schema.commissionRules.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!rule) return { error: "Regra não encontrada." };

    await db
      .update(schema.commissionRules)
      .set({ active: !rule.active })
      .where(eq(schema.commissionRules.id, rule.id));

    revalidatePath("/configuracoes/comissoes");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Delete rule ───────────────────────────────────────────────────────────

export async function deleteCommissionRuleAction(
  _previous: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const ruleId = z.string().trim().min(1).safeParse(formData.get("ruleId"));
  if (!ruleId.success) return { error: "Regra inválida." };

  try {
    const context = await getDirectorContext();
    const db = getDatabase();

    const result = await db
      .delete(schema.commissionRules)
      .where(
        and(
          eq(schema.commissionRules.id, ruleId.data),
          eq(schema.commissionRules.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.commissionRules.id });

    if (result.length === 0) return { error: "Regra não encontrada." };
    revalidatePath("/configuracoes/comissoes");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────

function parsePercentages(value: FormDataEntryValue | null): number[] {
  if (!value || typeof value !== "string") return [100];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed;
    }
    return [100];
  } catch {
    return [100];
  }
}
