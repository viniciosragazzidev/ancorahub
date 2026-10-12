import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The photo of the place taken to confirm an in-person plantão. Seen by the
 * director, the manager of the plantão's branch, and the broker who took it.
 */
export async function GET(request: Request) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Foto inválida." }, { status: 400 });
  const [row] = await getDatabase().select({
    brokerId: schema.dutyPresenceConfirmations.brokerId,
    photoStorageKey: schema.dutyPresenceConfirmations.photoStorageKey,
    branchId: schema.unitDutySchedules.branchId,
  }).from(schema.dutyPresenceConfirmations)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyPresenceConfirmations.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyPresenceConfirmations.tenantId)))
    .where(and(eq(schema.dutyPresenceConfirmations.id, id.data), eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId)))
    .limit(1);
  const allowed = row && (
    context.role === "director"
    || (context.role === "manager" && (!row.branchId || !context.branchId || context.branchId === row.branchId))
    || (context.role === "broker" && row.brokerId === context.userId)
  );
  if (!row?.photoStorageKey || !allowed || !row.photoStorageKey.startsWith(`duty-presence/${context.tenantId}/`)) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }
  if (!(await isR2StorageEnabled())) return NextResponse.json({ error: "Armazenamento desligado." }, { status: 503 });
  try {
    const file = await downloadR2Object(row.photoStorageKey);
    // Stored photos are always re-encoded JPEG; nosniff keeps the browser from guessing anything else.
    return new NextResponse(file, { headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
  } catch (error) {
    console.error("[duty-presence] photo download failed", error);
    return NextResponse.json({ error: "Não consegui abrir a foto agora." }, { status: 502 });
  }
}
