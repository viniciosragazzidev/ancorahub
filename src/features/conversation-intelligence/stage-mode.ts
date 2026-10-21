import "server-only";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";

/**
 * What the IA does with the lead stage after reading the conversation, chosen
 * per company by the director (Configurações › IA):
 * - auto: moves forward by itself (Desfazer for 24h); lost and going back stay suggestions
 * - suggest: only shows "Mover para X" for the broker to accept
 * - off: no move and no suggestion, only the diagnosis
 * Same per-tenant key pattern as meta_lead_capture_mode_<tenantId>; no migration.
 */
export const AI_STAGE_MODES = ["auto", "suggest", "off"] as const;
export type AiStageMode = (typeof AI_STAGE_MODES)[number];

/** Decided 21/10: companies start on automatic. */
export const DEFAULT_AI_STAGE_MODE: AiStageMode = "auto";

function settingKey(tenantId: string) {
  return `ai_stage_mode_${tenantId}`;
}

export function parseAiStageMode(value: string | null | undefined): AiStageMode {
  return (AI_STAGE_MODES as readonly string[]).includes(value ?? "") ? (value as AiStageMode) : DEFAULT_AI_STAGE_MODE;
}

export async function getAiStageMode(tenantId: string): Promise<AiStageMode> {
  const stored = await getSystemSetting(settingKey(tenantId)).catch(() => null);
  return parseAiStageMode(stored);
}

export async function setAiStageMode(tenantId: string, mode: AiStageMode) {
  await setSystemSetting(settingKey(tenantId), mode);
}
