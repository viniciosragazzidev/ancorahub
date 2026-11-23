import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { cleanTranscript, estimateTranscriptionCostUsd } from "@/features/ai-agent/audio-transcription/rules";
import { resolveTranscriptionTarget, transcribeAudio } from "@/features/ai-agent/audio-transcription/transcriber";
import { brokerAiAccess } from "@/features/ai-gateway/broker-ai-pilot";
import { readAiConsent } from "@/features/ai-gateway/consent";
import { SASA_VOICE_MAX_BYTES, SASA_VOICE_MAX_SECONDS, sasaLimitMessage } from "@/features/sasa/limits";
import { findSasaCommand, recordSasaTranscription, sasaUsageToday } from "@/features/sasa/store";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fields = z.object({
  clientCommandId: z.string().min(8).max(80),
  seconds: z.coerce.number().min(0).max(SASA_VOICE_MAX_SECONDS + 1),
});

/** Prompt de domínio: ajuda o Whisper com os termos do dia do corretor. */
const SASA_PROMPT = "Corretor de plano de saúde falando com o assistente Sasá: retorno, plantão, pausa, cotação, negociação, documentação, agenda, lead, amanhã às 10, Amil, Bradesco, SulAmérica, Unimed, Hapvida.";

type VoiceResponse = { ok: true; text: string } | { ok: false; error: string; code: string };

function fail(status: number, code: string, error: string) {
  return NextResponse.json<VoiceResponse>({ ok: false, code, error }, { status });
}

/**
 * Voz do Sasá (fase 2): o áudio é transcrito em memória e DESCARTADO (D4); só o texto fica em
 * `sasa_commands`, ligado ao pedido pelo `clientCommandId` que a conversa envia logo depois.
 * Tenant e usuário da sessão; só corretor liberado no piloto (D8), com o consentimento de IA atual.
 */
export async function POST(request: NextRequest) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return fail(401, "unauthorized", "Entre de novo para falar com o Sasá.");
  if (context.role !== "broker") return fail(403, "forbidden", "A voz do Sasá é só para corretores.");
  const access = await brokerAiAccess(context.userId).catch(() => ({ enabled: false }));
  if (!access.enabled) return fail(403, "disabled", "A voz do Sasá ainda não está liberada para você.");
  const consent = await readAiConsent(context.tenantId, context.userId).catch(() => ({ granted: false }));
  if (!consent.granted) return fail(409, "consent", "Antes de falar comigo, autorize o uso da IA na conversa do Sasá.");

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const parsed = fields.safeParse({ clientCommandId: form?.get("clientCommandId"), seconds: form?.get("seconds") });
  if (!form || !(audio instanceof Blob) || !parsed.success) return fail(400, "invalid", "Não recebi o áudio. Grave de novo.");
  if (audio.size === 0) return fail(400, "empty", "O áudio veio vazio. Segure o microfone enquanto fala.");
  if (audio.size > SASA_VOICE_MAX_BYTES) return fail(413, "too_long", "Áudio longo demais. Fale em até 1 minuto.");

  // Reenvio do mesmo áudio (internet caiu na resposta): devolve o texto já transcrito, sem cobrar de novo.
  const previous = await findSasaCommand(context.tenantId, context.userId, parsed.data.clientCommandId);
  if (previous?.transcript) return NextResponse.json<VoiceResponse>({ ok: true, text: previous.transcript });

  const limit = sasaLimitMessage(await sasaUsageToday(context.tenantId, context.userId), { audioSeconds: parsed.data.seconds });
  if (limit) return fail(429, "limited", limit);

  const target = await resolveTranscriptionTarget();
  if (!target) return fail(503, "unavailable", "A transcrição de áudio não está configurada. Escreva para mim, por enquanto.");

  const startedAt = Date.now();
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeAudio({ target, audio: bytes, mimeType: audio.type || "audio/webm", timeoutMs: 15_000, prompt: SASA_PROMPT });
    const text = cleanTranscript(result.text).slice(0, 500);
    const seconds = Math.min(SASA_VOICE_MAX_SECONDS, result.durationSeconds ?? parsed.data.seconds);
    void logAiUsage({ tenantId: context.tenantId, purpose: "sasa_voice", model: target.model, startedAt, usage: { cost: estimateTranscriptionCostUsd(target.provider, seconds) ?? 0 }, success: true });
    if (!text) return fail(422, "silent", "Não ouvi nada. Fale um pouco mais perto do celular.");
    await recordSasaTranscription({ tenantId: context.tenantId, userId: context.userId, clientCommandId: parsed.data.clientCommandId, transcript: text, audioSeconds: seconds });
    return NextResponse.json<VoiceResponse>({ ok: true, text });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    void logAiUsage({ tenantId: context.tenantId, purpose: "sasa_voice", model: target.model, startedAt, success: false, error: detail });
    return fail(502, "failed", "Não consegui entender o áudio. Tente de novo ou escreva.");
  }
}
