"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { cleanQualificationOrder, isQualificationFieldKey, questionTextProblem } from "./domain";

type Result = { success: true } | { success: false; error: string };

const DEFAULT_INITIAL_MESSAGE = "Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento.";

/**
 * Saves the qualification flow (Atendimento > Fluxo): the questions on, in the
 * order given, and the director's own text for each one (empty keeps the
 * built-in wording). Director only.
 */
export async function saveQualificationFlowAction(input: { order: string[]; texts: Record<string, string> }): Promise<Result> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor pode alterar o fluxo de atendimento." };
    const order = cleanQualificationOrder(input.order ?? []);
    if (!order.length) return { success: false, error: "Deixe pelo menos uma pergunta ligada." };

    const texts: Record<string, string> = {};
    for (const [key, raw] of Object.entries(input.texts ?? {})) {
      if (!isQualificationFieldKey(key)) continue;
      const text = String(raw ?? "").trim();
      if (!text) continue;
      const problem = questionTextProblem(key, text);
      if (problem) return { success: false, error: problem };
      texts[key] = text;
    }

    const db = getDatabase();
    const now = new Date();
    const [existing] = await db
      .select({ id: schema.aiQualificationConfigs.id, version: schema.aiQualificationConfigs.version, maxQuestions: schema.aiQualificationConfigs.maxQuestions })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId))
      .limit(1);
    // Every question on must fit the question limit, or the policy is rejected.
    const values = {
      requiredFields: order,
      questionTexts: Object.keys(texts).length ? texts : null,
      maxQuestions: Math.max(existing?.maxQuestions ?? 6, order.length),
      version: (existing?.version ?? 0) + 1,
      updatedBy: context.userId,
      updatedAt: now,
    };
    await db.transaction(async (tx) => {
      if (existing) await tx.update(schema.aiQualificationConfigs).set(values).where(eq(schema.aiQualificationConfigs.id, existing.id));
      else await tx.insert(schema.aiQualificationConfigs).values({ id: randomUUID(), tenantId: context.tenantId, enabled: false, initialMessage: DEFAULT_INITIAL_MESSAGE, createdAt: now, ...values });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "ai_qualification_config", entidadeId: context.tenantId, acao: "qualification_flow.updated" });
    });
    revalidatePath("/atendimento/fluxo");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error && error.message ? error.message : "Não foi possível salvar o fluxo." };
  }
}
