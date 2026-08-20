"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const settingsSchema = z.object({
  assistantName: z.string().trim().min(2).max(100),
  initialMessage: z.string().trim().min(1).max(5000),
  finalMessage: z.string().trim().min(1).max(5000),
  handoffMessage: z.string().trim().min(1).max(5000),
  outOfHoursMessage: z.string().trim().min(1).max(5000),
  absenceMessage: z.string().trim().min(1).max(5000),
  language: z.enum(["pt-BR", "en", "es"]),
  tone: z.enum(["friendly", "professional", "direct"]),
  useEmojis: z.boolean(),
  formOfAddress: z.enum(["voce", "primeiro_nome", "senhor_senhora"]),
  maxConversationMinutes: z.coerce.number().int().min(5).max(1440),
  maxQuestions: z.coerce.number().int().min(1).max(12),
  objectives: z.array(z.enum(["understand_need", "qualify_budget", "route_to_broker", "schedule_follow_up"])).max(4),
  businessContext: z.string().trim().max(100000).optional().default(""),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional().or(z.literal("")),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional().or(z.literal("")),
  businessDays: z.string().trim().optional().or(z.literal("")),
  requiredFields: z.array(z.string().min(1)).optional().default([]),
  customInstructions: z.string().trim().max(100000).optional().default(""),
});

export type AiTenantSettings = z.infer<typeof settingsSchema> & { enabled: boolean; version: number };

function allowed(context: Awaited<ReturnType<typeof getRequiredTenantContext>>) {
  return context.role === "director";
}

export async function getTenantAiSettings() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [row] = await db.select().from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId)).limit(1);
  return { canEdit: allowed(context), settings: row ?? null };
}

export async function updateTenantAiSettingsAction(_prev: { success: boolean; error?: string }, formData: FormData) {
  try {
    console.info("[ai-settings] update.start");
    const context = await getRequiredTenantContext();
    if (!allowed(context)) return { success: false, error: "Apenas o Diretor pode alterar o atendimento inteligente." };
    const parsed = settingsSchema.safeParse({
      assistantName: formData.get("assistantName"), initialMessage: formData.get("initialMessage"), finalMessage: formData.get("finalMessage"),
      handoffMessage: formData.get("handoffMessage"), outOfHoursMessage: formData.get("outOfHoursMessage"), absenceMessage: formData.get("absenceMessage"),
      language: formData.get("language"), tone: formData.get("tone"), useEmojis: formData.get("useEmojis") === "true",
      formOfAddress: formData.get("formOfAddress"), maxConversationMinutes: formData.get("maxConversationMinutes"), maxQuestions: formData.get("maxQuestions"),
      objectives: formData.getAll("objectives"), businessContext: formData.get("businessContext"),
      businessHoursStart: formData.get("businessHoursStart") || undefined,
      businessHoursEnd: formData.get("businessHoursEnd") || undefined,
      businessDays: formData.get("businessDays") || undefined,
      requiredFields: formData.getAll("requiredFields"),
      customInstructions: formData.get("customInstructions") || "",
    });
    if (!parsed.success) return { success: false, error: "Revise os campos: mensagens, limites e objetivos precisam estar preenchidos corretamente." };
    const db = getDatabase();
    const now = new Date();
    const existing = await db.select({ id: schema.aiQualificationConfigs.id, version: schema.aiQualificationConfigs.version }).from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId)).limit(1);
    const values = { ...parsed.data, version: (existing[0]?.version ?? 0) + 1, updatedBy: context.userId, updatedAt: now };
    await db.transaction(async (tx) => {
      if (existing[0]) await tx.update(schema.aiQualificationConfigs).set(values).where(eq(schema.aiQualificationConfigs.id, existing[0].id));
      else await tx.insert(schema.aiQualificationConfigs).values({ id: randomUUID(), tenantId: context.tenantId, enabled: false, timeoutMinutes: parsed.data.maxConversationMinutes, maxRetries: 2, createdAt: now, ...values });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "ai_qualification_config", entidadeId: context.tenantId, acao: "ai_settings.updated" });
    });
    console.info("[ai-settings] update.success", { tenantId: context.tenantId });
    return { success: true };
  } catch (error) {
    console.error("[ai-settings] update.failed", error instanceof Error ? error.message : "unknown_error");
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível salvar a configuração." };
  }
}
