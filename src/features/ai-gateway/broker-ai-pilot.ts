import "server-only";

import { FEATURE_FLAGS, getFeatureFlag, getSystemSetting } from "@/features/system-settings/queries";

/**
 * Pilot of the Jack with the operator RAG (Vinicios, 23/10): only the brokers listed in
 * `broker_ai_pilot_user_ids` (user ids, comma separated) get it for now. Everyone else
 * keeps today's behavior, ruled by the BROKER_AI_ASSISTANTS flag.
 */
export const BROKER_AI_PILOT_SETTING = "broker_ai_pilot_user_ids";

export async function isBrokerAiPilot(userId: string) {
  const value = await getSystemSetting(BROKER_AI_PILOT_SETTING).catch(() => undefined);
  return Boolean(value?.split(",").map((id) => id.trim()).filter(Boolean).includes(userId));
}

/** The broker's assistants answer with AI: the company flag, or this broker is in the pilot. */
export async function brokerAiAccess(userId: string) {
  const [flag, pilot] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.BROKER_AI_ASSISTANTS).catch(() => "false"),
    isBrokerAiPilot(userId),
  ]);
  return { enabled: flag === "true" || pilot, operatorRag: pilot };
}
