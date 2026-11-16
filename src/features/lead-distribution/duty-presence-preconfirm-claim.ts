import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type PreconfirmOccurrence = {
  tenantId: string;
  scheduleId: string;
  assignmentId: string;
  brokerId: string;
  dutyDate: string;
  startsAt: Date;
  endsAt: Date;
};

export async function claimDutyPresencePreconfirmation(
  tx: DatabaseExecutor,
  input: PreconfirmOccurrence & { actorId: string; now: Date },
): Promise<{ kind: "claimed"; confirmationId: string } | { kind: "already_confirmed" } | { kind: "unavailable" }> {
  await tx.insert(schema.dutyPresenceConfirmations).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    scheduleId: input.scheduleId,
    assignmentId: input.assignmentId,
    brokerId: input.brokerId,
    dutyDate: input.dutyDate,
    shiftStartsAt: input.startsAt,
    shiftEndsAt: input.endsAt,
    status: "pending",
    notificationStatus: "pending",
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoNothing();

  const [changed] = await tx.update(schema.dutyPresenceConfirmations).set({
    status: "confirmed",
    confirmedAt: input.now,
    confirmedBy: input.actorId,
    releaseNote: "Pré-confirmado após presença confirmada no turno contíguo anterior.",
    updatedAt: input.now,
  }).where(and(
    eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
    eq(schema.dutyPresenceConfirmations.scheduleId, input.scheduleId),
    eq(schema.dutyPresenceConfirmations.assignmentId, input.assignmentId),
    eq(schema.dutyPresenceConfirmations.brokerId, input.brokerId),
    eq(schema.dutyPresenceConfirmations.dutyDate, input.dutyDate),
    eq(schema.dutyPresenceConfirmations.shiftStartsAt, input.startsAt),
    eq(schema.dutyPresenceConfirmations.shiftEndsAt, input.endsAt),
    eq(schema.dutyPresenceConfirmations.status, "pending"),
  )).returning({ id: schema.dutyPresenceConfirmations.id });
  if (changed) return { kind: "claimed", confirmationId: changed.id };

  const [existing] = await tx.select({ status: schema.dutyPresenceConfirmations.status })
    .from(schema.dutyPresenceConfirmations)
    .where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
      eq(schema.dutyPresenceConfirmations.scheduleId, input.scheduleId),
      eq(schema.dutyPresenceConfirmations.assignmentId, input.assignmentId),
      eq(schema.dutyPresenceConfirmations.brokerId, input.brokerId),
      eq(schema.dutyPresenceConfirmations.dutyDate, input.dutyDate),
      eq(schema.dutyPresenceConfirmations.shiftStartsAt, input.startsAt),
      eq(schema.dutyPresenceConfirmations.shiftEndsAt, input.endsAt),
    )).limit(1);
  return existing?.status === "confirmed" ? { kind: "already_confirmed" } : { kind: "unavailable" };
}
