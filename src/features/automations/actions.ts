"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { type AutomationStatus } from "@/shared/db/schema";

const automationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  triggerType: z.string().min(1),
  templateBody: z.string().trim().min(1).max(2000),
  configuration: z.record(z.string(), z.any()).default({}),
});

const whatsappFlowInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  triggerType: z.string().min(1),
  status: z.string().default("active"),
  configuration: z.record(z.string(), z.any()).default({}),
});

const aiAgentInputSchema = z.object({
  enabled: z.boolean(),
  assistantName: z.string().trim().min(2).max(80),
  initialMessage: z.string().trim().min(1).max(1000),
  finalMessage: z.string().trim().min(1).max(1000),
  handoffMessage: z.string().trim().min(1).max(1000),
  outOfHoursMessage: z.string().trim().min(1).max(1000),
  absenceMessage: z.string().trim().min(1).max(1000),
  language: z.enum(["pt-BR", "en", "es"]),
  tone: z.enum(["friendly", "professional", "direct"]),
  useEmojis: z.boolean(),
  formOfAddress: z.enum(["voce", "primeiro_nome", "senhor_senhora"]),
  maxQuestions: z.coerce.number().int().min(1).max(12),
  businessContext: z.string().trim().max(1200).optional().default(""),
  customInstructions: z.string().trim().max(100000).optional().default(""),
  requiredFields: z.array(z.string()).optional().default([]),
});

async function authorizeDirector() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    throw new Error("Apenas diretores podem gerenciar as configurações operacionais.");
  }
  return context;
}

async function audit(userId: string, entity: string, entityId: string, action: string) {
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: entity,
    entidadeId: entityId,
    acao: action,
  });
}

// ─── CRM AUTOMATIONS ACTIONS ────────────────────────────────────────────────

export async function createAutomationAction(input: unknown) {
  try {
    const context = await authorizeDirector();
    const parsed = automationInputSchema.parse(input);
    const db = getDatabase();
    const id = randomUUID();

    await db.insert(schema.crmAutomations).values({
      id,
      tenantId: context.tenantId,
      name: parsed.name,
      triggerType: parsed.triggerType,
      templateBody: parsed.templateBody,
      configuration: parsed.configuration,
      status: "rascunho",
      createdBy: context.userId,
    });

    await audit(context.userId, "crm_automation", id, "automation.created");
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao criar automação." };
  }
}

export async function updateAutomationAction(id: string, input: {
  name?: string;
  status?: AutomationStatus;
  templateBody?: string;
  configuration?: Record<string, unknown>;
}) {
  try {
    const context = await authorizeDirector();
    const db = getDatabase();

    const [existing] = await db
      .select()
      .from(schema.crmAutomations)
      .where(and(eq(schema.crmAutomations.id, id), eq(schema.crmAutomations.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) throw new Error("Automação não encontrada.");

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.templateBody !== undefined) updateValues.templateBody = input.templateBody;
    if (input.configuration !== undefined) updateValues.configuration = input.configuration;

    await db
      .update(schema.crmAutomations)
      .set(updateValues)
      .where(and(eq(schema.crmAutomations.id, id), eq(schema.crmAutomations.tenantId, context.tenantId)));

    await audit(context.userId, "crm_automation", id, `automation.updated:${input.status ?? "values"}`);
    revalidatePath("/automacoes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao atualizar automação." };
  }
}

export async function deleteAutomationAction(id: string) {
  try {
    const context = await authorizeDirector();
    const db = getDatabase();

    await db
      .delete(schema.crmAutomations)
      .where(and(eq(schema.crmAutomations.id, id), eq(schema.crmAutomations.tenantId, context.tenantId)));

    await audit(context.userId, "crm_automation", id, "automation.deleted");
    revalidatePath("/automacoes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao excluir automação." };
  }
}

// ─── WHATSAPP FLOWS ACTIONS ──────────────────────────────────────────────────

export async function createWhatsappFlowAction(input: unknown) {
  try {
    const context = await authorizeDirector();
    const parsed = whatsappFlowInputSchema.parse(input);
    const db = getDatabase();
    const id = randomUUID();

    await db.insert(schema.whatsappFlows).values({
      id,
      tenantId: context.tenantId,
      name: parsed.name,
      triggerType: parsed.triggerType,
      status: parsed.status,
      configuration: parsed.configuration,
    });

    await audit(context.userId, "whatsapp_flow", id, "flow.created");
    revalidatePath("/fluxos-whatsapp");
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao criar fluxo." };
  }
}

export async function updateWhatsappFlowAction(id: string, input: {
  name?: string;
  status?: string;
  configuration?: Record<string, unknown>;
}) {
  try {
    const context = await authorizeDirector();
    const db = getDatabase();

    const [existing] = await db
      .select()
      .from(schema.whatsappFlows)
      .where(and(eq(schema.whatsappFlows.id, id), eq(schema.whatsappFlows.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) throw new Error("Fluxo não encontrado.");

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.configuration !== undefined) updateValues.configuration = input.configuration;

    await db
      .update(schema.whatsappFlows)
      .set(updateValues)
      .where(and(eq(schema.whatsappFlows.id, id), eq(schema.whatsappFlows.tenantId, context.tenantId)));

    await audit(context.userId, "whatsapp_flow", id, `flow.updated:${input.status ?? "values"}`);
    revalidatePath("/fluxos-whatsapp");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao atualizar fluxo." };
  }
}

export async function deleteWhatsappFlowAction(id: string) {
  try {
    const context = await authorizeDirector();
    const db = getDatabase();

    await db
      .delete(schema.whatsappFlows)
      .where(and(eq(schema.whatsappFlows.id, id), eq(schema.whatsappFlows.tenantId, context.tenantId)));

    await audit(context.userId, "whatsapp_flow", id, "flow.deleted");
    revalidatePath("/fluxos-whatsapp");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao excluir fluxo." };
  }
}

// ─── EXECUTION RETRY / DEAD-LETTER ───────────────────────────────────────────

export async function retryAutomationLogAction(logId: string) {
  try {
    const context = await authorizeDirector();
    const db = getDatabase();

    const [log] = await db
      .select()
      .from(schema.crmAutomationLogs)
      .where(and(eq(schema.crmAutomationLogs.id, logId), eq(schema.crmAutomationLogs.tenantId, context.tenantId)))
      .limit(1);

    if (!log) throw new Error("Log não encontrado.");

    await db
      .update(schema.crmAutomationLogs)
      .set({
        status: "pending",
        attemptCount: 0,
        runAfter: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.crmAutomationLogs.id, logId), eq(schema.crmAutomationLogs.tenantId, context.tenantId)));

    await audit(context.userId, "crm_automation_log", logId, "automation_log.retried");
    revalidatePath("/automacoes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao reprocessar log." };
  }
}

// ─── AI AGENT WIZARD ACTIONS ─────────────────────────────────────────────────

export async function saveAiAgentConfigAction(input: unknown) {
  try {
    const context = await authorizeDirector();
    const parsed = aiAgentInputSchema.parse(input);
    const db = getDatabase();
    const now = new Date();

    const [existing] = await db
      .select({ id: schema.aiQualificationConfigs.id, version: schema.aiQualificationConfigs.version })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId))
      .limit(1);

    const values = {
      ...parsed,
      version: (existing?.version ?? 0) + 1,
      updatedBy: context.userId,
      updatedAt: now,
    };

    if (existing) {
      await db
        .update(schema.aiQualificationConfigs)
        .set(values)
        .where(eq(schema.aiQualificationConfigs.id, existing.id));
    } else {
      await db.insert(schema.aiQualificationConfigs).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        timeoutMinutes: 30,
        maxRetries: 2,
        createdAt: now,
        ...values,
      });
    }

    await audit(context.userId, "ai_qualification_config", context.tenantId, "ai_settings.updated");
    revalidatePath("/agentes-ia");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao salvar configuração do agente." };
  }
}
