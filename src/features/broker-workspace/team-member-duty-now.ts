import "server-only";

import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import type { BrokerActiveDuty } from "@/features/broker-workspace/queries";
import { loadDutyNow, type DutyNow } from "@/features/broker-workspace/duty-now";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const SAO_PAULO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** Hora de início/fim do plantão no dia de hoje (São Paulo, sem horário de verão). */
function onDay(dayKey: string, time: string) {
  return new Date(`${dayKey}T${time.slice(0, 5)}:00-03:00`);
}

/**
 * Pode o viewer ver o plantão deste corretor? Diretor: todos. Gestor: corretores da própria unidade.
 * Supervisor: corretores da própria equipe (supervisor do corretor = o viewer, na mesma unidade).
 */
async function viewerCanSeeBroker(input: { tenantId: string; viewerId: string; role: string; branchId: string | null; supervisorTeamScope: boolean | undefined; brokerId: string }) {
  if (input.role === "director") {
    // The director sees any broker of the tenant.
  } else if (input.role === "manager" && input.branchId) {
    // The gestor sees the brokers of his own unit only.
  } else if (input.role === "supervisor" && input.supervisorTeamScope && input.branchId) {
    // The supervisor sees the brokers of his own team only.
  } else {
    return false;
  }
  const [member] = await getDatabase().select({ branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, input.tenantId),
      eq(schema.tenantMemberships.userId, input.brokerId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .limit(1);
  if (!member) return false;
  if (input.role === "director") return true;
  if (member.branchId !== input.branchId) return false;
  return input.role === "manager" || member.supervisorId === input.viewerId;
}

/** Plantões que o corretor está agora: a escala publicada de hoje e a semanal válida. */
async function dutiesRunningNow(tenantId: string, brokerId: string, now: Date): Promise<BrokerActiveDuty[]> {
  const today = SAO_PAULO_DAY.format(now);
  const weekday = new Date(`${today}T12:00:00-03:00`).getUTCDay();
  const rows = await getDatabase().select({
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    pausedAt: schema.dutyRosterAssignments.pausedAt,
    scheduleName: schema.unitDutySchedules.name,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    queueName: schema.leadQueues.name,
    branchName: schema.branches.name,
  })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.unitDutySchedules.queueId), eq(schema.leadQueues.tenantId, schema.dutyRosterAssignments.tenantId)))
    .leftJoin(schema.branches, and(eq(schema.branches.id, schema.unitDutySchedules.branchId), eq(schema.branches.tenantId, schema.dutyRosterAssignments.tenantId)))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      eq(schema.dutyRosterAssignments.brokerId, brokerId),
      eq(schema.dutyRosterAssignments.status, "active"),
      or(
        eq(schema.dutyRosterAssignments.dutyDate, today),
        and(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dayOfWeek, weekday), lte(schema.dutyRosterAssignments.validFrom, now), or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now))),
      ),
    ));
  return rows
    .map((row) => ({
      scheduleId: row.scheduleId,
      scheduleName: row.scheduleName,
      queueName: row.queueName ?? null,
      branchName: row.branchName ?? null,
      dutyDate: today,
      startsAt: onDay(today, row.startsAt),
      endsAt: onDay(today, row.endsAt),
      paused: Boolean(row.pausedAt),
      presenceStatus: "not_required" as const,
      attendanceMode: row.attendanceMode,
    }))
    .filter((duty) => duty.startsAt <= now && now < duty.endsAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.scheduleId.localeCompare(b.scheduleId));
}

/**
 * The plantão of a broker of the viewer's scope, running now: the same screen the broker sees for himself.
 * denied: the broker is outside the viewer's scope. idle: no plantão running now.
 */
export async function getBrokerDutyNowForViewer(input: { brokerId: string; scheduleId?: string | null; now?: Date }): Promise<{ access: "denied" } | { access: "idle" } | { access: "ok"; duty: DutyNow }> {
  const context = await getRequiredTenantContext();
  const now = input.now ?? new Date();
  const allowed = await viewerCanSeeBroker({
    tenantId: context.tenantId,
    viewerId: context.userId,
    role: context.role,
    branchId: context.branchId ?? null,
    supervisorTeamScope: context.supervisorTeamScope,
    brokerId: input.brokerId,
  });
  if (!allowed) return { access: "denied" };
  const running = await dutiesRunningNow(context.tenantId, input.brokerId, now);
  const active = running.find((duty) => duty.scheduleId === input.scheduleId) ?? running[0];
  if (!active) return { access: "idle" };
  return { access: "ok", duty: await loadDutyNow({ tenantId: context.tenantId, brokerId: input.brokerId, now, running, active }) };
}

