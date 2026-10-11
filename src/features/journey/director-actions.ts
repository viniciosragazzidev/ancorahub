"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { ENGAGEMENT_RULE_KEYS, ENGAGEMENT_RULES, engagementOverridesSchema, resolveRules } from "@/features/engagement/catalog";
import { journeyRankingTag } from "@/features/engagement/journey-cache";
import { journeyUserIdSchema } from "@/features/engagement/journey-validation";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import type { JourneyActionResponse, ReverseJourneyEventInput, UpdateJourneyRuleInput } from "./director-types";

const ruleInput = z.object({ ruleKey: z.enum(ENGAGEMENT_RULE_KEYS), enabled: z.boolean(), points: z.number().int().min(0).max(500), dailyCap: z.number().int().min(1).max(100).nullable() }).strict();
const reverseInput = z.object({ eventId: journeyUserIdSchema, reason: z.string().trim().min(3).max(200) }).strict();

async function directorEnabled() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return null;
  if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return null;
  if (await getFeatureFlag(FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS).catch(() => "false") !== "true") return null;
  return context;
}

function overrideRows(rules: ReturnType<typeof resolveRules>) {
  return Object.fromEntries(ENGAGEMENT_RULE_KEYS.map((key) => {
    const base = ENGAGEMENT_RULES[key];
    const current = rules[key];
    return [key, current.enabled === base.enabled && current.points === base.points && current.dailyCap === base.dailyCap
      ? undefined
      : { enabled: current.enabled, points: current.points, dailyCap: current.dailyCap }];
  }).filter((entry) => entry[1] !== undefined));
}

export async function updateJourneyRuleAction(input: UpdateJourneyRuleInput): Promise<JourneyActionResponse> {
  const parsed = ruleInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Confira os pontos e o limite diário." };
  if ((parsed.data.ruleKey === "duty.presence" || parsed.data.ruleKey === "sale.approved") && parsed.data.enabled) return { ok: false, message: "Essa regra aguarda aprovação jurídica ou comercial." };
  const context = await directorEnabled().catch(() => null);
  if (!context) return { ok: false, message: "Ajustes de regras indisponíveis para este perfil." };
  const db = getDatabase();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"journey-settings:" + context.tenantId}))`);
      const [row] = await tx.select().from(schema.engagementSettings).where(eq(schema.engagementSettings.tenantId, context.tenantId)).limit(1).for("update");
      const current = resolveRules(row?.rules);
      current[parsed.data.ruleKey] = { ...current[parsed.data.ruleKey], enabled: parsed.data.enabled, points: parsed.data.points, dailyCap: parsed.data.dailyCap };
      const rules = overrideRows(current);
      const checked = engagementOverridesSchema.safeParse(rules);
      if (!checked.success) throw new Error("Invalid rule override.");
      const now = new Date();
      await tx.insert(schema.engagementSettings).values({ tenantId: context.tenantId, rules: checked.data, updatedBy: context.userId, updatedAt: now })
        .onConflictDoUpdate({ target: schema.engagementSettings.tenantId, set: { rules: checked.data, updatedBy: context.userId, updatedAt: now } });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "engagement_settings", entidadeId: context.tenantId,
        acao: "rule.updated:" + parsed.data.ruleKey + ":enabled=" + parsed.data.enabled + ":points=" + parsed.data.points + ":dailyCap=" + (parsed.data.dailyCap ?? "none"), createdAt: now });
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível salvar a regra." };
  }
}

export async function restoreJourneyRulesAction(): Promise<JourneyActionResponse> {
  const context = await directorEnabled().catch(() => null);
  if (!context) return { ok: false, message: "Ajustes de regras indisponíveis para este perfil." };
  try {
    const now = new Date();
    await getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"journey-settings:" + context.tenantId}))`);
      await tx.insert(schema.engagementSettings).values({ tenantId: context.tenantId, rules: {}, updatedBy: context.userId, updatedAt: now })
        .onConflictDoUpdate({ target: schema.engagementSettings.tenantId, set: { rules: {}, updatedBy: context.userId, updatedAt: now } });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "engagement_settings", entidadeId: context.tenantId, acao: "rules.restored_default", createdAt: now });
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível restaurar as regras." };
  }
}

export async function reverseJourneyEventAction(input: ReverseJourneyEventInput): Promise<JourneyActionResponse> {
  const parsed = reverseInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe um motivo de 3 a 200 caracteres." };
  const context = await directorEnabled().catch(() => null);
  if (!context) return { ok: false, message: "A auditoria está indisponível para este perfil." };
  try {
    return await getDatabase().transaction(async (tx) => {
      const [event] = await tx.select({ id: schema.engagementPointEvents.id, brokerId: schema.engagementPointEvents.brokerId, idempotencyKey: schema.engagementPointEvents.idempotencyKey, reversedAt: schema.engagementPointEvents.reversedAt })
        .from(schema.engagementPointEvents).where(and(eq(schema.engagementPointEvents.tenantId, context.tenantId), eq(schema.engagementPointEvents.id, parsed.data.eventId))).limit(1).for("update");
      if (!event) return { ok: false, message: "Ponto não encontrado." } as const;
      if (event.reversedAt) return { ok: true } as const;
      const now = new Date();
      await tx.update(schema.engagementPointEvents).set({ reversedAt: now, reversalReason: parsed.data.reason })
        .where(and(eq(schema.engagementPointEvents.tenantId, context.tenantId), eq(schema.engagementPointEvents.id, event.id), isNull(schema.engagementPointEvents.reversedAt)));
      await tx.update(schema.engagementCelebrations).set({ seenAt: now })
        .where(and(eq(schema.engagementCelebrations.tenantId, context.tenantId), or(
          eq(schema.engagementCelebrations.idempotencyKey, "points:" + event.idempotencyKey),
          eq(schema.engagementCelebrations.idempotencyKey, event.idempotencyKey),
        ), isNull(schema.engagementCelebrations.seenAt)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "engagement_point_event", entidadeId: event.id, acao: "points.reversed:" + parsed.data.reason, createdAt: now });
      return { ok: true } as const;
    }).then((result) => { if (result.ok) updateTag(journeyRankingTag(context.tenantId)); return result; });
  } catch {
    return { ok: false, message: "Não foi possível estornar o ponto." };
  }
}

export async function updateRule(input: UpdateJourneyRuleInput): Promise<JourneyActionResponse> {
  return updateJourneyRuleAction(input);
}

export async function restoreRules(): Promise<JourneyActionResponse> {
  return restoreJourneyRulesAction();
}

export async function reverseEvent(input: ReverseJourneyEventInput): Promise<JourneyActionResponse> {
  return reverseJourneyEventAction(input);
}
