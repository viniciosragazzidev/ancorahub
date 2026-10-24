import "server-only";

import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

export const REALTIME_SYNC_FEATURE = "feature_realtime_sync_enabled";
export const REALTIME_SYNC_EVENT = "refresh";

export type RealtimeSyncSignal = {
  version: 1;
  kind: "notification.created" | "notification.read";
  notificationId: string;
  occurredAt: string;
};

export type DomainInvalidationSignal = {
  version: 1;
  kind: "domain.invalidated";
  domain: string;
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

/**
 * Best-effort domain invalidation. The signal carries only the coarse domain
 * name (e.g. "leads") — never entity ids or personal data — and the browser
 * re-reads through authenticated routes after receiving it. Call only after the
 * write transaction commits.
 */
export async function publishDomainInvalidation(
  targets: RealtimeSyncTarget[],
  domain: string,
): Promise<void> {
  if (!targets.length || !(await isRealtimeSyncEnabled())) return;

  const occurredAt = new Date().toISOString();
  await Promise.allSettled(targets.map(({ tenantId, userId }) =>
    sendRealtimeSignal(
      { tenantId, userId },
      { version: 1, kind: "domain.invalidated", domain, occurredAt },
    ),
  ));
}

/**
 * Conversations are visible to tenant directors and, when applicable, the
 * broker participating in the workspace. The signal contains no message data;
 * every recipient refreshes its own server-authorized view.
 */
export async function publishConversationInvalidation(input: {
  tenantId: string;
  participantUserIds?: Array<string | null | undefined>;
}): Promise<void> {
  if (!(await isRealtimeSyncEnabled())) return;

  // The broker in the conversation hears every message; the directors hear at most one
  // signal per tenant every DIRECTOR_SIGNAL_WINDOW_MS (24/10): each signal re-renders
  // their whole workspace, and a busy WhatsApp hour sent one per message to each of them.
  const userIds = new Set<string>();
  for (const userId of input.participantUserIds ?? []) if (userId) userIds.add(userId);
  if (shouldSignalDirectorsNow(input.tenantId)) {
    for (const userId of await activeDirectorIds(input.tenantId)) userIds.add(userId);
  }
  if (!userIds.size) return;

  await publishDomainInvalidation(
    [...userIds].map((userId) => ({ tenantId: input.tenantId, userId })),
    "conversations",
  );
}

const DIRECTOR_SIGNAL_WINDOW_MS = 10_000;
const DIRECTORS_CACHE_MS = 60_000;
const lastDirectorSignal = new Map<string, number>();
const trailingDirectorSignal = new Map<string, ReturnType<typeof setTimeout>>();
const directorsCache = new Map<string, { at: number; ids: string[] }>();

async function activeDirectorIds(tenantId: string) {
  const cached = directorsCache.get(tenantId);
  if (cached && Date.now() - cached.at < DIRECTORS_CACHE_MS) return cached.ids;
  const rows = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.role, "director"),
      ),
    )
    .limit(20);
  const ids = rows.map((row) => row.userId);
  directorsCache.set(tenantId, { at: Date.now(), ids });
  return ids;
}

/**
 * True when the directors may be signalled now. Inside the window the signal is skipped,
 * and one trailing signal goes out when the window ends, so the last message is never missed.
 */
function shouldSignalDirectorsNow(tenantId: string, now = Date.now()) {
  const last = lastDirectorSignal.get(tenantId) ?? 0;
  if (now - last >= DIRECTOR_SIGNAL_WINDOW_MS) {
    lastDirectorSignal.set(tenantId, now);
    return true;
  }
  if (!trailingDirectorSignal.has(tenantId)) {
    trailingDirectorSignal.set(tenantId, setTimeout(() => {
      trailingDirectorSignal.delete(tenantId);
      lastDirectorSignal.set(tenantId, Date.now());
      void activeDirectorIds(tenantId)
        .then((ids) => publishDomainInvalidation(ids.map((userId) => ({ tenantId, userId })), "conversations"))
        .catch(() => undefined);
    }, last + DIRECTOR_SIGNAL_WINDOW_MS - now));
  }
  return false;
}

async function sendRealtimeSignal(target: RealtimeSyncTarget, signal: RealtimeSyncSignal | DomainInvalidationSignal) {

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
