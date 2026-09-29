import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq, exists, gt, lte, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { wakeLeadsAwaitingEligibleBroker } from "@/features/lead-distribution/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Link de confirmação inválido." }, { status: 400 });

  const db = getDatabase();
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [confirmed] = await tx.update(schema.dutyPresenceConfirmations).set({ status: "confirmed", confirmedAt: now, updatedAt: now })
      .where(and(
        eq(schema.dutyPresenceConfirmations.id, parsed.data.id),
        eq(schema.dutyPresenceConfirmations.status, "pending"),
        gt(schema.dutyPresenceConfirmations.shiftEndsAt, now),
        exists(tx.select({ id: schema.dutyRosterAssignments.id })
          .from(schema.dutyRosterAssignments)
          .innerJoin(schema.unitDutySchedules, and(
            eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
            eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
          ))
          .where(and(
            eq(schema.dutyRosterAssignments.id, schema.dutyPresenceConfirmations.assignmentId),
            eq(schema.dutyRosterAssignments.tenantId, schema.dutyPresenceConfirmations.tenantId),
            eq(schema.dutyRosterAssignments.scheduleId, schema.dutyPresenceConfirmations.scheduleId),
            eq(schema.dutyRosterAssignments.brokerId, schema.dutyPresenceConfirmations.brokerId),
            eq(schema.dutyRosterAssignments.status, "active"),
            eq(schema.unitDutySchedules.status, "active"),
            lte(schema.dutyRosterAssignments.validFrom, now),
            or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
          ))),
      ))
      .returning({ id: schema.dutyPresenceConfirmations.id, brokerId: schema.dutyPresenceConfirmations.brokerId, tenantId: schema.dutyPresenceConfirmations.tenantId });
    if (confirmed) {
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: confirmed.brokerId, entidade: "duty_presence_confirmation",
        entidadeId: confirmed.id, acao: "duty_presence_confirmed", createdAt: now,
      });
      return { state: "confirmed" as const, tenantId: confirmed.tenantId };
    }

    const [existing] = await tx.select({ status: schema.dutyPresenceConfirmations.status, shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt })
      .from(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.id, parsed.data.id)).limit(1);
    if (existing?.status === "confirmed") return { state: "already_confirmed" as const };
    if (existing && existing.shiftEndsAt <= now) {
      await tx.update(schema.dutyPresenceConfirmations).set({ status: "expired", updatedAt: now })
        .where(and(eq(schema.dutyPresenceConfirmations.id, parsed.data.id), eq(schema.dutyPresenceConfirmations.status, "pending")));
    }
    return { state: "unavailable" as const };
  });

  if (result.state === "unavailable") return NextResponse.json({ success: false, error: "Este link expirou ou não está mais disponível." }, { status: 410 });
  // A confirmed broker can receive leads from now on: retry those waiting.
  if (result.state === "confirmed") await wakeLeadsAwaitingEligibleBroker(result.tenantId).catch(() => 0);
  return NextResponse.json({ success: true, alreadyConfirmed: result.state === "already_confirmed" });
}
