"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { agentBehaviorPolicySchema, runCriticalSimulations, validateAgentBehaviorPolicy } from "./service";

const idSchema = z.string().uuid();

async function directorContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas o Diretor pode treinar e publicar o agente.");
  if ((await getSystemSetting("feature_agent_training_center_enabled")) === "false") throw new Error("O Centro de Treinamento ainda não está liberado para este piloto.");
  return context;
}

export async function getAgentTrainingCenter() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [versions, brokers, policies] = await Promise.all([
    db.select().from(schema.agentBehaviorVersions).where(eq(schema.agentBehaviorVersions.tenantId, context.tenantId)).orderBy(desc(schema.agentBehaviorVersions.versionNumber)),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"))).orderBy(desc(schema.user.name)),
    db.select({ policy: schema.leadDistributionPolicies.policy }).from(schema.leadDistributionPolicies).where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), isNull(schema.leadDistributionPolicies.queueId))).limit(1),
  ]);
  return { canEdit: context.role === "director", enabled: (await getSystemSetting("feature_agent_training_center_enabled")) !== "false", versions, brokers, distributionPolicy: policies[0]?.policy ?? null };
}

export async function createAgentBehaviorDraftAction(policyValue: unknown) {
  const context = await directorContext();
  const validation = validateAgentBehaviorPolicy(policyValue);
  if (!validation.valid || !validation.policy) return { success: false, error: validation.errors.join(" ") };
  const db = getDatabase();
  const [latest] = await db.select({ versionNumber: schema.agentBehaviorVersions.versionNumber }).from(schema.agentBehaviorVersions).where(eq(schema.agentBehaviorVersions.tenantId, context.tenantId)).orderBy(desc(schema.agentBehaviorVersions.versionNumber)).limit(1);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.agentBehaviorVersions).values({ id, tenantId: context.tenantId, versionNumber: (latest?.versionNumber ?? 0) + 1, status: "DRAFT", policy: validation.policy, validation: { errors: validation.errors, simulations: [] }, summary: "Rascunho criado no Centro de Treinamento", createdBy: context.userId });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "agent_behavior_version", entidadeId: id, acao: "agent_training.draft_created" });
  });
  revalidatePath("/qualificacao");
  return { success: true, id };
}

export async function validateAgentBehaviorVersionAction(versionId: string) {
  const context = await directorContext();
  const parsedId = idSchema.safeParse(versionId);
  if (!parsedId.success) return { success: false, error: "Versão inválida." };
  const db = getDatabase();
  const [version] = await db.select().from(schema.agentBehaviorVersions).where(and(eq(schema.agentBehaviorVersions.id, parsedId.data), eq(schema.agentBehaviorVersions.tenantId, context.tenantId))).limit(1);
  if (!version || version.status === "PUBLISHED") return { success: false, error: "A versão não pode ser validada." };
  const validation = validateAgentBehaviorPolicy(version.policy);
  const simulations = validation.policy ? runCriticalSimulations(validation.policy) : [];
  const passed = validation.valid && simulations.every((item) => item.passed);
  await db.transaction(async (tx) => {
    await tx.update(schema.agentBehaviorVersions).set({ status: passed ? "READY_TO_PUBLISH" : "VALIDATING", validation: { errors: validation.errors, simulations }, updatedAt: new Date() }).where(and(eq(schema.agentBehaviorVersions.id, version.id), eq(schema.agentBehaviorVersions.tenantId, context.tenantId)));
    await tx.insert(schema.agentTrainingSimulations).values(simulations.map((item) => ({ id: randomUUID(), tenantId: context.tenantId, behaviorVersionId: version.id, scenarioKey: item.key, status: item.passed ? "passed" : "failed", result: item, createdBy: context.userId })));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "agent_behavior_version", entidadeId: version.id, acao: passed ? "agent_training.validation_passed" : "agent_training.validation_failed" });
  });
  revalidatePath("/qualificacao");
  return { success: passed, error: passed ? undefined : "Existem cenários críticos pendentes." };
}

export async function publishAgentBehaviorVersionAction(versionId: string) {
  const context = await directorContext();
  const parsedId = idSchema.safeParse(versionId);
  if (!parsedId.success) return { success: false, error: "Versão inválida." };
  const db = getDatabase();
  const [version] = await db.select().from(schema.agentBehaviorVersions).where(and(eq(schema.agentBehaviorVersions.id, parsedId.data), eq(schema.agentBehaviorVersions.tenantId, context.tenantId))).limit(1);
  if (!version || version.status !== "READY_TO_PUBLISH") return { success: false, error: "Valide os cenários críticos antes de publicar." };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.agentBehaviorVersions).set({ status: "ARCHIVED", updatedAt: now }).where(and(eq(schema.agentBehaviorVersions.tenantId, context.tenantId), eq(schema.agentBehaviorVersions.status, "PUBLISHED")));
    await tx.update(schema.agentBehaviorVersions).set({ status: "PUBLISHED", publishedAt: now, publishedBy: context.userId, updatedAt: now }).where(and(eq(schema.agentBehaviorVersions.id, version.id), eq(schema.agentBehaviorVersions.tenantId, context.tenantId)));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "agent_behavior_version", entidadeId: version.id, acao: "agent_training.published" });
  });
  revalidatePath("/qualificacao");
  return { success: true };
}

export async function rollbackAgentBehaviorVersionAction(versionId: string) {
  const context = await directorContext();
  const parsedId = idSchema.safeParse(versionId);
  if (!parsedId.success) return { success: false, error: "Versão inválida." };
  const db = getDatabase();
  const [target] = await db.select().from(schema.agentBehaviorVersions).where(and(eq(schema.agentBehaviorVersions.id, parsedId.data), eq(schema.agentBehaviorVersions.tenantId, context.tenantId))).limit(1);
  if (!target || !["ARCHIVED", "ROLLED_BACK"].includes(target.status)) return { success: false, error: "Escolha uma versão publicada anteriormente." };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.agentBehaviorVersions).set({ status: "ROLLED_BACK", updatedAt: now }).where(and(eq(schema.agentBehaviorVersions.tenantId, context.tenantId), eq(schema.agentBehaviorVersions.status, "PUBLISHED")));
    await tx.update(schema.agentBehaviorVersions).set({ status: "PUBLISHED", publishedAt: now, publishedBy: context.userId, updatedAt: now }).where(and(eq(schema.agentBehaviorVersions.id, target.id), eq(schema.agentBehaviorVersions.tenantId, context.tenantId)));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "agent_behavior_version", entidadeId: target.id, acao: "agent_training.rolled_back" });
  });
  revalidatePath("/qualificacao");
  return { success: true };
}

function parsePolicyFromFormData(formData: FormData) {
  return agentBehaviorPolicySchema.safeParse({ assistantName: formData.get("assistantName"), tone: formData.get("tone"), formOfAddress: formData.get("formOfAddress"), objective: "qualify_and_handoff", requiredFields: formData.getAll("requiredFields"), maxQuestions: Number(formData.get("maxQuestions")), businessHoursStart: formData.get("businessHoursStart") || "", businessHoursEnd: formData.get("businessHoursEnd") || "", businessDays: formData.get("businessDays") || "", handoffMessage: formData.get("handoffMessage"), quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true } });
}

export async function createAgentBehaviorDraftFromFormAction(_prev: { success: boolean; error?: string; id?: string }, formData: FormData): Promise<{ success: boolean; error?: string; id?: string }> {
  const policy = parsePolicyFromFormData(formData);
  if (!policy.success) return { success: false, error: "Revise os dados de identidade, atendimento e qualificação." };
  return createAgentBehaviorDraftAction(policy.data);
}
