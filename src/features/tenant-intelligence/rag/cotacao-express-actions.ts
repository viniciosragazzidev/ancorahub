"use server";

import { z } from "zod";

import { answerOperatorQuestion, type OperatorAnswer } from "@/features/operator-catalog/answer";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export type CotacaoExpressResult = OperatorAnswer;

const querySchema = z.string().trim().min(3).max(500);

/**
 * Cotação Express for the Copilot: answers from the operator catalog (facts
 * checked by the director) and the operator material excerpts, through the AI
 * gateway in sensitive mode (paid models only). The tenant comes from the
 * server session, never from the browser.
 */
export async function consultarCotacaoExpress(rawQuery: string): Promise<CotacaoExpressResult> {
  const parsed = querySchema.safeParse(rawQuery.replace(/^\s*\/?cota[cç][aã]o[-\s]?express\b\s*/i, ""));
  if (!parsed.success) {
    return { status: "error", message: "Descreva a cotação com pelo menos 3 caracteres." };
  }
  const context = await getRequiredTenantContext();
  try {
    return await answerOperatorQuestion({ tenantId: context.tenantId, userId: context.userId, question: parsed.data });
  } catch (error) {
    console.error("[cotacao-express] failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { status: "error", message: "Não foi possível consultar a IA agora. Tente novamente em instantes." };
  }
}
