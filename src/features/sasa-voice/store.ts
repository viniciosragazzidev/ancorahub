import "server-only";

import { eq } from "drizzle-orm";

import { decryptChannelSecret, encryptChannelSecret } from "@/features/communication-channels/secret-crypto";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { isSasaVoicePilot, SASA_VOICE_DAILY_CHARS, SASA_VOICE_OFF, SASA_VOICE_PILOT_SETTING, saoPauloDay, type SasaVoiceState } from "./rules";

/**
 * Onde a voz da Sasá guarda a conexão (23/11, teste do Vinicios): uma linha de `system_settings` por corretor,
 * `sasa-voice:<tenant>:<usuário>`, com a key do ElevenLabs CRIPTOGRAFADA (AES-256-GCM, mesmo formato dos tokens do
 * WhatsApp). O prefixo fica fora do cache e das listas de configurações (`loadAllSettings`). Sem migration.
 */
const CONFIG_PREFIX = "sasa-voice:";
const USAGE_PREFIX = "sasa-voice-usage:";

export type SasaVoiceConfig = {
  keyCiphertext: string;
  keyLast4: string;
  voiceId: string | null;
  voiceName: string | null;
  enabled: boolean;
};

type Usage = { day: string; chars: number };

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

const configKey = (tenantId: string, userId: string) => `${CONFIG_PREFIX}${tenantId}:${userId}`;
const usageKey = (tenantId: string, userId: string) => `${USAGE_PREFIX}${tenantId}:${userId}`;

async function readRow(key: string) {
  const [row] = await getDatabase().select({ value: schema.systemSettings.value }).from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);
  return row?.value ?? null;
}

async function writeRow(key: string, value: string) {
  const now = new Date();
  await getDatabase().insert(schema.systemSettings).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value, updatedAt: now } });
}

export async function readVoiceConfig(tenantId: string, userId: string): Promise<SasaVoiceConfig | null> {
  const raw = await readRow(configKey(tenantId, userId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SasaVoiceConfig>;
    if (typeof value.keyCiphertext !== "string" || typeof value.keyLast4 !== "string") return null;
    return { keyCiphertext: value.keyCiphertext, keyLast4: value.keyLast4, voiceId: value.voiceId ?? null, voiceName: value.voiceName ?? null, enabled: value.enabled !== false };
  } catch {
    return null;
  }
}

export async function saveVoiceConfig(tenantId: string, userId: string, config: SasaVoiceConfig) {
  await writeRow(configKey(tenantId, userId), JSON.stringify(config));
}

export async function deleteVoiceConfig(tenantId: string, userId: string) {
  await getDatabase().delete(schema.systemSettings).where(eq(schema.systemSettings.key, configKey(tenantId, userId)));
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

/** O estado que vai para o navegador: só os 4 últimos caracteres da key, nunca ela nem o texto cifrado. */
export function publicVoiceState(config: SasaVoiceConfig | null, usedToday: number): SasaVoiceState {
  if (!config) return { ...SASA_VOICE_OFF, allowed: true, usedToday };
  return { allowed: true, connected: true, keyLast4: config.keyLast4, voiceId: config.voiceId, voiceName: config.voiceName, enabled: config.enabled, usedToday, dailyLimit: SASA_VOICE_DAILY_CHARS };
}
