"use server";

import { z } from "zod";

import { aiComplete } from "@/features/ai/engine";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { OPERATOR_MATERIAL_CATEGORY } from "./constants";
import { executeHybridKnowledgeSearch } from "./hybrid-retrieval";


export type CotacaoExpressResult =
  | { status: "no_material"; message: string }
  | { status: "answered"; answer: string; sources: Array<{ title: string }> }
  | { status: "error"; message: string };

const querySchema = z.string().trim().min(3).max(500);

const COTACAO_SYSTEM_PROMPT = [
  "Você é o assistente de cotação de planos de saúde da corretora.",
  "Responda somente com base nos trechos numerados que forem fornecidos.",
  "Para cada valor, faixa etária, carência ou regra, cite o número do trecho entre colchetes, por exemplo [1].",
  "Se os trechos não trouxerem a informação pedida, diga que não há dado publicado para isso.",
  "Nunca invente preço, faixa etária, operadora, produto ou carência.",
  "Trechos marcados como leitura automática de imagem podem ter erros: ao usá-los, avise que o valor deve ser confirmado no material original.",
].join(" ");

/**
 * Cotação Express for the Copilot: searches the tenant's operator material and
 * answers from those excerpts only. The tenant comes from the server session,
 * never from the browser.
 */
export async function consultarCotacaoExpress(rawQuery: string): Promise<CotacaoExpressResult> {
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return { status: "error", message: "Descreva a cotação com pelo menos 3 caracteres." };
  }

  const context = await getRequiredTenantContext();
  const chunks = await executeHybridKnowledgeSearch({
    tenantId: context.tenantId,
    query: parsed.data,
    category: OPERATOR_MATERIAL_CATEGORY,
    limit: 6,
  });

  if (chunks.length === 0) {
    return {
      status: "no_material",
      message:
        "Ainda não há material de operadora publicado para consultar. Quando as tabelas e PDFs dos grupos forem importados, a cotação passa a usar esses dados.",
    };
  }

  const excerpts = chunks.map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.text}`).join("\n\n");

  try {
    const response = await aiComplete({
      systemPromptOverride: COTACAO_SYSTEM_PROMPT,
      userMessage: `Pergunta: ${parsed.data}\n\nTrechos:\n${excerpts}`,
      temperatureOverride: 0.1,
    });
    return {
      status: "answered",
      answer: response.text.trim(),
      sources: chunks.map((chunk) => ({ title: chunk.title })),
    };
  } catch {
    return { status: "error", message: "Não foi possível consultar a IA agora. Tente novamente em instantes." };
  }
}
