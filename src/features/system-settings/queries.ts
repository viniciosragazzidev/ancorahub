import "server-only";

import { inArray, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

type DatabaseError = { code?: string; cause?: { code?: string } };

function isMissingSystemSettingsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as DatabaseError;
  return databaseError.code === "42P01" || databaseError.cause?.code === "42P01";
}

export async function getSystemSettings(keys?: readonly string[]) {
  try {
    return keys?.length
      ? await getDatabase()
          .select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
          .from(schema.systemSettings)
          .where(inArray(schema.systemSettings.key, [...keys]))
      : await getDatabase().select({ key: schema.systemSettings.key, value: schema.systemSettings.value }).from(schema.systemSettings);
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
}
