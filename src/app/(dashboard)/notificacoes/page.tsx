import { desc, and, eq, isNull, count, or } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { NotificationsClient } from "./notifications-client";

const PAGE_SIZE = 20;

export default async function NotificationsPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

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
    .where(
      and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.recipientUserId, context.userId),
      ),
    )
    .orderBy(desc(schema.notifications.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const pageItems = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = pageItems.length > 0
    ? pageItems[pageItems.length - 1].createdAt.toISOString()
    : null;

  const serializedNotifications = pageItems.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    leadId: notification.leadId,
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

  return (
    <>
      <DashboardHeader breadcrumb="Centro de notificações" title="Notificações" />
      <NotificationsClient
        initialNotifications={serializedNotifications}
        initialNextCursor={nextCursor}
        initialHasMore={hasMore}
        totalCount={Number(totalResult?.total ?? 0)}
        unreadCount={Number(unreadResult?.total ?? 0)}
        urgentCount={Number(urgentResult?.total ?? 0)}
      />
    </>
  );
}
