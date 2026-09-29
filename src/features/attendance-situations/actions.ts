"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { textVariables } from "@/features/message-library/catalog";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { builtinSituation, cleanPhrases } from "./catalog";

type Result<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

async function requireManager() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Diretores e Gestores podem alterar as situações.");
  return context;
}

function failure(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error && error.message ? error.message : fallback };
}

async function audit(userId: string, key: string, acao: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "attendance_situation", entidadeId: key.slice(0, 120), acao });
}

function done() {
  revalidatePath("/atendimento/situacoes");
  return { success: true as const };
}

/** Phrases taught for a system situation and, when it is optional, whether it is on. */
export async function saveBuiltinSituationAction(input: { key: string; phrases: string[]; enabled: boolean }): Promise<Result> {
  try {
    const context = await requireManager();
    const builtin = builtinSituation(input.key);
    if (!builtin) return { success: false, error: "Situação desconhecida." };
    const phrases = cleanPhrases(input.phrases);
    const enabled = builtin.critical ? true : input.enabled;
    const now = new Date();
    await getDatabase().insert(schema.attendanceSituations).values({
      id: randomUUID(), tenantId: context.tenantId, situationKey: builtin.key, kind: "builtin",
      examplePhrases: phrases, enabled, updatedBy: context.userId, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.attendanceSituations.tenantId, schema.attendanceSituations.situationKey],
      set: { examplePhrases: phrases, enabled, updatedBy: context.userId, updatedAt: now },
    });
    await audit(context.userId, builtin.key, "attendance_situation.builtin_updated");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível salvar a situação.");
  }
}

/** Creates or updates one of the tenant's own situations. */
export async function saveCustomSituationAction(input: { key?: string | null; title: string; phrases: string[]; response: string; action: "continue" | "transfer"; enabled: boolean }): Promise<Result<{ key: string }>> {
  try {
    const context = await requireManager();
    const title = input.title.replace(/\s+/g, " ").trim();
    if (title.length < 3 || title.length > 80) return { success: false, error: "Dê um nome entre 3 e 80 caracteres." };
    const phrases = cleanPhrases(input.phrases);
    if (!phrases.length) return { success: false, error: "Adicione pelo menos uma frase que o cliente diria." };
    const response = input.response.trim();
    if (response.length < 3 || response.length > 1000) return { success: false, error: "A resposta precisa ter entre 3 e 1000 caracteres." };
    const unknown = textVariables(response).filter((variable) => variable !== "nome" && variable !== "resumo");
    if (unknown.length) return { success: false, error: `Variável não disponível: ${unknown.map((variable) => `{{${variable}}}`).join(", ")}. Use {{nome}} ou {{resumo}}.` };
    if (input.action !== "continue" && input.action !== "transfer") return { success: false, error: "Ação inválida." };
    const db = getDatabase();
    const now = new Date();
    if (input.key) {
      const [updated] = await db.update(schema.attendanceSituations)
        .set({ title, examplePhrases: phrases, response, action: input.action, enabled: input.enabled, updatedBy: context.userId, updatedAt: now })
        .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, input.key), eq(schema.attendanceSituations.kind, "custom")))
        .returning({ key: schema.attendanceSituations.situationKey });
      if (!updated) return { success: false, error: "Situação não encontrada." };
      await audit(context.userId, updated.key, "attendance_situation.custom_updated");
      return { ...done(), key: updated.key };
    }
    const key = `custom:${randomUUID()}`;
    await db.insert(schema.attendanceSituations).values({
      id: randomUUID(), tenantId: context.tenantId, situationKey: key, kind: "custom", title, examplePhrases: phrases,
      response, action: input.action, enabled: input.enabled, updatedBy: context.userId, createdAt: now, updatedAt: now,
    });
    await audit(context.userId, key, "attendance_situation.custom_created");
    return { ...done(), key };
  } catch (error) {
    return failure(error, "Não foi possível salvar a situação.");
  }
}

export async function deleteCustomSituationAction(key: string): Promise<Result> {
  try {
    const context = await requireManager();
    const [removed] = await getDatabase().delete(schema.attendanceSituations)
      .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, key), eq(schema.attendanceSituations.kind, "custom")))
      .returning({ key: schema.attendanceSituations.situationKey });
    if (!removed) return { success: false, error: "Situação não encontrada." };
    await audit(context.userId, key, "attendance_situation.custom_removed");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível remover a situação.");
  }
}

/** Updates one roteiro (guidance the AI uses when no situation covers the question). */
export async function saveGuidedSituationAction(input: { id: string; title: string; triggerCondition: string; exampleCustomerInput: string; recommendedResponse: string; enabled: boolean }): Promise<Result> {
  try {
    const context = await requireManager();
    const [{ getTenantPlaybooks, saveTenantPlaybooks }, { SituationalPlaybookItemSchema }] = await Promise.all([
      import("@/features/ai-qualification/playbooks-storage"),
      import("@/features/ai-qualification/situations-catalog"),
    ]);
    const playbooks = await getTenantPlaybooks(context.tenantId);
    const index = playbooks.findIndex((playbook) => playbook.id === input.id);
    if (index === -1) return { success: false, error: "Roteiro não encontrado." };
    const next = SituationalPlaybookItemSchema.parse({
      ...playbooks[index],
      title: input.title.trim(), triggerCondition: input.triggerCondition.trim(),
      exampleCustomerInput: input.exampleCustomerInput.trim(), recommendedResponse: input.recommendedResponse.trim(), enabled: input.enabled,
    });
    await saveTenantPlaybooks(context.tenantId, playbooks.map((playbook, position) => (position === index ? next : playbook)));
    await audit(context.userId, next.key, "attendance_situation.guided_updated");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível salvar o roteiro. Todos os campos são obrigatórios.");
  }
}

/** "Teste uma frase": what the engine would do with this message. Nothing is sent. */
export async function testPhraseAction(text: string) {
  try {
    const context = await requireManager();
    const phrase = text.trim();
    if (!phrase) return { success: false as const, error: "Digite uma frase." };
    const { explainPhrase } = await import("./explain");
    return { success: true as const, result: await explainPhrase(context.tenantId, phrase.slice(0, 400)) };
  } catch (error) {
    return failure(error, "Não foi possível testar a frase agora.");
  }
}
