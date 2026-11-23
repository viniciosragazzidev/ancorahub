"use server";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { ElevenLabsError, listElevenLabsVoices } from "./elevenlabs";
import { keyLast4, pickDefaultVoice, SASA_VOICE_OFF, voiceFailureReason, type SasaVoiceOption, type SasaVoiceState } from "./rules";
import { decryptVoiceKey, deleteVoiceConfig, encryptVoiceKey, isVoicePilotUser, publicVoiceState, readVoiceConfig, saveVoiceConfig, voiceUsageToday } from "./store";

/**
 * Voz da Sasá (teste de 23/11, só o corretor Vinicios Ragazzi). Toda ação confere a sessão e a liberação no
 * servidor; nenhuma devolve a key (só os 4 últimos caracteres) e nenhuma a escreve em log.
 */
export type SasaVoiceResult = { ok: true; state: SasaVoiceState } | { ok: false; error: string };
type WithVoices = { ok: true; state: SasaVoiceState; voices: SasaVoiceOption[] } | { ok: false; error: string };

async function pilot() {
  const context = await getRequiredTenantContext();
  if (!(await isVoicePilotUser(context.role, context.userId))) return null;
  return context;
}

async function stateOf(tenantId: string, userId: string) {
  const [config, used] = await Promise.all([readVoiceConfig(tenantId, userId), voiceUsageToday(tenantId, userId)]);
  return publicVoiceState(config, used);
}

function elevenLabsMessage(error: unknown) {
  return error instanceof ElevenLabsError ? `Não consegui falar com o ElevenLabs: ${voiceFailureReason(error.status)}.` : "Não consegui salvar agora. Tente de novo.";
}

/** Estado da voz para a tela e para a conversa. Quem não está no teste recebe tudo desligado. */
export async function getSasaVoiceStateAction(): Promise<SasaVoiceState> {
  try {
    const context = await pilot();
    if (!context) return SASA_VOICE_OFF;
    return await stateOf(context.tenantId, context.userId);
  } catch {
    return SASA_VOICE_OFF;
  }
}

const keySchema = z.string().trim().min(20, "Cole a key inteira do ElevenLabs.").max(200, "Essa key parece longa demais.").regex(/^[A-Za-z0-9_\-]+$/, "A key do ElevenLabs só tem letras, números, _ e -.");

/** Conecta ou troca a key: só grava depois que o ElevenLabs aceita (lista as vozes). Escolhe uma voz pt-BR. */
export async function connectSasaVoiceAction(rawKey: string): Promise<WithVoices> {
  const parsed = keySchema.safeParse(rawKey);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Key inválida." };
  try {
    const context = await pilot();
    if (!context) return { ok: false, error: "A voz da Sasá ainda não está liberada para você." };
    const voices = await listElevenLabsVoices(parsed.data);
    if (!voices.length) return { ok: false, error: "Essa conta do ElevenLabs não tem nenhuma voz. Adicione uma voz lá e tente de novo." };
    const previous = await readVoiceConfig(context.tenantId, context.userId);
    const kept = previous?.voiceId ? voices.find((voice) => voice.id === previous.voiceId) : undefined;
    const voice = kept ?? pickDefaultVoice(voices)!;
    await saveVoiceConfig(context.tenantId, context.userId, { keyCiphertext: encryptVoiceKey(parsed.data), keyLast4: keyLast4(parsed.data), voiceId: voice.id, voiceName: voice.name, enabled: previous?.enabled ?? true });
    return { ok: true, state: await stateOf(context.tenantId, context.userId), voices };
  } catch (error) {
    return { ok: false, error: elevenLabsMessage(error) };
  }
}

/** Vozes da conta conectada (para trocar a voz). */
export async function listSasaVoicesAction(): Promise<WithVoices> {
  try {
    const context = await pilot();
    if (!context) return { ok: false, error: "A voz da Sasá ainda não está liberada para você." };
    const config = await readVoiceConfig(context.tenantId, context.userId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    const voices = await listElevenLabsVoices(decryptVoiceKey(config));
    return { ok: true, state: await stateOf(context.tenantId, context.userId), voices };
  } catch (error) {
    return { ok: false, error: elevenLabsMessage(error) };
  }
}

export async function chooseSasaVoiceAction(input: { voiceId: string; voiceName: string }): Promise<SasaVoiceResult> {
  const parsed = z.object({ voiceId: z.string().trim().min(1).max(80), voiceName: z.string().trim().min(1).max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha uma voz da lista." };
  try {
    const context = await pilot();
    if (!context) return { ok: false, error: "A voz da Sasá ainda não está liberada para você." };
    const config = await readVoiceConfig(context.tenantId, context.userId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    await saveVoiceConfig(context.tenantId, context.userId, { ...config, voiceId: parsed.data.voiceId, voiceName: parsed.data.voiceName });
    return { ok: true, state: await stateOf(context.tenantId, context.userId) };
  } catch {
    return { ok: false, error: "Não consegui trocar a voz agora. A anterior continua." };
  }
}

/** Interruptor da voz (a conexão continua; só deixa de falar). */
export async function setSasaVoiceEnabledAction(enabled: boolean): Promise<SasaVoiceResult> {
  try {
    const context = await pilot();
    if (!context) return { ok: false, error: "A voz da Sasá ainda não está liberada para você." };
    const config = await readVoiceConfig(context.tenantId, context.userId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    await saveVoiceConfig(context.tenantId, context.userId, { ...config, enabled: Boolean(enabled) });
    return { ok: true, state: await stateOf(context.tenantId, context.userId) };
  } catch {
    return { ok: false, error: "Não consegui mudar agora. Tente de novo." };
  }
}

/** Desconectar apaga a key criptografada do servidor. */
export async function disconnectSasaVoiceAction(): Promise<SasaVoiceResult> {
  try {
    const context = await pilot();
    if (!context) return { ok: false, error: "A voz da Sasá ainda não está liberada para você." };
    await deleteVoiceConfig(context.tenantId, context.userId);
    return { ok: true, state: await stateOf(context.tenantId, context.userId) };
  } catch {
    return { ok: false, error: "Não consegui desconectar agora. A key continua guardada." };
  }
}
