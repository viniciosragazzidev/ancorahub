"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { workflowDraftInputSchema } from "./input";
import { assessWorkflowPublication, WORKFLOW_AUTOMATION_FEATURE } from "./publication";

const workflowIdSchema = z.string().uuid();

async function requireWorkflowDirector() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas o Diretor pode configurar e publicar automações.");
  return context;
}

async function auditWorkflow(userId: string, workflowId: string, action: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "workflow_automation", entidadeId: workflowId, acao: action });
}


export async function createWorkflowDraftAction(input: unknown) {
  try {
    const context = await requireWorkflowDirector();
    const parsed = workflowDraftInputSchema.parse(input);
    const id = randomUUID();
    await getDatabase().insert(schema.workflowAutomations).values({
      id, tenantId: context.tenantId, name: parsed.name, description: parsed.description ?? null,
      status: "rascunho", draftDefinition: parsed.definition, createdBy: context.userId,
    });
    await auditWorkflow(context.userId, id, "workflow_automation.draft_created");
    return { success: true as const, id };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível criar o rascunho." };
  }
}

export async function saveWorkflowDraftAction(workflowId: string, input: unknown) {
  try {
    const context = await requireWorkflowDirector();
    const id = workflowIdSchema.parse(workflowId);
    const parsed = workflowDraftInputSchema.parse(input);
    const db = getDatabase();
    const [existing] = await db.select({ id: schema.workflowAutomations.id }).from(schema.workflowAutomations)
      .where(and(eq(schema.workflowAutomations.id, id), eq(schema.workflowAutomations.tenantId, context.tenantId))).limit(1);
    if (!existing) throw new Error("Fluxo não encontrado.");
    await db.update(schema.workflowAutomations).set({ name: parsed.name, description: parsed.description ?? null, draftDefinition: parsed.definition, updatedAt: new Date() })
      .where(and(eq(schema.workflowAutomations.id, id), eq(schema.workflowAutomations.tenantId, context.tenantId)));
    await auditWorkflow(context.userId, id, "workflow_automation.draft_updated");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar o rascunho." };
  }
}

export async function publishWorkflowAction(workflowId: string) {
  try {
    const context = await requireWorkflowDirector();
    const id = workflowIdSchema.parse(workflowId);
    const db = getDatabase();
    const [workflow] = await db.select().from(schema.workflowAutomations)
      .where(and(eq(schema.workflowAutomations.id, id), eq(schema.workflowAutomations.tenantId, context.tenantId))).limit(1);
    if (!workflow) throw new Error("Fluxo não encontrado.");
    const definition = workflowDraftInputSchema.shape.definition.parse(workflow.draftDefinition);
    const decision = assessWorkflowPublication(definition, (await getSystemSetting(WORKFLOW_AUTOMATION_FEATURE)) === "true");
    if (!decision.allowed) return { success: false as const, issues: decision.issues };
    const [latestVersion] = await db.select({ version: schema.workflowAutomationVersions.version }).from(schema.workflowAutomationVersions)
      .where(and(eq(schema.workflowAutomationVersions.workflowId, id), eq(schema.workflowAutomationVersions.tenantId, context.tenantId)))
      .orderBy(desc(schema.workflowAutomationVersions.version)).limit(1);
    const versionId = randomUUID(); const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.workflowAutomationVersions).values({ id: versionId, tenantId: context.tenantId, workflowId: id, version: (latestVersion?.version ?? 0) + 1, definition, publishedBy: context.userId, createdAt: now });
      await tx.update(schema.workflowAutomations).set({ status: "publicado", publishedVersionId: versionId, updatedAt: now })
        .where(and(eq(schema.workflowAutomations.id, id), eq(schema.workflowAutomations.tenantId, context.tenantId)));
    });
    await auditWorkflow(context.userId, id, "workflow_automation.published");
    return { success: true as const, versionId };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível publicar o fluxo." };
  }
}
