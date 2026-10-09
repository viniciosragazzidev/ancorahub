/**
 * Repairs published escalas where brokers of the weekly roster were left out
 * of distribution (2026-10-09).
 *
 * Publishing skipped the dated row for assignments with origin "weekly"
 * ("they are already on duty"), but on a date that has published brokers the
 * distribution uses only the published rows and ignores the weekly roster
 * (DEC-123). Result: in a plantão mixing weekly and generated brokers, the
 * weekly ones never receive leads that day. This script creates the missing
 * dated rows for those brokers, only where they are being ignored (the
 * plantão has published brokers that date), only for shifts that have not
 * started, and only while the broker is still on the weekly roster.
 *
 * Simulation by default:
 *   npx tsx scripts/duty-backfill-weekly-origin.ts
 * Apply:
 *   npx tsx scripts/duty-backfill-weekly-origin.ts --apply
 * Options: --tenant <id>
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/shared/db/schema";
import { dayOfWeekOf, occurrenceValidity, zonedMidnight } from "../src/features/lead-distribution/monthly-duty-plan";

if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const apply = args.includes("--apply");
const tenantOption = option("--tenant");

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!databaseUrl) throw new Error("SUPABASE_DB_URL ou DATABASE_URL é obrigatório.");

type Occurrence = { id: string; scheduleId: string; dutyDate: string; startsAt: string; endsAt: string };
type Assignment = { occurrenceId: string; brokerId: string; origin?: string };

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}

function shiftStart(dutyDate: string, startsAt: string, timeZone: string) {
  const [hours, minutes] = startsAt.split(":").map(Number);
  return new Date(zonedMidnight(dutyDate, timeZone).getTime() + (hours * 60 + minutes) * 60_000);
}

async function main() {
  const client = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  const now = new Date();
  try {
    const plans = await db.select().from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.status, "published"), tenantOption ? eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantOption) : undefined));
    const inserts: Array<typeof schema.dutyRosterAssignments.$inferInsert> = [];
    // Audit and authorship go to whoever published the escala being repaired.
    const authorOf = new Map<string, string>();
    const report: string[] = [];
    const skipped: string[] = [];

    for (const plan of plans) {
      const occurrences = new Map(asArray<Occurrence>(plan.occurrences).map((occurrence) => [occurrence.id, occurrence]));
      const weekly = asArray<Assignment>(plan.assignments).filter((assignment) => assignment.origin === "weekly");
      if (!weekly.length) continue;
      const scheduleIds = [...new Set(weekly.map((assignment) => occurrences.get(assignment.occurrenceId)?.scheduleId).filter((id): id is string => Boolean(id)))];
      if (!scheduleIds.length) continue;

      const [schedules, published, weeklyRows, users] = await Promise.all([
        db.select({ id: schema.unitDutySchedules.id, name: schema.unitDutySchedules.name, status: schema.unitDutySchedules.status, timezone: schema.unitDutySchedules.timezone })
          .from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, plan.tenantId), inArray(schema.unitDutySchedules.id, scheduleIds))),
        db.select({ scheduleId: schema.dutyRosterAssignments.scheduleId, dutyDate: schema.dutyRosterAssignments.dutyDate, brokerId: schema.dutyRosterAssignments.brokerId })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, plan.tenantId), inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds), eq(schema.dutyRosterAssignments.status, "active"), isNotNull(schema.dutyRosterAssignments.monthlyPlanId))),
        db.select({ scheduleId: schema.dutyRosterAssignments.scheduleId, brokerId: schema.dutyRosterAssignments.brokerId, branchId: schema.dutyRosterAssignments.branchId, dayOfWeek: schema.dutyRosterAssignments.dayOfWeek, validFrom: schema.dutyRosterAssignments.validFrom, validUntil: schema.dutyRosterAssignments.validUntil })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, plan.tenantId), inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds), eq(schema.dutyRosterAssignments.status, "active"), isNull(schema.dutyRosterAssignments.dutyDate))),
        db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, [...new Set(weekly.map((assignment) => assignment.brokerId))])),
      ]);
      const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
      const nameOf = new Map(users.map((user) => [user.id, user.name]));
      const publishedDates = new Set(published.map((row) => `${row.scheduleId}:${row.dutyDate}`));
      const publishedBroker = new Set(published.map((row) => `${row.scheduleId}:${row.dutyDate}|${row.brokerId}`));

      for (const assignment of weekly) {
        const occurrence = occurrences.get(assignment.occurrenceId);
        if (!occurrence) continue;
        const schedule = scheduleById.get(occurrence.scheduleId);
        const label = `${occurrence.dutyDate} ${schedule?.name ?? occurrence.scheduleId} · ${nameOf.get(assignment.brokerId) ?? assignment.brokerId}`;
        if (!schedule || schedule.status !== "active") { skipped.push(`${label}: plantão inativo`); continue; }
        // Only where the broker is being ignored: the plantão has published brokers that date.
        if (!publishedDates.has(`${occurrence.scheduleId}:${occurrence.dutyDate}`)) continue;
        if (publishedBroker.has(`${occurrence.scheduleId}:${occurrence.dutyDate}|${assignment.brokerId}`)) continue;
        if (shiftStart(occurrence.dutyDate, occurrence.startsAt, schedule.timezone).getTime() <= now.getTime()) { skipped.push(`${label}: plantão já começou, não mexo`); continue; }
        const dateStart = zonedMidnight(occurrence.dutyDate, schedule.timezone);
        const weeklyRow = weeklyRows.find((row) => row.scheduleId === occurrence.scheduleId && row.brokerId === assignment.brokerId
          && row.dayOfWeek === dayOfWeekOf(occurrence.dutyDate) && row.validFrom.getTime() <= dateStart.getTime()
          && (!row.validUntil || row.validUntil.getTime() > dateStart.getTime()));
        if (!weeklyRow) { skipped.push(`${label}: saiu da escala semanal depois da publicação`); continue; }
        const validity = occurrenceValidity(occurrence.dutyDate, schedule.timezone);
        inserts.push({
          id: randomUUID(),
          tenantId: plan.tenantId,
          branchId: weeklyRow.branchId,
          scheduleId: occurrence.scheduleId,
          brokerId: assignment.brokerId,
          dayOfWeek: dayOfWeekOf(occurrence.dutyDate),
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          validFrom: validity.validFrom,
          validUntil: validity.validUntil,
          dutyDate: occurrence.dutyDate,
          monthlyPlanId: plan.id,
          status: "active",
          createdBy: plan.publishedBy ?? plan.generatedBy,
          updatedBy: plan.publishedBy ?? plan.generatedBy,
          createdAt: now,
          updatedAt: now,
        });
        authorOf.set(inserts.at(-1)!.id!, plan.publishedBy ?? plan.generatedBy);
        publishedBroker.add(`${occurrence.scheduleId}:${occurrence.dutyDate}|${assignment.brokerId}`);
        report.push(`${label} (${occurrence.startsAt}-${occurrence.endsAt}) · escala ${plan.monthKey} rev ${plan.revision}`);
      }
    }

    console.log(apply ? "APLICANDO" : "SIMULAÇÃO (nada é gravado; use --apply para gravar)");
    console.log(`\nCorretores da escala semanal que estavam fora da distribuição e voltam: ${report.length}`);
    for (const line of report.sort()) console.log(`  + ${line}`);
    if (skipped.length) {
      console.log(`\nNão mexidos: ${skipped.length}`);
      for (const line of skipped.sort()) console.log(`  - ${line}`);
    }
    if (!apply || !inserts.length) return;
    await db.transaction(async (tx) => {
      await tx.insert(schema.dutyRosterAssignments).values(inserts);
      await tx.insert(schema.auditLogs).values(inserts.map((row) => ({ id: randomUUID(), userId: authorOf.get(row.id!)!, entidade: "duty_roster_assignment", entidadeId: row.id!, acao: "duty_roster_assignment.backfill_weekly_origin" })));
    });
    console.log(`\nGravado: ${inserts.length} linhas.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
