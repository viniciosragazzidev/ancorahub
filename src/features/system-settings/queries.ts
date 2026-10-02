import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { FEATURE_FLAGS, type FeatureFlagDefinition } from "@/shared/feature-flags/catalog";

type DatabaseError = { code?: string; cause?: { code?: string } };

function isMissingSystemSettingsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as DatabaseError;
  return databaseError.code === "42P01" || databaseError.cause?.code === "42P01";
}

/**
 * The whole settings table (a few dozen rows) is read once and kept for a few
 * seconds: it used to be queried on every single flag check — millions of
 * round trips through the small database pool. A change made here is seen at
 * once by this process; any other writer within the TTL.
 */
const SETTINGS_CACHE_TTL_MS = 15_000;
const settingsCache = new TtlCache<{ key: string; value: string }[]>(SETTINGS_CACHE_TTL_MS, 1);

async function loadAllSettings() {
  return settingsCache.getOrLoad("all", () => getDatabase()
    .select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
    .from(schema.systemSettings));
}

export function invalidateSystemSettingsCache() {
  settingsCache.clear();
}

export async function getSystemSettings(keys?: readonly string[]) {
  try {
    const all = await loadAllSettings();
    if (!keys?.length) return all;
    const wanted = new Set(keys);
    return all.filter((setting) => wanted.has(setting.key));
  } catch (error) {
    if (isMissingSystemSettingsTable(error)) {
      try {
        await ensureSystemSettingsTable();
      } catch {
        // Reads remain available with defaults even when the DB user cannot run DDL.
      }
      return [];
    }
    throw error;
  }
}

export async function getSystemSetting(key: string) {
  const [setting] = await getSystemSettings([key]);
  return setting?.value;
}

/**
 * Busca o valor de uma feature flag pelo catálogo central.
 * Usa o defaultValue do catálogo quando a chave não existe no banco,
 * eliminando a necessidade de `?? "valor"` espalhados pelo código.
 *
 * @example
 * const enabled = await getFeatureFlag(FEATURE_FLAGS.AI_QUICK_REPLY);
 * // retorna "true" se não configurado, respeitando o default do catálogo
 */
export async function getFeatureFlag(flag: FeatureFlagDefinition): Promise<string> {
  const stored = await getSystemSetting(flag.key);
  return stored ?? flag.defaultValue;
}

/**
 * Re-exporta o catálogo para uso em arquivos que já importam de system-settings.
 * Prefira importar diretamente de @/shared/feature-flags/catalog quando possível.
 */
export { FEATURE_FLAGS };

async function ensureSystemSettingsTable() {
  await getDatabase().execute(sql`
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function setSystemSetting(key: string, value: string, updatedAt = new Date()) {
  await ensureSystemSettingsTable();
  await getDatabase()
    .insert(schema.systemSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({
      target: schema.systemSettings.key,
      set: { value, updatedAt },
    });
  invalidateSystemSettingsCache();
}
