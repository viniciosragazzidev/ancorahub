import { generateObject } from "ai";
import type { z } from "zod";

import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { aiExtractImageText } from "@/features/ai/vision";
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

async function structure<S extends z.ZodTypeAny>(schema: S, system: string, text: string): Promise<z.infer<S>> {
  const settings = await getAiEngineSettings();
  if (!settings.enabled) throw new ExtractionError("O motor de Inteligência Artificial está desativado.");

  const keys = {
    groqKey: settings.groqApiKey,
    openaiKey: settings.openaiApiKey,
    googleKey: settings.googleApiKey,
    openrouterKey: settings.openrouterApiKey,
  };
  const candidates = [
    { provider: settings.primaryProvider, model: settings.primaryModel },
    ...(settings.fallbackProvider !== "none"
      ? [{ provider: settings.fallbackProvider, model: settings.fallbackModel }]
      : []),
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const result = await generateObject({
        model: getAiModelInstance(candidate.provider, candidate.model, keys),
        schema,
        system,
        prompt: text.slice(0, MAX_TEXT_CHARS),
        temperature: 0,
      });
      return result.object as z.infer<S>;
    } catch (error) {
      lastError = error;
      console.warn(`[payment-proof-validator] falha com ${candidate.provider}/${candidate.model}`, error);
    }
  }
  console.error("[payment-proof-validator] extração falhou", lastError);
  throw new ExtractionError("Não foi possível ler o documento com a IA. Tente de novo em instantes.");
}

/**
 * Lê um documento e devolve os campos estruturados. A linha digitável
 * encontrada por regra no texto vale mais que a lida pela IA.
 */
export async function extractDocument(kind: DocumentKind, file: File): Promise<ExtractedDocument> {
  const text = await readText(file);
  const data = await structure(SCHEMAS[kind], PROMPTS[kind], text);

  if (kind === "proposta") return { kind, data: proposalExtractionSchema.parse(data) };

  const linha = findLinhasDigitaveis(text)[0];
  const withLinha = linha ? { ...data, linhaDigitavel: linha.digits } : data;
  return kind === "comprovante"
    ? { kind, data: proofExtractionSchema.parse(withLinha) }
    : { kind, data: boletoExtractionSchema.parse(withLinha) };
}
