import "server-only";

import { and, eq } from "drizzle-orm";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { coldReleaseAt, isColdLeadsQueueName, isColdReleased, todayKeyInSaoPaulo } from "./cold-age-release-rules";

export type ColdAgeReleaseConfig = { enabled: boolean; releasedEarlyOn: string | null };

const settingKey = (queueId: string) => `cold_age_release_${queueId}`;

/** On by default in the "Leads Frios" queue; off elsewhere unless turned on. */
export async function readColdAgeRelease(queueId: string, queueName: string | null): Promise<ColdAgeReleaseConfig> {
  const value = await getSystemSetting(settingKey(queueId)).catch(() => undefined);
  if (value) {
    try {
      const parsed = JSON.parse(value) as Partial<ColdAgeReleaseConfig>;
      return { enabled: parsed.enabled !== false, releasedEarlyOn: typeof parsed.releasedEarlyOn === "string" ? parsed.releasedEarlyOn : null };
    } catch { /* falls back to the default */ }
  }
  return { enabled: isColdLeadsQueueName(queueName), releasedEarlyOn: null };
}

export async function writeColdAgeRelease(queueId: string, config: ColdAgeReleaseConfig) {
  await setSystemSetting(settingKey(queueId), JSON.stringify(config));
}

export const COLD_AGE_RELEASE_REASON = "Fila de leads frios: aguardando liberação (o lead sai às 9h do dia em que completa 2 dias).";

/** Null when the lead may go out now; otherwise when to try again. */
export async function coldAgeReleaseHold(tenantId: string, queueId: string, createdAt: Date, now = new Date()) {
  const [queue] = await getDatabase().select({ name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.id, queueId), eq(schema.leadQueues.tenantId, tenantId)))
    .limit(1);
  if (!queue) return null;
  const config = await readColdAgeRelease(queueId, queue.name);
  if (!config.enabled) return null;
  const releasedEarlyToday = config.releasedEarlyOn === todayKeyInSaoPaulo(now);
  if (isColdReleased(createdAt, now, releasedEarlyToday)) return null;
  return { reason: COLD_AGE_RELEASE_REASON, retryAt: coldReleaseAt(createdAt) };
}
