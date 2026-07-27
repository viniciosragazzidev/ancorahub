import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await getRequiredTenantContext();
    const { notificationId } = await request.json();

    if (!notificationId || typeof notificationId !== "string") {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    await getDatabase()
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.tenantId, context.tenantId),
          eq(schema.notifications.recipientUserId, context.userId),
          isNull(schema.notifications.readAt),
        ),
      );

    revalidatePath("/notificacoes");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}
