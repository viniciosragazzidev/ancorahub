import "server-only";

import { createHmac } from "node:crypto";

import { getSystemSetting } from "@/features/system-settings/queries";

export const REALTIME_SYNC_FEATURE = "feature_realtime_sync_enabled";
export const REALTIME_SYNC_EVENT = "refresh";

export type RealtimeSyncSignal = {
  version: 1;
  kind: "notification.created" | "notification.read";
  notificationId: string;
  occurredAt: string;
};

type RealtimeSyncTarget = {
  tenantId: string;
  userId: string;
};

type RealtimeSyncNotification = RealtimeSyncTarget & {
  notificationId: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

/**
 * Creates a non-guessable, user-scoped Broadcast topic. The topic carries no
 * business data; the browser still reads any details through the authenticated
 * application API after receiving the signal.
 */
export function getRealtimeSyncTopic(target: RealtimeSyncTarget) {
  const secret = requiredEnv("BETTER_AUTH_SECRET");
  if (!secret) return null;

  const digest = createHmac("sha256", secret)
    .update(`ancorahub:realtime-sync:v1:${target.tenantId}:${target.userId}`)
    .digest("base64url");

  return `ancorahub:sync:${digest}`;
}

export async function isRealtimeSyncEnabled() {
  return (await getSystemSetting(REALTIME_SYNC_FEATURE)) !== "false";
}

/**
 * Best-effort signal only. Notification persistence and Web Push must remain
 * successful even if Supabase Realtime is unavailable.
 */
export async function publishRealtimeSync(target: RealtimeSyncTarget, signal: RealtimeSyncSignal) {
  if (!(await isRealtimeSyncEnabled())) return false;

  return sendRealtimeSignal(target, signal);
}

/**
 * Publishes many persisted notification invalidations while reading the feature
 * setting once. Call this only after the database transaction is committed.
 */
export async function publishRealtimeSyncSignals(notifications: RealtimeSyncNotification[]) {
  if (!notifications.length || !(await isRealtimeSyncEnabled())) return;

  const occurredAt = new Date().toISOString();
  await Promise.allSettled(notifications.map(({ tenantId, userId, notificationId }) =>
    sendRealtimeSignal(
      { tenantId, userId },
      { version: 1, kind: "notification.created", notificationId, occurredAt },
    ),
  ));
}

async function sendRealtimeSignal(target: RealtimeSyncTarget, signal: RealtimeSyncSignal) {

  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const topic = getRealtimeSyncTopic(target);
  if (!url || !serviceRoleKey || !topic) return false;

  const response = await fetch(
    `${url}/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/${REALTIME_SYNC_EVENT}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(signal),
      cache: "no-store",
    },
  );

  return response.ok;
}
