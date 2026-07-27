"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnyRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { GoalActionState } from "./schema";
import { goalInputSchema } from "./schema";
import { calculateGoalProgress } from "./goals-service";

// ─── Auth helpers ─────────────────────────────────────────────────────────

async function getManagedContext() {
  const context = await getRequiredTenantContext();
  requireAnyRole(context, ["director", "manager"] as const);
  return context;
}

function actionError(error: unknown): GoalActionState {
  return {
    error:
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação.",
  };
}

// ─── Create goal ──────────────────────────────────────────────────────────

export async function createGoalAction(
  _previous: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const raw = {
    name: formData.get("name"),
    scope: formData.get("scope"),
    scopeId: formData.get("scopeId") || null,
    targetType: formData.get("targetType"),
    targetValue: parseNumeric(formData.get("targetValue")),
    period: formData.get("period"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    active: formData.get("active") !== "false",
  };

  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getManagedContext();
    const db = getDatabase();

    const [goal] = await db
      .insert(schema.goals)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        name: parsed.data.name,
        scope: parsed.data.scope,
        scopeId: parsed.data.scopeId || null,
        targetType: parsed.data.targetType,
        targetValue: String(parsed.data.targetValue),
        period: parsed.data.period,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        active: parsed.data.active,
        createdBy: context.userId,
      })
      .returning({ id: schema.goals.id });

    // Calculate initial progress for the new goal
    try {
      await calculateGoalProgress(goal.id);
    } catch {
      // Non-critical — progress can be recalculated later
    }

    revalidatePath("/metas");
    revalidatePath("/minha-meta");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Update goal ──────────────────────────────────────────────────────────

export async function updateGoalAction(
  _previous: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = z.string().trim().min(1).safeParse(formData.get("goalId"));
  if (!goalId.success) return { error: "Meta inválida." };

  const raw = {
    name: formData.get("name"),
    scope: formData.get("scope"),
    scopeId: formData.get("scopeId") || null,
    targetType: formData.get("targetType"),
    targetValue: parseNumeric(formData.get("targetValue")),
    period: formData.get("period"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    active: formData.get("active") !== "false",
  };

  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getManagedContext();
    const db = getDatabase();

    const result = await db
      .update(schema.goals)
      .set({
        name: parsed.data.name,
        scope: parsed.data.scope,
        scopeId: parsed.data.scopeId || null,
        targetType: parsed.data.targetType,
        targetValue: String(parsed.data.targetValue),
        period: parsed.data.period,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        active: parsed.data.active,
      })
      .where(
        and(
          eq(schema.goals.id, goalId.data),
          eq(schema.goals.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.goals.id });

    if (result.length === 0) return { error: "Meta não encontrada." };

    // Recalculate progress after update
    try {
      await calculateGoalProgress(goalId.data);
    } catch {
      // Non-critical
    }

    revalidatePath("/metas");
    revalidatePath("/minha-meta");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Toggle goal active ───────────────────────────────────────────────────

export async function toggleGoalAction(
  _previous: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = z.string().trim().min(1).safeParse(formData.get("goalId"));
  if (!goalId.success) return { error: "Meta inválida." };

  try {
    const context = await getManagedContext();
    const db = getDatabase();

    const [goal] = await db
      .select({ id: schema.goals.id, active: schema.goals.active })
      .from(schema.goals)
      .where(
        and(
          eq(schema.goals.id, goalId.data),
          eq(schema.goals.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!goal) return { error: "Meta não encontrada." };

    await db
      .update(schema.goals)
      .set({ active: !goal.active })
      .where(eq(schema.goals.id, goal.id));

    revalidatePath("/metas");
    revalidatePath("/minha-meta");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Delete goal ──────────────────────────────────────────────────────────

export async function deleteGoalAction(
  _previous: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = z.string().trim().min(1).safeParse(formData.get("goalId"));
  if (!goalId.success) return { error: "Meta inválida." };

  try {
    const context = await getManagedContext();
    const db = getDatabase();

    const result = await db
      .delete(schema.goals)
      .where(
        and(
          eq(schema.goals.id, goalId.data),
          eq(schema.goals.tenantId, context.tenantId),
        ),
      )
      .returning({ id: schema.goals.id });

    if (result.length === 0) return { error: "Meta não encontrada." };
    revalidatePath("/metas");
    revalidatePath("/minha-meta");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Recalculate progress ─────────────────────────────────────────────────

export async function recalculateGoalProgressAction(
  _previous: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = z.string().trim().min(1).safeParse(formData.get("goalId"));
  if (!goalId.success) return { error: "Meta inválida." };

  try {
    const context = await getManagedContext();
    const goal = await dbSelectGoal(context.tenantId, goalId.data);
    if (!goal) return { error: "Meta não encontrada." };

    await calculateGoalProgress(goalId.data);

    revalidatePath("/metas");
    revalidatePath("/minha-meta");
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseNumeric(value: FormDataEntryValue | null): number {
  if (!value || typeof value !== "string") return 0;
  const parsed = parseFloat(value.replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
}

async function dbSelectGoal(tenantId: string, goalId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({ id: schema.goals.id })
    .from(schema.goals)
    .where(
      and(
        eq(schema.goals.tenantId, tenantId),
        eq(schema.goals.id, goalId),
      ),
    )
    .limit(1);
  return row ?? null;
}
