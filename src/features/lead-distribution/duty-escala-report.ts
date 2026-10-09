import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { parsePlanSettings, type MonthlyPlanOccurrence } from "./monthly-duty-plan";
import type { DutyEscalaPdfInput, DutyEscalaPdfOccurrence, DutyEscalaPdfType } from "./duty-escala-pdf";

type Db = ReturnType<typeof getDatabase>;
type Plan = { id: string; monthKey: string; status: string; settings: unknown; occurrences: unknown; assignments: unknown };
type Assignment = { occurrenceId: string; brokerId: string };
type Broker = { id: string; name: string; code: string | null; branchId: string | null; branchName: string | null };
type Schedule = { id: string; typeId: string | null; attendanceMode: string };
type ReportType = DutyEscalaPdfType;
export type DutyEscalaScope =
  | { kind: "geral" }
  | { kind: "unidade"; branchId: string; branchName: string }
  | { kind: "tipo"; typeId: string | null; typeName: string };

export type DutyEscalaReportData = {
  plan: Plan;
  tenant: { name: string; logoUrl: string | null };
  occurrences: MonthlyPlanOccurrence[];
  assignments: Assignment[];
  brokers: Broker[];
  schedules: Schedule[];
  types: ReportType[];
  scope: DutyEscalaScope;
};

export async function resolveDutyEscalaScope(
  db: Db,
  tenantId: string,
  selection: { kind: "geral" } | { kind: "unidade"; branchId: string } | { kind: "tipo"; typeId: string | null },
): Promise<DutyEscalaScope | null> {
  if (selection.kind === "geral") return selection;
  if (selection.kind === "unidade") {
    const [branch] = await db.select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, selection.branchId), eq(schema.branches.tenantId, tenantId)))
      .limit(1);
    return branch ? { kind: "unidade", branchId: branch.id, branchName: branch.name } : null;
  }
  if (selection.typeId === null) return { kind: "tipo", typeId: null, typeName: "Sem tipo" };
  const [type] = await db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name })
    .from(schema.dutyScheduleTypes)
    .where(and(eq(schema.dutyScheduleTypes.id, selection.typeId), eq(schema.dutyScheduleTypes.tenantId, tenantId)))
    .limit(1);
  return type ? { kind: "tipo", typeId: type.id, typeName: type.name } : null;
}

export async function getDutyEscalaReportData(
  db: Db,
  tenantId: string,
  planId: string,
  scope: DutyEscalaScope,
): Promise<DutyEscalaReportData | null> {
  const [plan] = await db.select({
    id: schema.dutyScheduleMonthlyPlans.id,
    monthKey: schema.dutyScheduleMonthlyPlans.monthKey,
    status: schema.dutyScheduleMonthlyPlans.status,
    settings: schema.dutyScheduleMonthlyPlans.settings,
    occurrences: schema.dutyScheduleMonthlyPlans.occurrences,
    assignments: schema.dutyScheduleMonthlyPlans.assignments,
  }).from(schema.dutyScheduleMonthlyPlans)
    .where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantId)))
    .limit(1);
  if (!plan) return null;

  const planOccurrences = Array.isArray(plan.occurrences) ? plan.occurrences as MonthlyPlanOccurrence[] : [];
  const assignments = (Array.isArray(plan.assignments) ? plan.assignments : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<Assignment>;
    return typeof row.occurrenceId === "string" && typeof row.brokerId === "string"
      ? [{ occurrenceId: row.occurrenceId, brokerId: row.brokerId }]
      : [];
  });
  const brokerIds = [...new Set(assignments.map((item) => item.brokerId))];
  const scheduleIds = [...new Set(planOccurrences.map((item) => item.scheduleId).filter((id): id is string => typeof id === "string"))];
  const [tenantRow, types, schedules, people] = await Promise.all([
    db.select({ name: schema.tenants.name, logoUrl: schema.tenants.logoUrl }).from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId)).limit(1),
    db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name, hue: schema.dutyScheduleTypes.colorHue, modality: schema.dutyScheduleTypes.attendanceMode })
      .from(schema.dutyScheduleTypes).where(eq(schema.dutyScheduleTypes.tenantId, tenantId)),
    scheduleIds.length
      ? db.select({ id: schema.unitDutySchedules.id, typeId: schema.unitDutySchedules.typeId, attendanceMode: schema.unitDutySchedules.attendanceMode })
        .from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, tenantId), inArray(schema.unitDutySchedules.id, scheduleIds)))
      : Promise.resolve([]),
    brokerIds.length
      ? db.select({ id: schema.user.id, name: schema.user.name, code: schema.brokerProfiles.internalCode, branchId: schema.tenantMemberships.branchId, branchName: schema.branches.name })
        .from(schema.user)
        .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, tenantId)))
        .leftJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, tenantId)))
        .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, tenantId)))
        .where(inArray(schema.user.id, brokerIds))
      : Promise.resolve([]),
  ]);
  return {
    plan,
    tenant: { name: tenantRow[0]?.name ?? "AncoraHub", logoUrl: tenantRow[0]?.logoUrl ?? null },
    occurrences: planOccurrences,
    assignments,
    brokers: people.map((person) => ({ id: person.id, name: person.name ?? "Corretor", code: person.code, branchId: person.branchId, branchName: person.branchName })),
    schedules,
    types: types.map((type) => ({ id: type.id, name: type.name, hue: type.hue, modality: type.modality === "presencial" ? "presencial" : "online" })),
    scope,
  };
}

function dateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function periodLabel(data: DutyEscalaReportData) {
  const settings = parsePlanSettings(data.plan.settings);
  const dates = data.occurrences.map((item) => item.dutyDate).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const from = settings?.rangeFrom ?? dates[0] ?? `${data.plan.monthKey}-01`;
  const until = settings?.rangeUntil ?? dates.at(-1) ?? `${data.plan.monthKey}-${String(new Date(Date.UTC(Number(data.plan.monthKey.slice(0, 4)), Number(data.plan.monthKey.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
  return `${dateLabel(from)} a ${dateLabel(until)}`;
}

/** Pure projection and scope filter; terminated occurrences remain part of the plan snapshot. */
export function buildDutyEscalaPdfInput(data: DutyEscalaReportData): DutyEscalaPdfInput {
  const scheduleById = new Map(data.schedules.map((item) => [item.id, item]));
  const typeById = new Map(data.types.map((item) => [item.id, item]));
  const brokerById = new Map(data.brokers.map((item) => [item.id, item]));
  const assignmentsByOccurrence = new Map<string, string[]>();
  for (const assignment of data.assignments) assignmentsByOccurrence.set(assignment.occurrenceId, [...(assignmentsByOccurrence.get(assignment.occurrenceId) ?? []), assignment.brokerId]);

  const occurrences: DutyEscalaPdfOccurrence[] = [];
  for (const occurrence of data.occurrences) {
    const schedule = scheduleById.get(occurrence.scheduleId);
    const storedTypeId = occurrence.typeId ?? schedule?.typeId ?? null;
    const typeId = storedTypeId && typeById.has(storedTypeId) ? storedTypeId : null;
    if (data.scope.kind === "tipo" && typeId !== data.scope.typeId) continue;
    const assignedBrokers = [...new Set(assignmentsByOccurrence.get(occurrence.id) ?? [])]
      .map((id) => brokerById.get(id)).filter((broker): broker is Broker => Boolean(broker));
    const unitScope = data.scope.kind === "unidade" ? data.scope : null;
    const visibleBrokers = unitScope
      ? assignedBrokers.filter((broker) => broker.branchId === unitScope.branchId)
      : assignedBrokers;
    if (unitScope && visibleBrokers.length === 0) continue;
    const type = typeId ? typeById.get(typeId) : undefined;
    const modality = occurrence.attendanceMode === "presencial" || occurrence.attendanceMode === "online"
      ? occurrence.attendanceMode
      : type?.modality ?? (schedule?.attendanceMode === "presencial" ? "presencial" : "online");
    occurrences.push({
      id: occurrence.id,
      typeId,
      scheduleName: occurrence.scheduleName,
      dutyDate: occurrence.dutyDate,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      modality,
      // One unit only shows part of the plantão: its minimum is the whole company's, so no "faltam" there.
      minimumBrokers: unitScope ? 0 : occurrence.minimumBrokers,
      brokers: visibleBrokers.map((broker) => ({ name: broker.name, code: broker.code, branchName: broker.branchName })),
    });
  }
  const scopeLabel = data.scope.kind === "geral" ? "Geral"
    : data.scope.kind === "unidade" ? `Unidade ${data.scope.branchName}`
      : `Tipo ${data.scope.typeName}`;
  return {
    tenantName: data.tenant.name,
    tenantLogoUrl: data.tenant.logoUrl,
    periodLabel: periodLabel(data),
    scopeLabel,
    status: data.plan.status === "draft" ? "draft" : "published",
    showBranch: data.scope.kind !== "unidade",
    types: data.types,
    occurrences,
  };
}
