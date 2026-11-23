import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ElevenLabsError, streamElevenLabsSpeech } from "@/features/sasa-voice/elevenlabs";
import { charsLeftToday, clampVoiceText, SASA_VOICE_TEST_TEXT, voiceFailureReason } from "@/features/sasa-voice/rules";
import { addVoiceUsage, decryptVoiceKey, isVoicePilotUser, readVoiceConfig, voiceUsageToday } from "@/features/sasa-voice/store";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const body = z.object({ text: z.string().max(4000).optional(), test: z.boolean().optional() });

/** Falha vira JSON com o motivo curto; a conversa fica só com o texto. */
function fail(status: number, reason: string) {
  return NextResponse.json({ ok: false, reason }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Voz da Sasá (teste de 23/11, só o Vinicios): o texto da resposta vira MP3 no ElevenLabs e o áudio é repassado por
 * streaming. A key é decifrada só aqui, no servidor, e nunca volta ao navegador. Teto por resposta e por dia.
 */
export async function POST(request: NextRequest) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return fail(401, "entre de novo");
  if (!(await isVoicePilotUser(context.role, context.userId).catch(() => false))) return fail(403, "voz não liberada");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "pedido inválido");
  const config = await readVoiceConfig(context.tenantId, context.userId).catch(() => null);
  if (!config?.voiceId) return fail(409, "a voz não está conectada");
  if (!config.enabled && !parsed.data.test) return fail(409, "a voz está desligada");

  const text = clampVoiceText(parsed.data.test ? SASA_VOICE_TEST_TEXT : parsed.data.text ?? "");
  if (!text) return fail(400, "nada para falar");
  const left = charsLeftToday(await voiceUsageToday(context.tenantId, context.userId).catch(() => 0));
  if (left < text.length) return fail(429, "acabou a cota de voz de hoje");

  try {
    const stream = await streamElevenLabsSpeech(decryptVoiceKey(config), config.voiceId, text);
    await addVoiceUsage(context.tenantId, context.userId, text.length).catch(() => undefined);
    return new Response(stream, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    // Só o status vai para o log; nunca a key nem o texto.
    console.warn("[sasa-voice] tts failed", error instanceof ElevenLabsError ? error.status : "erro interno");
    return fail(502, error instanceof ElevenLabsError ? voiceFailureReason(error.status) : "não consegui gerar a voz");
  }
}
