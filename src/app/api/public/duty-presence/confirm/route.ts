import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq, exists, gt, lte, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { effectiveAttendanceMode, getSelfDutyConfirmationWindowState, SELF_CONFIRM_LATE_MESSAGE, SELF_CONFIRM_OPENS_MINUTES, SELF_CONFIRM_TOLERANCE_MINUTES } from "@/features/lead-distribution/duty-presence-domain";
import { wakeLeadsAwaitingEligibleBroker } from "@/features/lead-distribution/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Link de confirmação inválido." }, { status: 400 });

  const db = getDatabase();
  // Presencial is confirmed only in the app, with the photo of the place (the link page sends the broker there).
  // A broker marked online inside a presencial plantão confirms here with one tap.
  const [mode] = await db.select({ status: schema.dutyPresenceConfirmations.status, attendanceMode: schema.unitDutySchedules.attendanceMode, assignmentAttendanceMode: schema.dutyRosterAssignments.attendanceMode, shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt, shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt, joinedAt: schema.dutyRosterAssignments.createdAt })
    .from(schema.dutyPresenceConfirmations)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyPresenceConfirmations.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyPresenceConfirmations.tenantId)))
    .leftJoin(schema.dutyRosterAssignments, and(eq(schema.dutyRosterAssignments.id, schema.dutyPresenceConfirmations.assignmentId), eq(schema.dutyRosterAssignments.tenantId, schema.dutyPresenceConfirmations.tenantId)))
    .where(eq(schema.dutyPresenceConfirmations.id, parsed.data.id)).limit(1);
  const now = new Date();
  const windowState = mode ? getSelfDutyConfirmationWindowState({ startsAt: mode.shiftStartsAt, endsAt: mode.shiftEndsAt, now, joinedAt: mode.joinedAt }) : null;
  if (mode?.status === "pending" && windowState === "late") return NextResponse.json({ success: false, error: SELF_CONFIRM_LATE_MESSAGE }, { status: 409 });
  if (mode?.status === "pending" && windowState === "not_open") return NextResponse.json({ success: false, error: `A confirmação abre ${SELF_CONFIRM_OPENS_MINUTES} minutos antes do plantão.` }, { status: 409 });
  if (mode && effectiveAttendanceMode(mode.assignmentAttendanceMode, mode.attendanceMode) === "presencial") return NextResponse.json({ success: false, error: "Este plantão é presencial: confirme pelo app, tirando uma foto do local." }, { status: 409 });
  const result = await db.transaction(async (tx) => {
    const [confirmed] = await tx.update(schema.dutyPresenceConfirmations).set({ status: "confirmed", confirmedAt: now, updatedAt: now })
      .where(and(
        eq(schema.dutyPresenceConfirmations.id, parsed.data.id),
        eq(schema.dutyPresenceConfirmations.status, "pending"),
        lte(schema.dutyPresenceConfirmations.shiftStartsAt, new Date(now.getTime() + SELF_CONFIRM_OPENS_MINUTES * 60_000)),
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
            // Tolerance counts from the start, or from when the broker joined a plantão already running.
            // ISO string + cast: a Date in a raw `sql` reaches Postgres as Date.toString() and the
            // whole confirmation failed (23/10, every broker at 08:50 saw "Não foi possível confirmar agora").
            sql`greatest(${schema.dutyPresenceConfirmations.shiftStartsAt}, ${schema.dutyRosterAssignments.createdAt}) >= ${new Date(now.getTime() - SELF_CONFIRM_TOLERANCE_MINUTES * 60_000).toISOString()}::timestamptz`,
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

    const [existing] = await tx.select({ status: schema.dutyPresenceConfirmations.status, shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt, shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt, joinedAt: schema.dutyRosterAssignments.createdAt })
      .from(schema.dutyPresenceConfirmations)
      .leftJoin(schema.dutyRosterAssignments, and(eq(schema.dutyRosterAssignments.id, schema.dutyPresenceConfirmations.assignmentId), eq(schema.dutyRosterAssignments.tenantId, schema.dutyPresenceConfirmations.tenantId)))
      .where(eq(schema.dutyPresenceConfirmations.id, parsed.data.id)).limit(1);
    if (existing?.status === "confirmed") return { state: "already_confirmed" as const };
    if (existing?.status === "pending") {
      const existingWindowState = getSelfDutyConfirmationWindowState({ startsAt: existing.shiftStartsAt, endsAt: existing.shiftEndsAt, now, joinedAt: existing.joinedAt });
      if (existingWindowState === "late") return { state: "late" as const };
      if (existingWindowState === "not_open") return { state: "not_open" as const };
    }
    if (existing && existing.shiftEndsAt <= now) {
      await tx.update(schema.dutyPresenceConfirmations).set({ status: "expired", updatedAt: now })
        .where(and(eq(schema.dutyPresenceConfirmations.id, parsed.data.id), eq(schema.dutyPresenceConfirmations.status, "pending")));
    }
    return { state: "unavailable" as const };
  });

  if (result.state === "late") return NextResponse.json({ success: false, error: SELF_CONFIRM_LATE_MESSAGE }, { status: 409 });
  if (result.state === "not_open") return NextResponse.json({ success: false, error: `A confirmação abre ${SELF_CONFIRM_OPENS_MINUTES} minutos antes do plantão.` }, { status: 409 });
  if (result.state === "unavailable") return NextResponse.json({ success: false, error: "Este link expirou ou não está mais disponível." }, { status: 410 });
  // A confirmed broker can receive leads from now on: retry those waiting.
  if (result.state === "confirmed") await wakeLeadsAwaitingEligibleBroker(result.tenantId).catch(() => 0);
  return NextResponse.json({ success: true, alreadyConfirmed: result.state === "already_confirmed" });
}
