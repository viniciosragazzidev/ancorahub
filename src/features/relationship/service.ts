import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { publishNotification } from "@/features/notifications/send-push-helper";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { audienceSchema, canSend, resolveAudience } from "./audience";

export const BROADCAST_KINDS = ["notice", "recognition", "confirmation"] as const;
export type BroadcastKind = (typeof BROADCAST_KINDS)[number];
export const KIND_LABEL: Record<BroadcastKind, string> = { notice: "Aviso", recognition: "Reconhecimento", confirmation: "Pedido de confirmação" };

export const MAX_RECIPIENTS = 1_000;

export const broadcastInputSchema = z.object({
  kind: z.enum(BROADCAST_KINDS),
  title: z.string().trim().min(3, "Escreva um título.").max(80, "Título com até 80 caracteres."),
  body: z.string().trim().min(3, "Escreva a mensagem.").max(1_000, "Mensagem com até 1.000 caracteres."),
  audience: audienceSchema,
  // R1 is in-app only; the WhatsApp channel comes in R3 with the DEC-125 rules.
  channel: z.literal("app").default("app"),
});
export type BroadcastInput = z.infer<typeof broadcastInputSchema>;

export const notificationKeyOf = (broadcastId: string, brokerId: string) => `relationship:${broadcastId}:${brokerId}`;

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  }));
}

/** Creates the broadcast, one row per recipient and one in-app notification (push + realtime) each. */
export async function sendBroadcast(context: TenantContext, raw: unknown, now = new Date()) {
  if (!canSend(context)) throw new Error("Só diretoria, gestão e supervisão enviam mensagens.");
  const input = broadcastInputSchema.parse(raw);
  const { brokers, label } = await resolveAudience(context, input.audience, now);
  if (!brokers.length) throw new Error("Ninguém recebe com esse filtro. Ajuste para quem vai.");
  if (brokers.length > MAX_RECIPIENTS) throw new Error(`No máximo ${MAX_RECIPIENTS} corretores por envio.`);

  const db = getDatabase();
  const broadcastId = randomUUID();
  // All or nothing: a broadcast never exists without its recipients and audit.
  await db.transaction(async (tx) => {
    await tx.insert(schema.relationshipBroadcasts).values({
      id: broadcastId,
      tenantId: context.tenantId,
      senderId: context.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      audience: input.audience,
      audienceLabel: label,
      channel: input.channel,
      requireAck: input.kind === "confirmation",
      recipientsCount: brokers.length,
      createdAt: now,
    });
    await tx.insert(schema.relationshipBroadcastRecipients).values(brokers.map((broker) => ({
      id: randomUUID(),
      tenantId: context.tenantId,
      broadcastId,
      brokerId: broker.id,
      notificationKey: notificationKeyOf(broadcastId, broker.id),
      createdAt: now,
    })));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "relationship_broadcast", entidadeId: broadcastId, acao: `enviou ${KIND_LABEL[input.kind].toLowerCase()} para ${label} (${brokers.length})` });
  });

  // Published only after the commit.
  const delivered: string[] = [];
  const failed: string[] = [];
  await runWithConcurrency(brokers, 5, async (broker) => {
    try {
      const ok = await publishNotification({
        capability: "relationship_message",
        tenantId: context.tenantId,
        recipientUserId: broker.id,
        type: `relationship.${input.kind}`,
        title: input.title,
        message: input.body,
        url: "/relacionamento",
        tag: `relationship-${broadcastId}`,
        idempotencyKey: notificationKeyOf(broadcastId, broker.id),
      });
      if (ok) delivered.push(broker.id);
    } catch {
      failed.push(broker.id);
    }
  });
  // A failed push may still have written the in-app row: delivered only when that row really exists.
  if (failed.length) {
    const written = await db.select({ userId: schema.notifications.recipientUserId }).from(schema.notifications)
      .where(and(eq(schema.notifications.tenantId, context.tenantId), inArray(schema.notifications.idempotencyKey, failed.map((brokerId) => notificationKeyOf(broadcastId, brokerId)))));
    delivered.push(...written.map((row) => row.userId));
  }
  if (delivered.length) {
    await db.update(schema.relationshipBroadcastRecipients).set({ deliveredAt: new Date() })
      .where(and(eq(schema.relationshipBroadcastRecipients.broadcastId, broadcastId), inArray(schema.relationshipBroadcastRecipients.brokerId, delivered)));
  }
  await db.update(schema.relationshipBroadcasts).set({ sentAt: new Date() }).where(eq(schema.relationshipBroadcasts.id, broadcastId));
  return { id: broadcastId, recipients: brokers.length, delivered: delivered.length, label };
}

const recipients = schema.relationshipBroadcastRecipients;
const notifications = schema.notifications;
/** Read when the broker opened the mural, tapped "Ciente" or read the notice anywhere else (Âncora, sino). */
const readExpr = sql<Date | null>`coalesce(${recipients.readAt}, ${recipients.ackAt}, ${notifications.readAt})`;
const notificationJoin = and(eq(notifications.tenantId, recipients.tenantId), eq(notifications.idempotencyKey, recipients.notificationKey));

/** History of the Central: director sees all, others what they sent. */
export async function listBroadcasts(context: TenantContext, limit = 50) {
  if (!canSend(context)) return [];
  const db = getDatabase();
  const broadcasts = schema.relationshipBroadcasts;
  const rows = await db.select({
    id: broadcasts.id,
    kind: broadcasts.kind,
    title: broadcasts.title,
    body: broadcasts.body,
    audienceLabel: broadcasts.audienceLabel,
    requireAck: broadcasts.requireAck,
    recipientsCount: broadcasts.recipientsCount,
    createdAt: broadcasts.createdAt,
    senderName: schema.user.name,
  }).from(broadcasts)
    .innerJoin(schema.user, eq(schema.user.id, broadcasts.senderId))
    .where(and(eq(broadcasts.tenantId, context.tenantId), context.role === "director" ? undefined : eq(broadcasts.senderId, context.userId)))
    .orderBy(desc(broadcasts.createdAt))
    .limit(limit);
  if (!rows.length) return [];
  const stats = await db.select({
    broadcastId: recipients.broadcastId,
    read: sql<number>`count(*) filter (where ${readExpr} is not null)`,
    acked: sql<number>`count(*) filter (where ${recipients.ackAt} is not null)`,
  }).from(recipients)
    .leftJoin(notifications, notificationJoin)
    .where(and(eq(recipients.tenantId, context.tenantId), inArray(recipients.broadcastId, rows.map((row) => row.id))))
    .groupBy(recipients.broadcastId);
  const byId = new Map(stats.map((row) => [row.broadcastId, row]));
  return rows.map((row) => ({ ...row, kind: row.kind as BroadcastKind, read: Number(byId.get(row.id)?.read ?? 0), acked: Number(byId.get(row.id)?.acked ?? 0) }));
}
export type BroadcastSummary = Awaited<ReturnType<typeof listBroadcasts>>[number];

/** Who got one broadcast and whether they read / confirmed it. */
export async function getBroadcastRecipients(context: TenantContext, broadcastId: string) {
  if (!canSend(context)) return [];
  const db = getDatabase();
  const broadcasts = schema.relationshipBroadcasts;
  const [owner] = await db.select({ senderId: broadcasts.senderId }).from(broadcasts)
    .where(and(eq(broadcasts.id, broadcastId), eq(broadcasts.tenantId, context.tenantId))).limit(1);
  if (!owner || (context.role !== "director" && owner.senderId !== context.userId)) return [];
  const rows = await db.select({ brokerId: recipients.brokerId, name: schema.user.name, readAt: readExpr, ackAt: recipients.ackAt })
    .from(recipients)
    .innerJoin(schema.user, eq(schema.user.id, recipients.brokerId))
    .leftJoin(notifications, notificationJoin)
    .where(and(eq(recipients.tenantId, context.tenantId), eq(recipients.broadcastId, broadcastId)))
    .orderBy(schema.user.name);
  return rows.map((row) => ({ ...row, readAt: row.readAt ? new Date(row.readAt) : null }));
}

/** The broker's mural: messages sent to them, newest first. */
export async function listBrokerInbox(context: TenantContext, limit = 50) {
  const db = getDatabase();
  const broadcasts = schema.relationshipBroadcasts;
  const rows = await db.select({
    id: broadcasts.id,
    kind: broadcasts.kind,
    title: broadcasts.title,
    body: broadcasts.body,
    requireAck: broadcasts.requireAck,
    createdAt: broadcasts.createdAt,
    senderName: schema.user.name,
    readAt: readExpr,
    ackAt: recipients.ackAt,
  }).from(recipients)
    .innerJoin(broadcasts, eq(broadcasts.id, recipients.broadcastId))
    .innerJoin(schema.user, eq(schema.user.id, broadcasts.senderId))
    .leftJoin(notifications, notificationJoin)
    .where(and(eq(recipients.tenantId, context.tenantId), eq(recipients.brokerId, context.userId)))
    .orderBy(desc(broadcasts.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, kind: row.kind as BroadcastKind, readAt: row.readAt ? new Date(row.readAt) : null }));
}
export type InboxItem = Awaited<ReturnType<typeof listBrokerInbox>>[number];

/** Opening the mural reads every message of the broker (and their notifications). */
export async function markInboxRead(context: TenantContext, now = new Date()) {
  const db = getDatabase();
  const unread = await db.update(recipients).set({ readAt: now })
    .where(and(eq(recipients.tenantId, context.tenantId), eq(recipients.brokerId, context.userId), isNull(recipients.readAt)))
    .returning({ key: recipients.notificationKey });
  if (unread.length) {
    await db.update(notifications).set({ readAt: now })
      .where(and(eq(notifications.tenantId, context.tenantId), eq(notifications.recipientUserId, context.userId), isNull(notifications.readAt), inArray(notifications.idempotencyKey, unread.map((row) => row.key))));
  }
  return unread.length;
}

/** "Ciente": one message, or every pending confirmation when no id is given (Âncora thread). */
export async function acknowledge(context: TenantContext, broadcastId?: string, now = new Date()) {
  const db = getDatabase();
  const broadcasts = schema.relationshipBroadcasts;
  const pending = await db.select({ id: recipients.id, key: recipients.notificationKey }).from(recipients)
    .innerJoin(broadcasts, eq(broadcasts.id, recipients.broadcastId))
    .where(and(
      eq(recipients.tenantId, context.tenantId),
      eq(recipients.brokerId, context.userId),
      isNull(recipients.ackAt),
      eq(broadcasts.requireAck, true),
      broadcastId ? eq(recipients.broadcastId, broadcastId) : undefined,
    ));
  if (!pending.length) return 0;
  await db.update(recipients).set({ ackAt: now, readAt: sql`coalesce(${recipients.readAt}, ${now.toISOString()}::timestamptz)` })
    .where(inArray(recipients.id, pending.map((row) => row.id)));
  await db.update(notifications).set({ readAt: now })
    .where(and(eq(notifications.tenantId, context.tenantId), eq(notifications.recipientUserId, context.userId), isNull(notifications.readAt), inArray(notifications.idempotencyKey, pending.map((row) => row.key))));
  return pending.length;
}

/** Pending confirmations of the broker (Âncora shows the "Ciente" button while any exists). */
export async function countPendingAcks(context: TenantContext) {
  const broadcasts = schema.relationshipBroadcasts;
  const [row] = await getDatabase().select({ total: sql<number>`count(*)` }).from(recipients)
    .innerJoin(broadcasts, eq(broadcasts.id, recipients.broadcastId))
    .where(and(eq(recipients.tenantId, context.tenantId), eq(recipients.brokerId, context.userId), isNull(recipients.ackAt), eq(broadcasts.requireAck, true), isNotNull(recipients.deliveredAt)));
  return Number(row?.total ?? 0);
}
