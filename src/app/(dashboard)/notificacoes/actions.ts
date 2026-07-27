"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, lt, count, or } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const PAGE_SIZE = 20;

export async function markNotificationReadAction(formData: FormData) {
  const id = formData.get("notificationId");
  if (typeof id !== "string" || !id) return;

  const context = await getRequiredTenantContext();
  await getDatabase()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(schema.notifications.id, id),
      eq(schema.notifications.tenantId, context.tenantId),
      eq(schema.notifications.recipientUserId, context.userId),
      isNull(schema.notifications.readAt),
    ));

  revalidatePath("/notificacoes");
}

export async function markAllNotificationsReadAction() {
  const context = await getRequiredTenantContext();
  await getDatabase()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(schema.notifications.tenantId, context.tenantId),
      eq(schema.notifications.recipientUserId, context.userId),
      isNull(schema.notifications.readAt),
    ));

  revalidatePath("/notificacoes");
}

export async function loadMoreNotificationsAction(cursor: string | null) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const whereConditions = cursor
    ? and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
        lt(schema.notifications.createdAt, new Date(cursor)),
      )
    : and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
      );

  const rows = await db
    .select({
      id: schema.notifications.id,
      title: schema.notifications.title,
      message: schema.notifications.message,
      type: schema.notifications.type,
      readAt: schema.notifications.readAt,
      createdAt: schema.notifications.createdAt,
      leadId: schema.notifications.leadId,
    })
    .from(schema.notifications)
    .where(whereConditions)
    .orderBy(desc(schema.notifications.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const pageItems = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = pageItems.length > 0
    ? pageItems[pageItems.length - 1].createdAt.toISOString()
    : null;

  const serialized = pageItems.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    leadId: n.leadId,
  }));

  const [[totalResult], [unreadResult], [urgentResult]] = await Promise.all([
    db.select({ total: count() }).from(schema.notifications).where(
      and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
      ),
    ),
    db.select({ total: count() }).from(schema.notifications).where(
      and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
        isNull(schema.notifications.readAt),
      ),
    ),
    db.select({ total: count() }).from(schema.notifications).where(
      and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
        isNull(schema.notifications.readAt),
        or(
          eq(schema.notifications.type, "lead_unworked"),
          eq(schema.notifications.type, "lead_stalled"),
          eq(schema.notifications.type, "document_rejected"),
        ),
      ),
    ),
  ]);

  return {
    notifications: serialized,
    nextCursor,
    hasMore,
    totalCount: Number(totalResult?.total ?? 0),
    unreadCount: Number(unreadResult?.total ?? 0),
    urgentCount: Number(urgentResult?.total ?? 0),
  };
}
