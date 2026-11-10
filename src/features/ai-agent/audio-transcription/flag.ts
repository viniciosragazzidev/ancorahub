import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Chave por empresa: `feature_ai_audio_transcription_<tenantId>`. Desligada por padrão. */
export function aiAudioTranscriptionSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.AI_AUDIO_TRANSCRIPTION.key}_${tenantId}`;
}

/** Tenant vem do webhook já resolvido (canal/número da empresa), nunca do cliente. */
export async function isAiAudioTranscriptionEnabled(tenantId: string) {
  const value = await getSystemSetting(aiAudioTranscriptionSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.AI_AUDIO_TRANSCRIPTION.defaultValue) === "true";
}
