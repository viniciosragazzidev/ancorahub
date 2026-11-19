import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, or } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type SelfDutyPresenceAnswer = {
  status: "pending" | "confirmed";
  confirmedAt: Date | null;
  confirmedBy: string | null;
  photoStorageKey: string | null;
  photoTakenAt: Date | null;
  updatedAt: Date;
};

export async function saveOwnDutyPresenceAnswer(tx: DatabaseExecutor, input: {
  tenantId: string;
  scheduleId: string;
  assignmentId: string;
  brokerId: string;
  dutyDate: string;
  startsAt: Date;
  endsAt: Date;
  now: Date;
  answer: SelfDutyPresenceAnswer;
}): Promise<{ kind: "saved"; confirmationId: string } | { kind: "already_confirmed"; confirmationId: string; confirmedBy: string | null } | { kind: "absent" } | { kind: "unavailable" }> {
  const [row] = await tx.insert(schema.dutyPresenceConfirmations).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    scheduleId: input.scheduleId,
    assignmentId: input.assignmentId,
    brokerId: input.brokerId,
    dutyDate: input.dutyDate,
    shiftStartsAt: input.startsAt,
    shiftEndsAt: input.endsAt,
    notificationStatus: "sent",
    createdAt: input.now,
    ...input.answer,
  }).onConflictDoUpdate({
    target: [schema.dutyPresenceConfirmations.tenantId, schema.dutyPresenceConfirmations.assignmentId, schema.dutyPresenceConfirmations.dutyDate, schema.dutyPresenceConfirmations.shiftStartsAt, schema.dutyPresenceConfirmations.shiftEndsAt],
    set: input.answer,
    // A presencial photo replaces the broker's app confirmation (confirmedBy IS NULL),
    // but never an absence or a confirmation already validated by another actor.
    setWhere: and(
      ne(schema.dutyPresenceConfirmations.status, "absent"),
      input.answer.status === "pending"
        ? or(ne(schema.dutyPresenceConfirmations.status, "confirmed"), isNull(schema.dutyPresenceConfirmations.confirmedBy))
        : ne(schema.dutyPresenceConfirmations.status, "confirmed"),
    ),
  }).returning({ id: schema.dutyPresenceConfirmations.id });
  if (row) return { kind: "saved", confirmationId: row.id };

  const [existing] = await tx.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status, confirmedBy: schema.dutyPresenceConfirmations.confirmedBy })
    .from(schema.dutyPresenceConfirmations).where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
      eq(schema.dutyPresenceConfirmations.assignmentId, input.assignmentId),
      eq(schema.dutyPresenceConfirmations.dutyDate, input.dutyDate),
      eq(schema.dutyPresenceConfirmations.shiftStartsAt, input.startsAt),
      eq(schema.dutyPresenceConfirmations.shiftEndsAt, input.endsAt),
    )).limit(1);
  if (existing?.status === "confirmed") return { kind: "already_confirmed", confirmationId: existing.id, confirmedBy: existing.confirmedBy };
  return existing?.status === "absent" ? { kind: "absent" } : { kind: "unavailable" };
}
