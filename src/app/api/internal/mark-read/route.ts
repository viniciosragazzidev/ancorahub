import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { publishRealtimeSync } from "@/features/notifications/realtime-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const context = await getRequiredTenantContext();
    const parsed = markReadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "notificationId is invalid" }, { status: 400 });
    const { notificationId } = parsed.data;

    const updated = await getDatabase()
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.tenantId, context.tenantId),
          eq(schema.notifications.recipientUserId, context.userId),
          isNull(schema.notifications.readAt),
        ),
      )
      .returning({ id: schema.notifications.id });

    if (updated.length) {
      try {
        await publishRealtimeSync(
          { tenantId: context.tenantId, userId: context.userId },
          {
            version: 1,
            kind: "notification.read",
            notificationId: updated[0].id,
            occurredAt: new Date().toISOString(),
          },
        );
      } catch {
        // Reading the notification remains successful if the optional live
        // signal is temporarily unavailable.
      }
    }

    revalidatePath("/notificacoes");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}
