import "server-only";

import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

export const EXTENSION_INBOX_NOTIFICATION_TYPES = [
  "agent.lead_assigned",
  "lead_reassigned",
  "lead_client_returned",
  "task_overdue",
  "lead_feedback_overdue",
  "lead_feedback_reminder",
  "lead_warning_10m",
  "lead_lost",
  "lead_reopened",
] as const;

const cursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().max(256) }).strict();
const itemSchema = z.object({ id: z.string(), type: z.string(), leadId: z.string().nullable(), createdAt: z.string().datetime() }).strict();
const ACTIVE_OFFER_STATUSES = ["PENDING", "SENT", "DELIVERED", "READ"];
const allowedNotificationTypes = new Set<string>(EXTENSION_INBOX_NOTIFICATION_TYPES);

type InboxCursor = z.infer<typeof cursorSchema>;
type InboxItem = z.infer<typeof itemSchema>;

function normalizeTimestamp(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match) throw new Error("Invalid inbox cursor");
  return `${match[1]}.${(match[2] ?? "").padEnd(6, "0")}Z`;
}

export function parseExtensionInboxCursor(value: string | null): InboxCursor | null {
  if (value === null) return null;
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid inbox cursor");
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); }
  catch { throw new Error("Invalid inbox cursor"); }
  const parsed = cursorSchema.parse(decoded);
  return { createdAt: normalizeTimestamp(parsed.createdAt), id: parsed.id };
}

function encodeCursor(cursor: InboxCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function isAfter(item: Pick<InboxItem, "createdAt" | "id">, cursor: InboxCursor) {
  return item.createdAt > cursor.createdAt || (item.createdAt === cursor.createdAt && item.id > cursor.id);
}

function compareItems(left: InboxItem, right: InboxItem) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function afterCursorCondition(createdAt: typeof schema.notifications.createdAt, id: typeof schema.notifications.id, cursor: InboxCursor) {
  const instant = sql`CAST(${cursor.createdAt} AS timestamptz)`;
  return or(gt(createdAt, instant), and(eq(createdAt, instant), gt(id, cursor.id)));
}

export async function readExtensionInbox(context: TenantContext, cursor: InboxCursor | null) {
  const db = getDatabase();
  const now = new Date();
  const [offers, notifications] = await Promise.all([
    db.select({
      id: schema.leadOffers.id,
      leadId: schema.leads.id,
      createdAt: sql<string>`to_char(${schema.leadOffers.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    }).from(schema.leadOffers)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .where(and(eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.brokerId, context.userId),
        inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES), gt(schema.leadOffers.expiresAt, now),
        isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
      .orderBy(asc(schema.leadOffers.createdAt), asc(schema.leadOffers.id)),
    db.select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      leadId: schema.leads.id,
      createdAt: sql<string>`to_char(${schema.notifications.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    }).from(schema.notifications)
      .leftJoin(schema.leads, and(eq(schema.leads.id, schema.notifications.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId),
        inArray(schema.notifications.type, [...EXTENSION_INBOX_NOTIFICATION_TYPES]),
        cursor ? afterCursorCondition(schema.notifications.createdAt, schema.notifications.id, cursor) : undefined))
      .orderBy(asc(schema.notifications.createdAt), asc(schema.notifications.id)),
  ]);

  const offerItems = offers.map((offer) => itemSchema.parse({ id: offer.id, type: "lead_offer_pending", leadId: offer.leadId, createdAt: offer.createdAt }));
  const notificationItems = notifications
    .filter((notification) => allowedNotificationTypes.has(notification.type))
    .map((notification) => itemSchema.parse({ id: notification.id, type: notification.type, leadId: notification.leadId, createdAt: notification.createdAt }))
    .filter((item) => !cursor || isAfter(item, cursor));
  const changedItems = cursor
    ? [...offerItems.filter((item) => isAfter(item, cursor)), ...notificationItems]
    : [...offerItems, ...notificationItems];

  if (cursor && changedItems.length === 0) return { status: 304 as const };

  const items = (cursor
    ? [...offerItems, ...notificationItems]
    : changedItems).sort(compareItems);
  const newest = changedItems.sort(compareItems).at(-1);
  const nextCursor = newest
    ? { createdAt: newest.createdAt, id: newest.id }
    : { createdAt: normalizeTimestamp(now.toISOString()), id: "" };

  return { status: 200 as const, body: { items, cursor: encodeCursor(nextCursor) } };
}
