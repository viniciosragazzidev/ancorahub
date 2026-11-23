import "server-only";

import { eq } from "drizzle-orm";

import { decryptChannelSecret, encryptChannelSecret } from "@/features/communication-channels/secret-crypto";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { isSasaVoicePilot, SASA_VOICE_DAILY_CHARS, SASA_VOICE_OFF, SASA_VOICE_PILOT_SETTING, saoPauloDay, type SasaVoiceState } from "./rules";

/**
 * Onde a voz do Sasá guarda a conexão (23/11). A key do ElevenLabs é DA EMPRESA e só o diretor conecta:
 * `sasa-voice:<tenant>`, com a key CRIPTOGRAFADA (AES-256-GCM, mesmo formato dos tokens do WhatsApp). O corretor do
 * teste só guarda se quer ouvir (`sasa-voice-pref:<tenant>:<usuário>`). O prefixo fica fora do cache e das listas de
 * configurações (`loadAllSettings`). Sem migration.
 */
const CONFIG_PREFIX = "sasa-voice:";
const PREF_PREFIX = "sasa-voice-pref:";
const USAGE_PREFIX = "sasa-voice-usage:";

export type SasaVoiceConfig = {
  keyCiphertext: string;
  keyLast4: string;
  voiceId: string | null;
  voiceName: string | null;
  /** Interruptor do diretor: desligado, ninguém ouve. */
  enabled: boolean;
};

type Usage = { day: string; chars: number };

/** Quem está pedindo: o diretor (gerencia a key) ou o corretor do teste (só ouve). */
export type VoiceRole = "manage" | "listen";

/** Chave de criptografia do servidor (Coolify). Uma própria, ou a dos tokens do WhatsApp. */
function encryptionKey() {
  const key = process.env.SASA_VOICE_KEY_ENCRYPTION_KEY || process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("Chave de criptografia do servidor não configurada.");
  return key;
}

export function encryptVoiceKey(apiKey: string) {
  return encryptChannelSecret(apiKey.trim(), encryptionKey());
}

export function decryptVoiceKey(config: SasaVoiceConfig) {
  return decryptChannelSecret(config.keyCiphertext, encryptionKey());
}

const configKey = (tenantId: string) => `${CONFIG_PREFIX}${tenantId}`;
const prefKey = (tenantId: string, userId: string) => `${PREF_PREFIX}${tenantId}:${userId}`;
const usageKey = (tenantId: string, userId: string) => `${USAGE_PREFIX}${tenantId}:${userId}`;

async function readRow(key: string) {
  const [row] = await getDatabase().select({ value: schema.systemSettings.value }).from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);
  return row?.value ?? null;
}

async function writeRow(key: string, value: string) {
  const now = new Date();
  await getDatabase().insert(schema.systemSettings).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value, updatedAt: now } });
}

export async function readVoiceConfig(tenantId: string): Promise<SasaVoiceConfig | null> {
  const raw = await readRow(configKey(tenantId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SasaVoiceConfig>;
    if (typeof value.keyCiphertext !== "string" || typeof value.keyLast4 !== "string") return null;
    return { keyCiphertext: value.keyCiphertext, keyLast4: value.keyLast4, voiceId: value.voiceId ?? null, voiceName: value.voiceName ?? null, enabled: value.enabled !== false };
  } catch {
    return null;
  }
}

export async function saveVoiceConfig(tenantId: string, config: SasaVoiceConfig) {
  await writeRow(configKey(tenantId), JSON.stringify(config));
}

export async function deleteVoiceConfig(tenantId: string) {
  await getDatabase().delete(schema.systemSettings).where(eq(schema.systemSettings.key, configKey(tenantId)));
}

/** O corretor quer ouvir? Ligado por padrão. */
export async function readListenPref(tenantId: string, userId: string) {
  return (await readRow(prefKey(tenantId, userId))) !== "off";
}

export async function saveListenPref(tenantId: string, userId: string, on: boolean) {
  await writeRow(prefKey(tenantId, userId), on ? "on" : "off");
}

export async function voiceUsageToday(tenantId: string, userId: string, now = new Date()): Promise<number> {
  const raw = await readRow(usageKey(tenantId, userId));
  try {
    const usage = raw ? (JSON.parse(raw) as Usage) : null;
    return usage && usage.day === saoPauloDay(now) ? Number(usage.chars) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Soma os caracteres do dia. Um só corretor no teste: leitura e escrita simples bastam. */
export async function addVoiceUsage(tenantId: string, userId: string, chars: number, now = new Date()) {
  const used = await voiceUsageToday(tenantId, userId, now);
  await writeRow(usageKey(tenantId, userId), JSON.stringify({ day: saoPauloDay(now), chars: used + chars } satisfies Usage));
}

export async function isVoicePilotUser(role: string, userId: string) {
  const extra = await getSystemSetting(SASA_VOICE_PILOT_SETTING).catch(() => undefined);
  return isSasaVoicePilot(role, userId, extra ?? null);
}

/** Diretor gerencia a key; o corretor do teste ouve; os demais, nada. */
export async function voiceRoleOf(role: string, userId: string): Promise<VoiceRole | null> {
  if (role === "director") return "manage";
  return (await isVoicePilotUser(role, userId)) ? "listen" : null;
}

/** O estado que vai para o navegador: só os 4 últimos caracteres da key, nunca ela nem o texto cifrado. */
export function publicVoiceState(config: SasaVoiceConfig | null, usedToday: number, who: VoiceRole, listening = true): SasaVoiceState {
  const base = { ...SASA_VOICE_OFF, allowed: true, canManage: who === "manage", usedToday };
  if (!config) return base;
  return {
    ...base,
    connected: true,
    companyEnabled: config.enabled,
    keyLast4: config.keyLast4,
    voiceId: config.voiceId,
    voiceName: config.voiceName,
    // Diretor: o interruptor da empresa. Corretor: só ouve com a empresa ligada e a preferência dele ligada.
    enabled: who === "manage" ? config.enabled : config.enabled && listening,
    dailyLimit: SASA_VOICE_DAILY_CHARS,
  };
}
