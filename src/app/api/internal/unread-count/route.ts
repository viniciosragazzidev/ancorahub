import { NextResponse } from "next/server";
import { and, desc, eq, isNull, count } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { withPerfSpan, withRequestTiming } from "@/shared/observability/request-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withRequestTiming("/api/internal/unread-count", async () => {
    try {
    const context = await getRequiredTenantContext();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "recent") {
      const notifications = await withPerfSpan("unread.recent_list", () => getDatabase()
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
        .limit(5));

      const [countResult] = await withPerfSpan("unread.unread_count", () => getDatabase()
        .select({ total: count() })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.tenantId, context.tenantId),
            eq(schema.notifications.recipientUserId, context.userId),
            isNull(schema.notifications.readAt),
          ),
        ));

      const [totalResult] = await withPerfSpan("unread.total_count", () => getDatabase()
        .select({ total: count() })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.tenantId, context.tenantId),
            eq(schema.notifications.recipientUserId, context.userId),
          ),
        ));

      const serialized = notifications.map((n) => ({
        ...n,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }));

      return NextResponse.json({
        notifications: serialized,
        unreadCount: Number(countResult?.total ?? 0),
        totalCount: Number(totalResult?.total ?? 0),
      });
    }

    const [result] = await withPerfSpan("unread.count", () => getDatabase()
      .select({ count: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.tenantId, context.tenantId),
          eq(schema.notifications.recipientUserId, context.userId),
          isNull(schema.notifications.readAt),
        ),
      ));
    return NextResponse.json({ count: result?.count ?? 0 });
    } catch {
    return NextResponse.json({ count: 0 });
    }
  }, request.headers.get("x-request-id")).then(({ result }) => result);
}
