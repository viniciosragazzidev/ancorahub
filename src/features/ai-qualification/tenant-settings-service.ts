import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";

export const pauseModeValues = ["finish_active", "handoff_active", "pause_immediately"] as const;
export type PauseMode = (typeof pauseModeValues)[number];

export const updateTenantSettingsSchema = z.object({
  enabled: z.boolean(),
  pauseMode: z.enum(pauseModeValues).default("handoff_active"),
  assistantName: z.string().trim().min(2).max(100).default("Assistente Âncora Corretora"),
  initialMessage: z.string().trim().min(5).max(5000),
  handoffMessage: z.string().trim().min(5).max(5000),
  outOfHoursMessage: z.string().trim().min(5).max(5000),
  absenceMessage: z.string().trim().min(5).max(5000),
  tone: z.string().trim().default("friendly"),
  useEmojis: z.boolean().default(false),
  timeoutMinutes: z.number().int().min(5).max(1440).default(30),
  businessContext: z.string().trim().max(100000).optional().default(""),
  customInstructions: z.string().trim().max(100000).optional().default(""),
  /** Minutos de cooldown antes de repetir o mesmo template de quick reply (default: 10) */
  quickReplyCooldownMinutes: z.number().int().min(1).max(60).default(10),
  /** Janela de tempo (minutos) para contar respostas de "aguardando" (default: 30) */
  quickReplyWaitWindowMinutes: z.number().int().min(5).max(120).default(30),
  /** Máximo de respostas de "aguardando" antes de suprimir (default: 2) */
  quickReplyWaitLimitCount: z.number().int().min(1).max(10).default(2),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

export async function getQualificationTenantSettings(tenantId: string) {
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(schema.aiQualificationConfigs)
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const [created] = await db
    .insert(schema.aiQualificationConfigs)
    .values({
      id: randomUUID(),
      tenantId,
      enabled: false,
      pauseMode: "handoff_active",
      assistantName: "Assistente Âncora Corretora",
      initialMessage:
        "Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento.",
      finalMessage: "Obrigado! Um corretor continuará seu atendimento em seguida.",
      handoffMessage: "Vou encaminhar você para um corretor da equipe agora.",
      outOfHoursMessage:
        "Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.",
      absenceMessage:
        "No momento não há um corretor disponível. Deixaremos seu atendimento na fila.",
      language: "pt-BR",
      tone: "friendly",
      useEmojis: false,
      formOfAddress: "voce",
      maxConversationMinutes: 30,
      maxQuestions: 6,
      objectives: ["understand_need", "route_to_broker"],
      timeoutMinutes: 30,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  return (
    created ??
    (
      await db
        .select()
        .from(schema.aiQualificationConfigs)
        .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
        .limit(1)
    )[0] ??
    null
  );
}

export async function updateQualificationTenantSettings(
  tenantId: string,
  actorUserId: string,
  input: UpdateTenantSettingsInput
) {
  const data = updateTenantSettingsSchema.parse(input);
  const db = getDatabase();
  const current = await getQualificationTenantSettings(tenantId);
  const now = new Date();

  await db
    .update(schema.aiQualificationConfigs)
    .set({
      enabled: data.enabled,
      pauseMode: data.pauseMode,
      assistantName: data.assistantName,
      initialMessage: data.initialMessage,
      handoffMessage: data.handoffMessage,
      outOfHoursMessage: data.outOfHoursMessage,
      absenceMessage: data.absenceMessage,
      tone: data.tone,
      useEmojis: data.useEmojis,
      timeoutMinutes: data.timeoutMinutes,
      businessContext: data.businessContext ?? "",
      customInstructions: data.customInstructions ?? "",
      quickReplyCooldownMinutes: data.quickReplyCooldownMinutes,
      quickReplyWaitWindowMinutes: data.quickReplyWaitWindowMinutes,
      quickReplyWaitLimitCount: data.quickReplyWaitLimitCount,
      version: (current?.version ?? 0) + 1,
      updatedBy: actorUserId,
      updatedAt: now,
    })
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_qualification_config",
    entidadeId: tenantId,
    acao: data.enabled ? "qualification_settings.enabled" : "qualification_settings.disabled",
  });

  return getQualificationTenantSettings(tenantId);
}

export async function isQualificationEnabledForTenant(tenantId: string): Promise<boolean> {
  const [globalEngineEnabled, settings] = await Promise.all([
    getSystemSetting("ai_enabled"),
    getQualificationTenantSettings(tenantId),
  ]);

  if (globalEngineEnabled !== "true") return false;
  return Boolean(settings?.enabled);
}
