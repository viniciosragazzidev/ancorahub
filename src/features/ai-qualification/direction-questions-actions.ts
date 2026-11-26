"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import type { DirectionQuestionRow } from "./direction-questions-core";
import { answerDirectionQuestion, DirectionAnswerError, getDirectionQuestionRow } from "./direction-questions-service";

const inputSchema = z.object({
  id: z.string().min(1).max(64),
  answer: z.string().max(4000),
  sendToLead: z.boolean(),
  teach: z.boolean(),
});

export type AnswerDirectionQuestionResult = { ok: true; row: DirectionQuestionRow | null } | { ok: false; error: string };

/** Resposta do diretor a uma pergunta da IA (/ia/perguntas). Sucesso só depois do envio e da gravação. */
export async function answerDirectionQuestionAction(raw: { id: string; answer: string; sendToLead: boolean; teach: boolean }): Promise<AnswerDirectionQuestionResult> {
  try {
    const input = inputSchema.parse(raw);
    const context = await getRequiredTenantContext();
    await answerDirectionQuestion(context, input);
    revalidatePath("/ia/perguntas");
    return { ok: true, row: await getDirectionQuestionRow(context, input.id) };
  } catch (error) {
    if (error instanceof DirectionAnswerError) return { ok: false, error: error.message };
    console.error("[direction-questions] answer_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { ok: false, error: "Não deu para responder agora. A pergunta continua aberta." };
  }
}
