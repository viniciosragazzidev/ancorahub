import { toJSONSchema, type z } from "zod";

import { aiExtractImageText } from "@/features/ai/vision";
import { runGateway } from "@/features/ai-gateway/gateway";
import { extractPdfText } from "@/features/waha-group-capture/pdf-text";

import { findLinhasDigitaveis } from "./boleto";
import {
  boletoExtractionSchema,
  proofExtractionSchema,
  proposalExtractionSchema,
  type DocumentKind,
  type ExtractedDocument,
} from "./types";

const MAX_TEXT_CHARS = 40_000;
const MIN_PDF_TEXT_CHARS = 40;

export type ExtractionActor = { tenantId: string; userId: string };

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

const PROMPTS: Record<DocumentKind, string> = {
  proposta:
    "Você recebe o texto de uma proposta de plano de saúde. Extraia os campos pedidos. Documentos (CPF/CNPJ) só com dígitos. " +
    "valorTotal é o valor mensal total a pagar (produtos + taxas). Não invente: use null quando o campo não existir.",
  comprovante:
    "Você recebe o texto de um comprovante de pagamento de boleto (banco ou carteira digital). Extraia os campos pedidos. " +
    "Copie CPF/CNPJ de beneficiário e pagador exatamente como aparecem, mantendo os asteriscos. Datas em yyyy-mm-dd. " +
    "Não invente: use null quando o campo não existir.",
  boleto:
    "Você recebe o texto de um boleto bancário. Extraia os campos pedidos. Datas em yyyy-mm-dd. " +
    "Não invente: use null quando o campo não existir.",
};

const SCHEMAS = {
  proposta: proposalExtractionSchema,
  comprovante: proofExtractionSchema,
  boleto: boletoExtractionSchema,
} as const;

async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    const text = await extractPdfText(bytes);
    if (text.replace(/\s/g, "").length >= MIN_PDF_TEXT_CHARS) return text;
    // PDF escaneado: sem texto, só serve como imagem.
    throw new ExtractionError("Este PDF é uma imagem escaneada. Envie uma foto ou print do documento.");
  }
  const { text } = await aiExtractImageText({
    image: bytes,
    mimeType: file.type,
    instruction:
      "Transcreva literalmente todo o texto desta imagem, linha por linha, sem resumir e sem corrigir. " +
      "Mantenha números, asteriscos, pontuação e a linha digitável exatamente como aparecem.",
    maxTokens: 4096,
  });
  return text;
}

/**
 * Organiza o texto nos campos do schema pelo gateway de IA. Só modelos pagos
 * (sensitive): o texto tem CPF/CNPJ, que não pode ser mascarado nem ir para
 * modelo gratuito que treina com os dados.
 */
async function structure<S extends z.ZodTypeAny>(
  schema: S,
  instruction: string,
  text: string,
  actor: ExtractionActor,
): Promise<z.infer<S>> {
  const result = await runGateway({
    profile: "json-structured",
    purpose: "payment_proof_validator",
    tenantId: actor.tenantId,
    userId: actor.userId,
    sensitive: true,
    temperature: 0,
    maxTokens: 1500,
    timeoutMs: 30_000,
    schema,
    messages: [
      {
        role: "system",
        content:
          `${instruction}
Responda só com um objeto JSON neste JSON Schema, com números como números JSON (ex.: 535.98):
` +
          JSON.stringify(toJSONSchema(schema)),
      },
      { role: "user", content: text.slice(0, MAX_TEXT_CHARS) },
    ],
  });
  if (result.ok) return result.value as z.infer<S>;
  console.error("[payment-proof-validator] extração falhou", result.reason, result.attempts);
  if (result.reason === "rate_limited") {
    throw new ExtractionError("Muitas validações em sequência. Aguarde um minuto e tente de novo.");
  }
  if (result.reason === "no_provider") {
    throw new ExtractionError("Nenhum modelo de IA pago está configurado para ler documentos (OpenRouter, Anthropic ou OpenAI).");
  }
  throw new ExtractionError("Não foi possível ler o documento com a IA. Tente de novo em instantes.");
}

/**
 * Lê um documento e devolve os campos estruturados. A linha digitável
 * encontrada por regra no texto vale mais que a lida pela IA.
 */
export async function extractDocument(kind: DocumentKind, file: File, actor: ExtractionActor): Promise<ExtractedDocument> {
  const text = await readText(file);
  const data = await structure(SCHEMAS[kind], PROMPTS[kind], text, actor);

  if (kind === "proposta") return { kind, data: proposalExtractionSchema.parse(data) };

  const linha = findLinhasDigitaveis(text)[0];
  const withLinha = linha ? { ...data, linhaDigitavel: linha.digits } : data;
  return kind === "comprovante"
    ? { kind, data: proofExtractionSchema.parse(withLinha) }
    : { kind, data: boletoExtractionSchema.parse(withLinha) };
}
