"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { builtinSituation, cleanPhrases, MAX_SITUATION_PHRASES } from "@/features/attendance-situations/catalog";
import { textVariables } from "@/features/message-library/catalog";
import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { autoActivateSettingKey } from "./service";

type Result<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

async function requireManager() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Diretores e Gestores podem revisar as sugestões.");
  return context;
}

function failure(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error && error.message ? error.message : fallback };
}

async function audit(userId: string, id: string, acao: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "situation_suggestion", entidadeId: id.slice(0, 120), acao });
}

function done() {
  revalidatePath("/atendimento/situacoes");
  return { success: true as const };
}

async function pendingSuggestion(tenantId: string, id: string) {
  const [suggestion] = await getDatabase().select().from(schema.situationSuggestions)
    .where(and(eq(schema.situationSuggestions.id, id), eq(schema.situationSuggestions.tenantId, tenantId))).limit(1);
  if (!suggestion) throw new Error("Sugestão não encontrada.");
  if (suggestion.status !== "pending") throw new Error("Esta sugestão já foi revisada.");
  return suggestion;
}

function validateReply(response: string) {
  const text = response.trim();
  if (text.length < 3 || text.length > 1000) return "A resposta precisa ter entre 3 e 1000 caracteres.";
  const unknown = textVariables(text).filter((variable) => variable !== "nome" && variable !== "resumo");
  if (unknown.length) return `Variável não disponível: ${unknown.map((variable) => `{{${variable}}}`).join(", ")}. Use {{nome}} ou {{resumo}}.`;
  return null;
}

/** Approves a suggested new situation, as suggested or edited: it becomes one of the tenant's situations, on. */
export async function approveSuggestionAction(input: { id: string; title: string; phrases: string[]; response: string; action: "continue" | "transfer" }): Promise<Result<{ key: string }>> {
  try {
    const context = await requireManager();
    const suggestion = await pendingSuggestion(context.tenantId, input.id);
    if (suggestion.kind !== "new") return { success: false, error: "Esta sugestão ensina frases a uma situação existente: use \"Juntar\"." };
    const title = input.title.replace(/\s+/g, " ").trim();
    if (title.length < 3 || title.length > 80) return { success: false, error: "Dê um nome entre 3 e 80 caracteres." };
    const phrases = cleanPhrases(input.phrases);
    if (!phrases.length) return { success: false, error: "Mantenha pelo menos uma frase que o cliente diria." };
    const replyError = validateReply(input.response);
    if (replyError) return { success: false, error: replyError };
    if (input.action !== "continue" && input.action !== "transfer") return { success: false, error: "Ação inválida." };
    const key = `custom:${randomUUID()}`;
    const now = new Date();
    await getDatabase().transaction(async (tx) => {
      await tx.insert(schema.attendanceSituations).values({
        id: randomUUID(), tenantId: context.tenantId, situationKey: key, kind: "custom", title, examplePhrases: phrases,
        response: input.response.trim(), action: input.action, enabled: true, origin: "suggestion", updatedBy: context.userId, createdAt: now, updatedAt: now,
      });
      await tx.update(schema.situationSuggestions).set({ status: "approved", resolvedSituationKey: key, resolvedBy: context.userId, resolvedAt: now, updatedAt: now })
        .where(eq(schema.situationSuggestions.id, suggestion.id));
    });
    await audit(context.userId, suggestion.id, "situation_suggestion.approved");
    return { ...done(), key };
  } catch (error) {
    return failure(error, "Não foi possível aprovar a sugestão.");
  }
}

/** Teaches the suggestion's phrases to an existing situation (the system's or the tenant's own). */
export async function mergeSuggestionAction(input: { id: string; targetKey: string; phrases: string[] }): Promise<Result> {
  try {
    const context = await requireManager();
    const suggestion = await pendingSuggestion(context.tenantId, input.id);
    const additions = cleanPhrases(input.phrases);
    if (!additions.length) return { success: false, error: "Escolha pelo menos uma frase para ensinar." };
    const db = getDatabase();
    const now = new Date();
    const builtin = builtinSituation(input.targetKey);
    await db.transaction(async (tx) => {
      if (builtin) {
        const [row] = await tx.select({ phrases: schema.attendanceSituations.examplePhrases }).from(schema.attendanceSituations)
          .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, builtin.key))).limit(1);
        const phrases = cleanPhrases([...(row?.phrases ?? []), ...additions]).slice(0, MAX_SITUATION_PHRASES);
        await tx.insert(schema.attendanceSituations).values({
          id: randomUUID(), tenantId: context.tenantId, situationKey: builtin.key, kind: "builtin", examplePhrases: phrases, enabled: true, updatedBy: context.userId, createdAt: now, updatedAt: now,
        }).onConflictDoUpdate({
          target: [schema.attendanceSituations.tenantId, schema.attendanceSituations.situationKey],
          set: { examplePhrases: phrases, updatedBy: context.userId, updatedAt: now },
        });
      } else {
        const [row] = await tx.select({ phrases: schema.attendanceSituations.examplePhrases }).from(schema.attendanceSituations)
          .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, input.targetKey), eq(schema.attendanceSituations.kind, "custom"))).limit(1);
        if (!row) throw new Error("Situação de destino não encontrada.");
        await tx.update(schema.attendanceSituations).set({ examplePhrases: cleanPhrases([...row.phrases, ...additions]).slice(0, MAX_SITUATION_PHRASES), updatedBy: context.userId, updatedAt: now })
          .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, input.targetKey)));
      }
      await tx.update(schema.situationSuggestions).set({ status: "merged", resolvedSituationKey: input.targetKey, resolvedBy: context.userId, resolvedAt: now, updatedAt: now })
        .where(eq(schema.situationSuggestions.id, suggestion.id));
    });
    await audit(context.userId, suggestion.id, "situation_suggestion.merged");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível juntar a sugestão.");
  }
}

export async function dismissSuggestionAction(id: string): Promise<Result> {
  try {
    const context = await requireManager();
    const suggestion = await pendingSuggestion(context.tenantId, id);
    const now = new Date();
    await getDatabase().update(schema.situationSuggestions).set({ status: "dismissed", resolvedBy: context.userId, resolvedAt: now, updatedAt: now })
      .where(eq(schema.situationSuggestions.id, suggestion.id));
    await audit(context.userId, suggestion.id, "situation_suggestion.dismissed");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível descartar a sugestão.");
  }
}

/** L5 switch: the AI activates by itself the suggestions that meet every condition. Off by default. */
export async function setAutoActivateAction(enabled: boolean): Promise<Result> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Somente o Diretor pode ligar a ativação automática." };
    await setSystemSetting(autoActivateSettingKey(context.tenantId), enabled ? "true" : "false");
    await audit(context.userId, context.tenantId, enabled ? "situation_learning.auto_activate_on" : "situation_learning.auto_activate_off");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível alterar a ativação automática.");
  }
}

/** Undoes a situation the AI activated: it is removed and its suggestion goes back to review. */
export async function undoAutoActivationAction(situationKey: string): Promise<Result> {
  try {
    const context = await requireManager();
    const db = getDatabase();
    const now = new Date();
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(schema.attendanceSituations)
        .where(and(eq(schema.attendanceSituations.tenantId, context.tenantId), eq(schema.attendanceSituations.situationKey, situationKey), eq(schema.attendanceSituations.origin, "auto")))
        .returning({ key: schema.attendanceSituations.situationKey });
      if (!row) return false;
      await tx.update(schema.situationSuggestions).set({ status: "pending", resolvedSituationKey: null, resolvedAt: null, updatedAt: now })
        .where(and(eq(schema.situationSuggestions.tenantId, context.tenantId), eq(schema.situationSuggestions.resolvedSituationKey, situationKey), eq(schema.situationSuggestions.status, "auto_activated")));
      return true;
    });
    if (!removed) return { success: false, error: "Situação ativada pela IA não encontrada." };
    await audit(context.userId, situationKey, "situation_suggestion.auto_activation_undone");
    return done();
  } catch (error) {
    return failure(error, "Não foi possível desfazer a ativação.");
  }
}
