import { and, eq } from "drizzle-orm";
import { effectiveAttendanceMode, getSelfDutyConfirmationWindowState } from "@/features/lead-distribution/duty-presence-domain";
import { getDatabase, schema } from "@/shared/db";
import { ConfirmPresenceView } from "./confirm-presence-view";

export const dynamic = "force-dynamic";

export default async function ConfirmPresencePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const confirmationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? "") ? id! : null;
  const [record] = confirmationId ? await getDatabase().select({
    id: schema.dutyPresenceConfirmations.id,
    assignmentId: schema.dutyPresenceConfirmations.assignmentId,
    status: schema.dutyPresenceConfirmations.status,
    brokerName: schema.user.name,
    scheduleName: schema.unitDutySchedules.name,
    branchName: schema.branches.name,
    timezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    assignmentAttendanceMode: schema.dutyRosterAssignments.attendanceMode,
    shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
    shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
    joinedAt: schema.dutyRosterAssignments.createdAt,
  }).from(schema.dutyPresenceConfirmations)
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyPresenceConfirmations.brokerId))
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyPresenceConfirmations.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .leftJoin(schema.branches, and(
      eq(schema.branches.id, schema.unitDutySchedules.branchId),
      eq(schema.branches.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .leftJoin(schema.dutyRosterAssignments, and(
      eq(schema.dutyRosterAssignments.id, schema.dutyPresenceConfirmations.assignmentId),
      eq(schema.dutyRosterAssignments.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .where(eq(schema.dutyPresenceConfirmations.id, confirmationId)).limit(1) : [];

  const now = new Date();
  const windowState = record?.status === "pending" ? getSelfDutyConfirmationWindowState({ startsAt: record.shiftStartsAt, endsAt: record.shiftEndsAt, now, joinedAt: record.joinedAt }) : null;
  const active = windowState === "available";
  const late = windowState === "late";
  const confirmed = record?.status === "confirmed";
  const presencial = record ? effectiveAttendanceMode(record.assignmentAttendanceMode, record.attendanceMode) === "presencial" : false;
  return <ConfirmPresenceView valid={Boolean(confirmationId && record)} record={record ? { id: record.id, assignmentId: record.assignmentId, brokerName: record.brokerName, scheduleName: record.scheduleName, branchName: record.branchName, timezone: record.timezone, shiftStartsAt: record.shiftStartsAt } : null} confirmed={confirmed} late={late} active={active} presencial={presencial} notOpen={windowState === "not_open"} />;
}
