"use server";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { ElevenLabsError, listElevenLabsVoices } from "./elevenlabs";
import { keyLast4, pickDefaultVoice, SASA_VOICE_OFF, voiceFailureReason, type SasaVoiceOption, type SasaVoiceState } from "./rules";
import { decryptVoiceKey, deleteVoiceConfig, encryptVoiceKey, publicVoiceState, readListenPref, readVoiceConfig, saveListenPref, saveVoiceConfig, voiceRoleOf, voiceUsageToday } from "./store";

/**
 * Voz do Sasá (teste de 23/11). A key do ElevenLabs é da empresa e só o DIRETOR conecta, troca a voz, testa e
 * desconecta. O corretor do teste (Vinicios Ragazzi) só ouve e liga ou desliga para ele. Toda ação confere a sessão
 * no servidor; nenhuma devolve a key (só os 4 últimos caracteres) e nenhuma a escreve em log.
 */
export type SasaVoiceResult = { ok: true; state: SasaVoiceState } | { ok: false; error: string };
type WithVoices = { ok: true; state: SasaVoiceState; voices: SasaVoiceOption[] } | { ok: false; error: string };

const ONLY_DIRECTOR = "Só o diretor conecta e configura a voz do Sasá.";

async function who() {
  const context = await getRequiredTenantContext();
  const role = await voiceRoleOf(context.role, context.userId);
  return role ? { context, role } : null;
}

async function director() {
  const found = await who();
  return found?.role === "manage" ? found.context : null;
}

async function stateOf(tenantId: string, userId: string, role: "manage" | "listen") {
  const [config, used, listening] = await Promise.all([readVoiceConfig(tenantId), voiceUsageToday(tenantId, userId), role === "listen" ? readListenPref(tenantId, userId) : Promise.resolve(true)]);
  return publicVoiceState(config, used, role, listening);
}

function elevenLabsMessage(error: unknown) {
  return error instanceof ElevenLabsError ? `Não consegui falar com o ElevenLabs: ${voiceFailureReason(error.status)}.` : "Não consegui salvar agora. Tente de novo.";
}

/** Estado da voz para a tela e para a conversa. Quem não é diretor nem está no teste recebe tudo desligado. */
export async function getSasaVoiceStateAction(): Promise<SasaVoiceState> {
  try {
    const found = await who();
    if (!found) return SASA_VOICE_OFF;
    return await stateOf(found.context.tenantId, found.context.userId, found.role);
  } catch {
    return SASA_VOICE_OFF;
  }
}

const keySchema = z.string().trim().min(20, "Cole a key inteira do ElevenLabs.").max(200, "Essa key parece longa demais.").regex(/^[A-Za-z0-9_\-]+$/, "A key do ElevenLabs só tem letras, números, _ e -.");

/** Diretor conecta ou troca a key: só grava depois que o ElevenLabs aceita (lista as vozes). Padrão: senhor idoso. */
export async function connectSasaVoiceAction(rawKey: string): Promise<WithVoices> {
  const parsed = keySchema.safeParse(rawKey);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Key inválida." };
  try {
    const context = await director();
    if (!context) return { ok: false, error: ONLY_DIRECTOR };
    const voices = await listElevenLabsVoices(parsed.data);
    if (!voices.length) return { ok: false, error: "Essa conta do ElevenLabs não tem nenhuma voz. Adicione uma voz lá e tente de novo." };
    const previous = await readVoiceConfig(context.tenantId);
    const kept = previous?.voiceId ? voices.find((voice) => voice.id === previous.voiceId) : undefined;
    const voice = kept ?? pickDefaultVoice(voices)!;
    await saveVoiceConfig(context.tenantId, { keyCiphertext: encryptVoiceKey(parsed.data), keyLast4: keyLast4(parsed.data), voiceId: voice.id, voiceName: voice.name, enabled: previous?.enabled ?? true });
    return { ok: true, state: await stateOf(context.tenantId, context.userId, "manage"), voices };
  } catch (error) {
    return { ok: false, error: elevenLabsMessage(error) };
  }
}

/** Vozes da conta conectada (para o diretor trocar a voz). */
export async function listSasaVoicesAction(): Promise<WithVoices> {
  try {
    const context = await director();
    if (!context) return { ok: false, error: ONLY_DIRECTOR };
    const config = await readVoiceConfig(context.tenantId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    const voices = await listElevenLabsVoices(decryptVoiceKey(config));
    return { ok: true, state: await stateOf(context.tenantId, context.userId, "manage"), voices };
  } catch (error) {
    return { ok: false, error: elevenLabsMessage(error) };
  }
}

export async function chooseSasaVoiceAction(input: { voiceId: string; voiceName: string }): Promise<SasaVoiceResult> {
  const parsed = z.object({ voiceId: z.string().trim().min(1).max(80), voiceName: z.string().trim().min(1).max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha uma voz da lista." };
  try {
    const context = await director();
    if (!context) return { ok: false, error: ONLY_DIRECTOR };
    const config = await readVoiceConfig(context.tenantId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    await saveVoiceConfig(context.tenantId, { ...config, voiceId: parsed.data.voiceId, voiceName: parsed.data.voiceName });
    return { ok: true, state: await stateOf(context.tenantId, context.userId, "manage") };
  } catch {
    return { ok: false, error: "Não consegui trocar a voz agora. A anterior continua." };
  }
}

/**
 * Interruptor. Diretor: liga ou desliga a voz para a empresa (a key continua). Corretor do teste: só para ele.
 */
export async function setSasaVoiceEnabledAction(enabled: boolean): Promise<SasaVoiceResult> {
  try {
    const found = await who();
    if (!found) return { ok: false, error: "A voz do Sasá ainda não está liberada para você." };
    const { context, role } = found;
    if (role === "listen") {
      await saveListenPref(context.tenantId, context.userId, Boolean(enabled));
      return { ok: true, state: await stateOf(context.tenantId, context.userId, role) };
    }
    const config = await readVoiceConfig(context.tenantId);
    if (!config) return { ok: false, error: "Conecte a key do ElevenLabs primeiro." };
    await saveVoiceConfig(context.tenantId, { ...config, enabled: Boolean(enabled) });
    return { ok: true, state: await stateOf(context.tenantId, context.userId, role) };
  } catch {
    return { ok: false, error: "Não consegui mudar agora. Tente de novo." };
  }
}

/** Desconectar apaga a key criptografada do servidor (só o diretor). */
export async function disconnectSasaVoiceAction(): Promise<SasaVoiceResult> {
  try {
    const context = await director();
    if (!context) return { ok: false, error: ONLY_DIRECTOR };
    await deleteVoiceConfig(context.tenantId);
    return { ok: true, state: await stateOf(context.tenantId, context.userId, "manage") };
  } catch {
    return { ok: false, error: "Não consegui desconectar agora. A key continua guardada." };
  }
}
