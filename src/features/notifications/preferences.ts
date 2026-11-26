import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { defaultNotificationPreferences, normalizeNotificationPreferences, type NotificationPreferences } from "./preferences-core";

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

/** A migration 0243 está aplicada? Sem a tabela vale o padrão (tudo ligado) e salvar avisa que falta a migration. */
export async function notificationPreferencesTableReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await getDatabase()
    .execute(sql`select to_regclass('public.user_notification_preferences') is not null as ready`)
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { ready?: boolean }[];
      return Boolean(rows[0]?.ready);
    })
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

/** Preferências do usuário; qualquer falha de leitura devolve o padrão, para nunca segurar um aviso. */
export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    if (!(await notificationPreferencesTableReady())) return defaultNotificationPreferences();
    const [row] = await getDatabase()
      .select({ channels: schema.userNotificationPreferences.channels, pushPrivacy: schema.userNotificationPreferences.pushPrivacy })
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, userId))
      .limit(1);
    return normalizeNotificationPreferences(row ?? null);
  } catch (error) {
    console.warn("[notification-preferences] read_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return defaultNotificationPreferences();
  }
}

export async function saveUserNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<{ saved: boolean }> {
  if (!(await notificationPreferencesTableReady())) return { saved: false };
  const now = new Date();
  await getDatabase()
    .insert(schema.userNotificationPreferences)
    .values({ userId, channels: prefs.channels, pushPrivacy: prefs.pushPrivacy, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.userNotificationPreferences.userId,
      set: { channels: prefs.channels, pushPrivacy: prefs.pushPrivacy, updatedAt: now },
    });
  return { saved: true };
}
