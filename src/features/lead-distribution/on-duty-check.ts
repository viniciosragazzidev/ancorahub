"use server";

import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getAuth } from "@/shared/auth";
import { headers } from "next/headers";

function getBrazilDutyParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find((part) => part.type === "weekday")?.value as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"] ?? 0;
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return { weekday, time: `${hour === "24" ? "00" : hour}:${minute}` };
}

async function checkBrokerOnDuty(tenantId: string, branchId: string, userId: string): Promise<boolean> {
  const db = getDatabase();
  const local = getBrazilDutyParts(new Date());

  const activeSchedules = await db.select({ id: schema.unitDutySchedules.id })
    .from(schema.unitDutySchedules)
    .where(and(
      eq(schema.unitDutySchedules.tenantId, tenantId),
      eq(schema.unitDutySchedules.branchId, branchId),
      eq(schema.unitDutySchedules.dayOfWeek, local.weekday),
      eq(schema.unitDutySchedules.status, "active"),
      lte(schema.unitDutySchedules.startsAt, local.time),
      gt(schema.unitDutySchedules.endsAt, local.time),
      lte(schema.unitDutySchedules.validFrom, new Date()),
      or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, new Date())),
    ));

  if (!activeSchedules.length) return false;

  const scheduleIds = activeSchedules.map((s) => s.id);

  const [assignment] = await db.select({ id: schema.dutyRosterAssignments.id })
    .from(schema.dutyRosterAssignments)
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      eq(schema.dutyRosterAssignments.branchId, branchId),
      eq(schema.dutyRosterAssignments.brokerId, userId),
      eq(schema.dutyRosterAssignments.status, "active"),
      lte(schema.dutyRosterAssignments.startsAt, local.time),
      gt(schema.dutyRosterAssignments.endsAt, local.time),
      lte(schema.dutyRosterAssignments.validFrom, new Date()),
      or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, new Date())),
      inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds),
    ))
    .limit(1);

  return !!assignment;
}

export async function isCurrentUserOnDuty(): Promise<boolean> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session) return false;

  const [membership] = await getDatabase()
    .select({
      tenantId: schema.tenantMemberships.tenantId,
      role: schema.tenantMemberships.role,
      branchId: schema.tenantMemberships.branchId,
    })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  if (!membership || !membership.branchId) return false;

  if (membership.role === "director" || membership.role === "manager") return true;

  if (membership.role !== "broker") return false;

  return checkBrokerOnDuty(membership.tenantId, membership.branchId, session.user.id);
}
