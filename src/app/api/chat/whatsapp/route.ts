import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

/**
 * Whether the broker's own WhatsApp is connected, as last recorded (a GET: also
 * works in "Ver como", where the proxy blocks server actions). Read only: the
 * status and when it connected, never the session or the QR code.
 */
export async function GET() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ connection: null }, { status: 401 });
  if (context.role !== "broker") return NextResponse.json({ connection: null });
  const [connection] = await getDatabase()
    .select({ status: schema.whatsappConnections.status, connectedAt: schema.whatsappConnections.connectedAt })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId)))
    .limit(1);
  return NextResponse.json(
    { connection: { status: connection?.status ?? "disconnected", connectedAt: connection?.connectedAt?.toISOString() ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
