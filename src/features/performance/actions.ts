"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { awardInputSchema, resetSeasonSchema, seasonInputSchema, type PerformanceActionState } from "./schema";

async function directorContext() {
  const context = await getRequiredTenantContext();
  requireAnyRole(context, ["director"] as const);
  if ((await getSystemSetting("feature_performance_ranking_enabled")) === "false") {
    throw new Error("O ranking está temporariamente desativado pela plataforma.");
  }
  return context;
}

function message(error: unknown): PerformanceActionState {
  return { error: error instanceof Error ? error.message : "Não foi possível salvar a configuração." };
}

async function audit(userId: string, entityId: string, action: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "performance_season", entidadeId: entityId, acao: action });
}

function revalidatePerformance() {
  revalidatePath("/metas");
  revalidatePath("/metas/desempenho");
  revalidatePath("/dashboard");
}

export async function createSeasonAction(_: PerformanceActionState, formData: FormData): Promise<PerformanceActionState> {
  const parsed = seasonInputSchema.safeParse({ name: formData.get("name"), startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), activate: formData.get("activate") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const context = await directorContext();
    const now = new Date();
    const id = randomUUID();
    await getDatabase().transaction(async (tx) => {
      if (parsed.data.activate) {
        await tx.update(schema.performanceSeasons).set({ status: "closed", endsAt: now, closedBy: context.userId, updatedAt: now }).where(and(eq(schema.performanceSeasons.tenantId, context.tenantId), eq(schema.performanceSeasons.status, "active")));
      }
      await tx.insert(schema.performanceSeasons).values({ id, tenantId: context.tenantId, name: parsed.data.name, status: parsed.data.activate ? "active" : "draft", startsAt: new Date(parsed.data.startsAt), endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null, createdBy: context.userId });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "performance_season", entidadeId: id, acao: parsed.data.activate ? "performance.season_created_active" : "performance.season_created" });
    });
    revalidatePerformance();
    return { success: parsed.data.activate ? "Temporada ativada. O ranking agora usa este período." : "Rascunho de temporada criado." };
  } catch (error) { return message(error); }
}

export async function activateSeasonAction(_: PerformanceActionState, formData: FormData): Promise<PerformanceActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("seasonId"));
  if (!parsed.success) return { error: "Temporada inválida." };
  try {
    const context = await directorContext(); const db = getDatabase(); const now = new Date();
    const [season] = await db.select({ id: schema.performanceSeasons.id, status: schema.performanceSeasons.status }).from(schema.performanceSeasons).where(and(eq(schema.performanceSeasons.id, parsed.data), eq(schema.performanceSeasons.tenantId, context.tenantId))).limit(1);
    if (!season || season.status === "archived") return { error: "Esta temporada não pode ser ativada." };
    await db.transaction(async (tx) => {
      await tx.update(schema.performanceSeasons).set({ status: "closed", endsAt: now, closedBy: context.userId, updatedAt: now }).where(and(eq(schema.performanceSeasons.tenantId, context.tenantId), eq(schema.performanceSeasons.status, "active")));
      await tx.update(schema.performanceSeasons).set({ status: "active", endsAt: null, closedBy: null, updatedAt: now }).where(and(eq(schema.performanceSeasons.id, season.id), eq(schema.performanceSeasons.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "performance_season", entidadeId: season.id, acao: "performance.season_activated" });
    });
    revalidatePerformance(); return { success: "Temporada ativada." };
  } catch (error) { return message(error); }
}

export async function resetRankingAction(_: PerformanceActionState, formData: FormData): Promise<PerformanceActionState> {
  const parsed = resetSeasonSchema.safeParse({ name: formData.get("name"), reason: formData.get("reason") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const context = await directorContext(); const db = getDatabase(); const now = new Date(); const nextId = randomUUID();
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ id: schema.performanceSeasons.id }).from(schema.performanceSeasons).where(and(eq(schema.performanceSeasons.tenantId, context.tenantId), eq(schema.performanceSeasons.status, "active"))).limit(1);
      if (current) {
        await tx.update(schema.performanceSeasons).set({ status: "closed", endsAt: now, resetAt: now, resetReason: parsed.data.reason || "Reinício manual pelo Diretor", closedBy: context.userId, updatedAt: now }).where(eq(schema.performanceSeasons.id, current.id));
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "performance_season", entidadeId: current.id, acao: "performance.ranking_reset" });
      }
      await tx.insert(schema.performanceSeasons).values({ id: nextId, tenantId: context.tenantId, name: parsed.data.name, status: "active", startsAt: now, createdBy: context.userId });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "performance_season", entidadeId: nextId, acao: "performance.season_started_after_reset" });
    });
    revalidatePerformance(); return { success: "Ranking reiniciado com uma nova temporada. O histórico anterior foi preservado." };
  } catch (error) { return message(error); }
}

export async function createAwardAction(_: PerformanceActionState, formData: FormData): Promise<PerformanceActionState> {
  const parsed = awardInputSchema.safeParse({ seasonId: formData.get("seasonId"), rankPosition: formData.get("rankPosition"), title: formData.get("title"), description: formData.get("description") || undefined, rewardType: formData.get("rewardType"), rewardValue: formData.get("rewardValue") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const context = await directorContext(); const db = getDatabase();
    const [season] = await db.select({ id: schema.performanceSeasons.id }).from(schema.performanceSeasons).where(and(eq(schema.performanceSeasons.id, parsed.data.seasonId), eq(schema.performanceSeasons.tenantId, context.tenantId))).limit(1);
    if (!season) return { error: "Temporada não encontrada." };
    const id = randomUUID();
    await db.insert(schema.performanceAwards).values({ id, tenantId: context.tenantId, seasonId: season.id, rankPosition: parsed.data.rankPosition, title: parsed.data.title, description: parsed.data.description || null, rewardType: parsed.data.rewardType, rewardValue: parsed.data.rewardValue || null, createdBy: context.userId });
    await audit(context.userId, id, "performance.award_created"); revalidatePerformance(); return { success: "Premiação adicionada à temporada." };
  } catch (error) { return message(error); }
}
