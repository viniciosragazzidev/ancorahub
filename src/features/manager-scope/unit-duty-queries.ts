import "server-only";

import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { buildUnitDutyOccurrences, unitDutyDays, type UnitDutyOccurrence } from "./unit-duty-domain";
import { getUnitBrokerIds } from "./unit-brokers";

export const UNIT_DUTY_DAYS = 8;

/**
 * Plantões de hoje e dos próximos 7 dias em que há corretor da unidade do gestor, só com esses corretores.
 * Gestor sem unidade (ou outro papel): nada.
 */
export async function getManagerUnitDuties(context: TenantContext, now = new Date()): Promise<{ days: string[]; occurrences: UnitDutyOccurrence[] }> {
  const days = unitDutyDays(now, UNIT_DUTY_DAYS);
  if (context.role !== "manager" || !context.branchId) return { days, occurrences: [] };
  const brokerIds = await getUnitBrokerIds(context.tenantId, context.branchId);
  if (!brokerIds.length) return { days, occurrences: [] };
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const rows = await getDatabase()
    .select({
      scheduleId: schema.unitDutySchedules.id,
      scheduleName: schema.unitDutySchedules.name,
      scheduleValidFrom: schema.unitDutySchedules.validFrom,
      scheduleValidUntil: schema.unitDutySchedules.validUntil,
      brokerId: schema.dutyRosterAssignments.brokerId,
      brokerName: schema.user.name,
      dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      validFrom: schema.dutyRosterAssignments.validFrom,
      validUntil: schema.dutyRosterAssignments.validUntil,
      pausedAt: schema.dutyRosterAssignments.pausedAt,
    })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
      eq(schema.dutyRosterAssignments.status, "active"),
      eq(schema.unitDutySchedules.status, "active"),
      inArray(schema.dutyRosterAssignments.brokerId, brokerIds),
      or(
        isNull(schema.dutyRosterAssignments.dutyDate),
        and(gte(schema.dutyRosterAssignments.dutyDate, first), lte(schema.dutyRosterAssignments.dutyDate, last)),
      ),
    ));
  return { days, occurrences: buildUnitDutyOccurrences(rows, new Set(brokerIds), days) };
}
