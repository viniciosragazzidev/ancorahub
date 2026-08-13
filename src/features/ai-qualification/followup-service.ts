import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

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
  enabled: z.boolean().default(true),
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

export async function getFollowUpRules(tenantId: string) {
  const db = getDatabase();

  try {
    const rules = await db
      .select()
      .from(schema.aiQualificationFollowUpRules)
      .where(eq(schema.aiQualificationFollowUpRules.tenantId, tenantId));

    if (rules.length > 0) {
      return rules;
    }

    // Seed default follow-up rule if none exists
    const now = new Date();
    const defaultRuleId = randomUUID();
    await db
      .insert(schema.aiQualificationFollowUpRules)
      .values({
        id: defaultRuleId,
        tenantId,
        name: "Lead abandonou a qualificação",
        enabled: true,
        trigger: "qualification_abandoned",
        delayMinutes: 120,
        maxAttempts: 3,
        minimumIntervalMinutes: 60,
        allowedDays: [1, 2, 3, 4, 5],
        allowedStartTime: "08:00",
        allowedEndTime: "18:00",
        timezone: "America/Sao_Paulo",
        messageMode: "fixed",
        fixedMessage: "Olá! Ainda posso te ajudar a encontrar o melhor plano de saúde?",
        stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    return await db
      .select()
      .from(schema.aiQualificationFollowUpRules)
      .where(eq(schema.aiQualificationFollowUpRules.tenantId, tenantId));
  } catch (err) {
    console.error("[followup-service] Error querying rules:", err);
    return [
      {
        id: "default-rule-1",
        tenantId,
        name: "Lead abandonou a qualificação",
        enabled: true,
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

  await db
    .insert(schema.aiQualificationFollowUpRules)
    .values({
      id: ruleId,
      tenantId,
      name: data.name,
      enabled: data.enabled,
      trigger: data.trigger,
      delayMinutes: data.delayMinutes,
      maxAttempts: data.maxAttempts,
      minimumIntervalMinutes: data.minimumIntervalMinutes,
      allowedDays: data.allowedDays,
      allowedStartTime: data.allowedStartTime,
      allowedEndTime: data.allowedEndTime,
      timezone: data.timezone,
      messageMode: data.messageMode,
      fixedMessage: data.fixedMessage,
      templateId: data.templateId,
      stopConditions: data.stopConditions,
      destinationStatus: data.destinationStatus,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.aiQualificationFollowUpRules.id],
      set: {
        name: data.name,
        enabled: data.enabled,
        trigger: data.trigger,
        delayMinutes: data.delayMinutes,
        maxAttempts: data.maxAttempts,
        minimumIntervalMinutes: data.minimumIntervalMinutes,
        allowedDays: data.allowedDays,
        allowedStartTime: data.allowedStartTime,
        allowedEndTime: data.allowedEndTime,
        timezone: data.timezone,
        messageMode: data.messageMode,
        fixedMessage: data.fixedMessage,
        templateId: data.templateId,
        stopConditions: data.stopConditions,
        destinationStatus: data.destinationStatus,
        updatedAt: now,
      },
    });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_followup_rule",
    entidadeId: ruleId,
    acao: data.id ? "followup_rule.updated" : "followup_rule.created",
  });

  return getFollowUpRules(tenantId);
}

export async function deleteFollowUpRule(tenantId: string, actorUserId: string, ruleId: string) {
  const db = getDatabase();
  await db
    .delete(schema.aiQualificationFollowUpRules)
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
