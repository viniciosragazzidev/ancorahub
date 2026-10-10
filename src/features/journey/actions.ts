"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { journeyRankingTag } from "@/features/engagement/journey-cache";

export type JourneyActionResult = { ok: true } | { ok: false; message: string };
const idsSchema = z.array(z.string().trim().min(1).max(80)).max(20);

async function journeyContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return null;
  return context;
}

export async function markJourneyCelebrationsSeenAction(ids: string[]): Promise<JourneyActionResult> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, message: "Selecione até 20 avisos válidos. Tente novamente." };
  try {
    const context = await journeyContext();
    if (!context) return { ok: false, message: "Sua jornada não está disponível agora." };
    if (!parsed.data.length) return { ok: true };
    await getDatabase().transaction(async (tx) => {
      const rows = await tx.update(schema.engagementCelebrations).set({ seenAt: new Date() }).where(and(
        eq(schema.engagementCelebrations.tenantId, context.tenantId), eq(schema.engagementCelebrations.userId, context.userId),
        inArray(schema.engagementCelebrations.id, [...new Set(parsed.data)]), isNull(schema.engagementCelebrations.seenAt),
      )).returning({ id: schema.engagementCelebrations.id });
      if (rows.length) await tx.insert(schema.auditLogs).values(rows.map((row) => ({ id: randomUUID(), userId: context.userId, entidade: "journey_celebration", entidadeId: `${context.tenantId}:${row.id}`, acao: "journey.celebration_seen" })));
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível confirmar. Tente novamente." };
  }
}

export async function setRankingOptOutAction(optOut: boolean): Promise<JourneyActionResult> {
  const parsed = z.boolean().safeParse(optOut);
  if (!parsed.success) return { ok: false, message: "Escolha se quer aparecer no placar." };
  try {
    const context = await journeyContext();
    if (!context) return { ok: false, message: "Sua jornada não está disponível agora." };
    await getDatabase().transaction(async (tx) => {
      const [membership] = await tx.update(schema.tenantMemberships).set({ rankingOptOut: parsed.data, updatedAt: new Date() }).where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId),
        eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"),
      )).returning({ id: schema.tenantMemberships.id });
      if (!membership) throw new Error("membership unavailable");
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: membership.id, acao: parsed.data ? "journey.ranking_opt_out_enabled" : "journey.ranking_opt_out_disabled" });
    });
    updateTag(journeyRankingTag(context.tenantId));
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}
