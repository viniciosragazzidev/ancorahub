/**
 * Diagnóstico temporário: corretores, perfis, plantões e elegibilidade do motor.
 * Remover após uso.
 */
import { loadEnvConfig } from "@next/env";
import { and, eq, inArray, isNull, or, isNotNull, lte, gt } from "drizzle-orm";
import { getDatabase, schema } from "../src/shared/db/client";

function getLocalDutyParts(date: Date) {
  // America/Sao_Paulo via Intl (mesma semântica de src/features/leads/assignment)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[parts.weekday ?? "Sun"] ?? 0;
  const time = `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}`;
  return { weekday, time };
}

async function main() {
  const db = getDatabase();
  const tenantId = "d47a4d41-4e45-450d-a0b8-a9e1be286903";

  const members = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      active: schema.user.active,
      userStatus: schema.user.status,
      branchId: schema.tenantMemberships.branchId,
      role: schema.tenantMemberships.role,
      jobTitle: schema.tenantMemberships.jobTitle,
      availability: schema.tenantMemberships.availabilityStatus,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        inArray(schema.tenantMemberships.role, ["broker", "director", "manager"]),
        eq(schema.tenantMemberships.status, "active"),
      ),
    )
    .limit(50);
  console.log("== MEMBROS ==");
  for (const m of members) {
    console.log(
      ` ${m.role.padEnd(8)} ${(m.name ?? "?").padEnd(22)} branch=${(m.branchId ?? "null").slice(0, 8)} avail=${m.availability} userActive=${m.active}/${m.userStatus} id=${m.id.slice(0, 8)}`,
    );
  }

  const profiles = await db
    .select({ userId: schema.brokerProfiles.userId, phone: schema.brokerProfiles.phone })
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.tenantId, tenantId))
    .limit(50);
  console.log("\n== BROKER PROFILES (canal) ==");
  for (const p of profiles) console.log(` user=${p.userId.slice(0, 8)} phone=${p.phone ? "ok" : "NULL"}`);

  const now = new Date();
  const local = getLocalDutyParts(now);
  console.log(`\n== AGORA == weekday=${local.weekday} time=${local.time}`);

  const schedules = await db
    .select({
      id: schema.unitDutySchedules.id,
      name: schema.unitDutySchedules.name,
      branchId: schema.unitDutySchedules.branchId,
      weekday: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
    })
    .from(schema.unitDutySchedules)
    .where(
      and(
        eq(schema.unitDutySchedules.tenantId, tenantId),
        eq(schema.unitDutySchedules.status, "active"),
        lte(schema.unitDutySchedules.startsAt, local.time),
        gt(schema.unitDutySchedules.endsAt, local.time),
        or(
          isNull(schema.unitDutySchedules.validUntil),
          gt(schema.unitDutySchedules.validUntil, now),
        ),
      ),
    )
    .limit(30);
  console.log("== ESCALAS ATIVAS NESTE HORÁRIO ==");
  for (const s of schedules)
    console.log(
      ` ${(s.name ?? "?").padEnd(24)} branch=${(s.branchId ?? "null").slice(0, 8)} day=${s.weekday} ${s.startsAt}-${s.endsAt} cred=${s.webhookCredentialId ? s.webhookCredentialId.slice(0, 6) : "null"} id=${s.id.slice(0, 8)}`,
    );

  const activeScheduleIds = schedules.map((s) => s.id);
  if (activeScheduleIds.length) {
    const assignments = await db
      .select({
        scheduleId: schema.dutyRosterAssignments.scheduleId,
        brokerId: schema.dutyRosterAssignments.brokerId,
        weekday: schema.dutyRosterAssignments.dayOfWeek,
        startsAt: schema.dutyRosterAssignments.startsAt,
        endsAt: schema.dutyRosterAssignments.endsAt,
      })
      .from(schema.dutyRosterAssignments)
      .where(
        and(
          eq(schema.dutyRosterAssignments.tenantId, tenantId),
          eq(schema.dutyRosterAssignments.status, "active"),
          inArray(schema.dutyRosterAssignments.scheduleId, activeScheduleIds),
        ),
      )
      .limit(40);
    console.log("== PLANTONISTAS NAS ESCALAS ACIMA ==");
    for (const a of assignments)
      console.log(` sched=${a.scheduleId.slice(0, 8)} broker=${a.brokerId.slice(0, 8)} day=${a.weekday} ${a.startsAt}-${a.endsAt}`);
  }

  const failed = await db
    .select({
      id: schema.leadDistributionJobs.id,
      lastErrorCode: schema.leadDistributionJobs.lastErrorCode,
      lastErrorMessage: schema.leadDistributionJobs.lastErrorMessage,
      attemptCount: schema.leadDistributionJobs.attemptCount,
      maxAttempts: schema.leadDistributionJobs.maxAttempts,
    })
    .from(schema.leadDistributionJobs)
    .where(
      and(
        eq(schema.leadDistributionJobs.tenantId, tenantId),
        eq(schema.leadDistributionJobs.status, "failed"),
        isNotNull(schema.leadDistributionJobs.lastErrorCode),
      ),
    )
    .limit(2);
  console.log("\n== AMOSTRA DE FALHAS ==");
  for (const f of failed) {
    console.log(` ${f.lastErrorCode} attempt=${f.attemptCount}/${f.maxAttempts}`);
    console.log(`   ${(f.lastErrorMessage ?? "").slice(0, 400)}`);
  }

  const queued = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      status: schema.leads.status,
      qualState: schema.leads.qualificationState,
      qualStatus: schema.leads.qualificationStatus,
      branchId: schema.leads.branchId,
      distributionUpdatedAt: schema.leads.distributionUpdatedAt,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.distributionStatus, "queued"),
        isNull(schema.leads.corretorId),
        isNull(schema.leads.deletedAt),
      ),
    )
    .limit(12);
  console.log("\n== LEADS queued SEM CORRETOR (amostra) ==");
  for (const l of queued)
    console.log(
      ` ${(l.nome ?? "?").slice(0, 24).padEnd(24)} branch=${(l.branchId ?? "null").slice(0, 8)} status=${l.status} qual=${l.qualState ?? l.qualStatus ?? "-"} updatedAt=${l.distributionUpdatedAt?.toISOString().slice(0, 16) ?? "-"} id=${l.id.slice(0, 8)}`,
    );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
