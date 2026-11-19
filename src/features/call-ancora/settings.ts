import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { CALL_ANCORA_SOURCE } from "./cold-base";
import { parseCallAncoraSettings, startOfTodaySaoPaulo, type CallAncoraSettings } from "./settings-rules";

const settingKey = (tenantId: string) => `call_ancora_settings:${tenantId}`;

/** Cache curto: a fila consulta a cada poucos segundos. */
const cache = new Map<string, { value: CallAncoraSettings; at: number }>();
const CACHE_MS = 15_000;

export async function readCallAncoraSettings(tenantId: string): Promise<CallAncoraSettings> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const raw = await getSystemSetting(settingKey(tenantId)).catch(() => undefined);
  const value = parseCallAncoraSettings(raw);
  cache.set(tenantId, { value, at: Date.now() });
  return value;
}

export async function writeCallAncoraSettings(tenantId: string, settings: CallAncoraSettings) {
  await setSystemSetting(settingKey(tenantId), JSON.stringify(settings));
  cache.set(tenantId, { value: settings, at: Date.now() });
}

/**
 * Contatos do Call Âncora hoje (São Paulo): notas com metadata.source = call_ancora.
 * Correções não contam de novo. Sem brokerId: a empresa toda.
 */
export async function countCallAncoraContactsToday(tenantId: string, brokerId: string | null, now = new Date()) {
  const since = startOfTodaySaoPaulo(now);
  const [row] = await getDatabase()
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.leadInteractions)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
    .where(and(
      eq(schema.leads.tenantId, tenantId),
      brokerId ? eq(schema.leadInteractions.userId, brokerId) : undefined,
      gte(schema.leadInteractions.createdAt, since),
      sql`${schema.leadInteractions.metadata}->>'source' = ${CALL_ANCORA_SOURCE}`,
      sql`coalesce(${schema.leadInteractions.metadata}->>'correction', 'false') <> 'true'`,
    ));
  return Number(row?.total ?? 0);
}
