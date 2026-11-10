import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { transcribe } from "ai";

import { getAiEngineSettings } from "@/features/ai/engine";

import { TRANSCRIPTION_MODELS, type TranscriptionProvider } from "./rules";

export type TranscriptionTarget = { provider: TranscriptionProvider; model: string; apiKey: string };

/**
 * Groq (Whisper turbo) quando há chave, senão OpenAI. Mesmas chaves que a IA
 * já usa (configuração da IA ou variável do Coolify); null sem nenhuma.
 */
export async function resolveTranscriptionTarget(): Promise<TranscriptionTarget | null> {
  const settings = await getAiEngineSettings().catch(() => null);
  const groqKey = settings?.groqApiKey || process.env.GROQ_API_KEY || "";
  if (groqKey) return { provider: "groq", model: TRANSCRIPTION_MODELS.groq, apiKey: groqKey };
  const openaiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY || "";
  if (openaiKey) return { provider: "openai", model: TRANSCRIPTION_MODELS.openai, apiKey: openaiKey };
  return null;
}

/** Vocabulário que ajuda o Whisper a acertar termos do atendimento. */
const DOMAIN_PROMPT = "Conversa de WhatsApp com corretora de plano de saúde: nome, idade, cidade, bairro, operadora, plano individual, familiar ou empresarial, CNPJ, MEI, coparticipação, carência.";

/** Fala → texto em português. Temperatura 0: transcreve, não interpreta. */
export async function transcribeAudio(input: { target: TranscriptionTarget; audio: Uint8Array; mimeType: string; timeoutMs?: number }) {
  const provider = createOpenAI({
    apiKey: input.target.apiKey,
    ...(input.target.provider === "groq" ? { baseURL: "https://api.groq.com/openai/v1" } : {}),
  });
  const result = await transcribe({
    model: provider.transcription(input.target.model),
    audio: input.audio,
    providerOptions: { openai: { language: "pt", prompt: DOMAIN_PROMPT, temperature: 0 } },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
  });
  return { text: result.text, durationSeconds: result.durationInSeconds ?? null };
}
