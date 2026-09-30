import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getColdLeadReactivationRuleDefaults } from "./cold-lead-reactivation-policy";

export const followUpTriggerValues = [
  "no_first_response",
  "qualification_abandoned",
  "partially_qualified",
  "waiting_broker",
  "quote_without_response",
  "scheduled_return",
  "cold_lead_reactivation",
  "custom",
] as const;

export const followUpRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3).max(100),
  enabled: z.boolean().default(false),
  trigger: z.enum(followUpTriggerValues),
  delayMinutes: z.number().int().min(5).max(10080).default(120),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  minimumIntervalMinutes: z.number().int().min(15).max(1440).default(60),
  allowedDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  allowedStartTime: z.string().default("08:00"),
  allowedEndTime: z.string().default("18:00"),
  timezone: z.string().default("America/Sao_Paulo"),
  messageMode: z.enum(["fixed", "template", "ai_generated"]).default("fixed"),
  fixedMessage: z.string().trim().max(1000).optional(),
  templateId: z.string().trim().optional(),
  stopConditions: z.array(z.string()).default([
    "client_responded",
    "human_taken",
    "lead_closed",
    "sale_completed",
    "opt_out",
  ]),
  destinationStatus: z.string().optional(),
});

export type FollowUpRuleInput = z.infer<typeof followUpRuleSchema>;

/**
 * Only the explicitly approved cold-lead rule is executable. Other rules stay
 * in preparation mode until separately approved and implemented.
 */
export function isFollowUpExecutionAllowed(trigger: string, enabled: boolean) {
  return trigger === "cold_lead_reactivation" && enabled;
}

export async function ensureColdLeadReactivationRule(tenantId: string) {
  const db = getDatabase();
  const id = `cold-lead-reactivation:${tenantId}`;
  const defaults = getColdLeadReactivationRuleDefaults();
  const now = new Date();
  const [initialized] = await db.select({ id: schema.aiQualificationFollowUpRules.id })
    .from(schema.aiQualificationFollowUpRules)
    .where(and(
      eq(schema.aiQualificationFollowUpRules.id, id),
      eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
    )).limit(1);
  if (initialized) return;
  const auditActorUserId = await resolveSystemUserId(tenantId);

  try {
    await db.transaction(async (tx) => {
      const [canonical] = await tx.select({ id: schema.aiQualificationFollowUpRules.id })
        .from(schema.aiQualificationFollowUpRules)
        .where(and(
          eq(schema.aiQualificationFollowUpRules.id, id),
          eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
        )).limit(1);
      // Once initialized, preserve any later pause by the tenant administrator.
      if (canonical) return;

      const [legacy] = await tx.select({ id: schema.aiQualificationFollowUpRules.id })
        .from(schema.aiQualificationFollowUpRules)
        .where(and(
          eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
          eq(schema.aiQualificationFollowUpRules.trigger, "cold_lead_reactivation"),
        )).limit(1);

      if (legacy) {
        const [migrated] = await tx.update(schema.aiQualificationFollowUpRules).set({
          id,
          ...defaults,
          fixedMessage: null,
          templateId: null,
          destinationStatus: null,
          updatedAt: now,
        }).where(and(
          eq(schema.aiQualificationFollowUpRules.id, legacy.id),
          eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
        )).returning({ id: schema.aiQualificationFollowUpRules.id });
        if (!migrated) return;
      } else {
        const [created] = await tx.insert(schema.aiQualificationFollowUpRules).values({
          id,
          tenantId,
          ...defaults,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing().returning({ id: schema.aiQualificationFollowUpRules.id });
        if (!created) return;
      }

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: auditActorUserId,
        entidade: "ai_qualification_followup_rule",
        entidadeId: id,
        acao: legacy ? "followup_rule.cold_lead_reactivation_initialized" : "followup_rule.cold_lead_reactivation_created_default",
        createdAt: now,
      });
    });
  } catch (error) {
    // Concurrent initialization may win the deterministic primary key. If so,
    // its transaction also writes the corresponding audit record.
    const [canonical] = await db.select({ id: schema.aiQualificationFollowUpRules.id })
      .from(schema.aiQualificationFollowUpRules)
      .where(and(
        eq(schema.aiQualificationFollowUpRules.id, id),
        eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
      )).limit(1);
    if (!canonical) throw error;
  }
}

export async function getFollowUpRules(tenantId: string) {
  const db = getDatabase();

  try {
    let rules = await db
      .select()
      .from(schema.aiQualificationFollowUpRules)
      .where(eq(schema.aiQualificationFollowUpRules.tenantId, tenantId));

    if (!rules.some((rule) => rule.trigger === "qualification_abandoned")) {
      const now = new Date();
      await db.insert(schema.aiQualificationFollowUpRules).values({
        id: randomUUID(), tenantId, name: "Lead abandonou a qualificação", enabled: false,
        trigger: "qualification_abandoned", delayMinutes: 120, maxAttempts: 3,
        minimumIntervalMinutes: 60, allowedDays: [1, 2, 3, 4, 5], allowedStartTime: "08:00",
        allowedEndTime: "18:00", timezone: "America/Sao_Paulo", messageMode: "fixed",
        fixedMessage: "Olá! Ainda posso te ajudar a encontrar o melhor plano de saúde?",
        stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
        createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }

    await ensureColdLeadReactivationRule(tenantId);
    rules = await db.select().from(schema.aiQualificationFollowUpRules)
      .where(eq(schema.aiQualificationFollowUpRules.tenantId, tenantId));
    return rules.filter((rule) => rule.trigger !== "cold_lead_reactivation" || rule.id === `cold-lead-reactivation:${tenantId}`);
  } catch (err) {
    console.error("[followup-service] Error querying rules:", err);
    return [
      {
        id: "default-rule-1",
        tenantId,
        name: "Lead abandonou a qualificação",
        enabled: false,
        trigger: "qualification_abandoned",
        delayMinutes: 120,
        maxAttempts: 3,
        minimumIntervalMinutes: 60,
        allowedDays: [1, 2, 3, 4, 5],
        allowedStartTime: "08:00",
        allowedEndTime: "18:00",
        timezone: "America/Sao_Paulo",
        messageMode: "fixed",
        fixedMessage: "Olá! Ainda posso te ajudar com a cotação do seu plano?",
        templateId: null,
        stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
        destinationStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `cold-lead-reactivation:${tenantId}`,
        tenantId,
        ...getColdLeadReactivationRuleDefaults(),
        fixedMessage: null,
        templateId: null,
        destinationStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

export async function saveFollowUpRule(
  tenantId: string,
  actorUserId: string,
  input: FollowUpRuleInput
) {
  const data = followUpRuleSchema.parse(input);
  const db = getDatabase();
  const now = new Date();
  const ruleId = data.id ?? randomUUID();
  const [existing] = data.id
    ? await db.select({ id: schema.aiQualificationFollowUpRules.id, trigger: schema.aiQualificationFollowUpRules.trigger })
        .from(schema.aiQualificationFollowUpRules)
        .where(and(eq(schema.aiQualificationFollowUpRules.id, data.id), eq(schema.aiQualificationFollowUpRules.tenantId, tenantId))).limit(1)
    : [];
  if (data.id && !existing) throw new Error("Regra de follow-up não encontrada nesta empresa.");
  const isColdRule = existing?.trigger === "cold_lead_reactivation" || data.trigger === "cold_lead_reactivation";
  if (isColdRule && !existing) throw new Error("A regra de reativação é criada pelo sistema e só pode ser ativada ou pausada.");
  if (existing?.trigger === "cold_lead_reactivation" && data.trigger !== "cold_lead_reactivation") {
    throw new Error("A regra de reativação não pode ser convertida em outro tipo.");
  }
  const defaults = getColdLeadReactivationRuleDefaults();
  const rule = isColdRule ? { ...defaults, enabled: data.enabled } : data;
  const enabled = isFollowUpExecutionAllowed(rule.trigger, rule.enabled);

  await db
    .insert(schema.aiQualificationFollowUpRules)
    .values({
      id: ruleId,
      tenantId,
      name: rule.name,
      enabled,
      trigger: rule.trigger,
      delayMinutes: rule.delayMinutes,
      maxAttempts: rule.maxAttempts,
      minimumIntervalMinutes: rule.minimumIntervalMinutes,
      allowedDays: rule.allowedDays,
      allowedStartTime: rule.allowedStartTime,
      allowedEndTime: rule.allowedEndTime,
      timezone: rule.timezone,
      messageMode: rule.messageMode,
      fixedMessage: rule.fixedMessage,
      templateId: rule.templateId,
      stopConditions: rule.stopConditions,
      destinationStatus: "destinationStatus" in rule ? rule.destinationStatus : undefined,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.aiQualificationFollowUpRules.id],
      set: {
        name: rule.name,
        enabled,
        trigger: rule.trigger,
        delayMinutes: rule.delayMinutes,
        maxAttempts: rule.maxAttempts,
        minimumIntervalMinutes: rule.minimumIntervalMinutes,
        allowedDays: rule.allowedDays,
        allowedStartTime: rule.allowedStartTime,
        allowedEndTime: rule.allowedEndTime,
        timezone: rule.timezone,
        messageMode: rule.messageMode,
        fixedMessage: rule.fixedMessage,
        templateId: rule.templateId,
        stopConditions: rule.stopConditions,
        destinationStatus: "destinationStatus" in rule ? rule.destinationStatus : null,
        updatedAt: now,
      },
    });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_followup_rule",
    entidadeId: ruleId,
    acao: isColdRule ? "followup_rule.cold_lead_reactivation_updated" : data.id ? "followup_rule.updated_prepared" : "followup_rule.created_prepared",
  });

  return getFollowUpRules(tenantId);
}

export async function deleteFollowUpRule(tenantId: string, actorUserId: string, ruleId: string) {
  const db = getDatabase();
  const [rule] = await db.select({ trigger: schema.aiQualificationFollowUpRules.trigger })
    .from(schema.aiQualificationFollowUpRules)
    .where(and(eq(schema.aiQualificationFollowUpRules.id, ruleId), eq(schema.aiQualificationFollowUpRules.tenantId, tenantId))).limit(1);
  if (rule?.trigger === "cold_lead_reactivation") throw new Error("A regra padrão de reativação não pode ser removida; apenas pausada.");
  await db.delete(schema.aiQualificationFollowUpRules)
    .where(and(eq(schema.aiQualificationFollowUpRules.id, ruleId), eq(schema.aiQualificationFollowUpRules.tenantId, tenantId)));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_followup_rule",
    entidadeId: ruleId,
    acao: "followup_rule.deleted",
  });

  return getFollowUpRules(tenantId);
}
