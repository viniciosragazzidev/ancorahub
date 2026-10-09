/**
 * Imports an escala spreadsheet (the Âncora PME sheet: "Dias" header with one
 * date per column, "<code> - <name>" per broker below) into the CRM:
 *
 * 1. Dates that already passed are ignored.
 * 2. Every remaining date without a plantão of the type gets one, copied from
 *    the most recent plantão of that type (hours, coverage, queues, origin).
 * 3. A DRAFT escala of the month is created with the brokers of the sheet
 *    (found by their code). Nothing is published: the Diretor reviews it in
 *    Plantões -> Escala and publishes it there, as any escala.
 *
 * Simulation by default (reads, prints, writes nothing):
 *   npx tsx scripts/import-duty-escala.ts "C:/caminho/PME vendas Setembro.xls"
 * Apply:
 *   npx tsx scripts/import-duty-escala.ts "C:/caminho/PME vendas Setembro.xls" --apply
 * Options: --sheet Planilha1 (default) · --type PME (default) · --tenant <id>
 *          --user <email do diretor> · --name-prefix "PME" (name of new plantões)
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as XLSX from "xlsx";

import * as schema from "../src/shared/db/schema";
import { normalizeBrokerCode, parseEscalaSheet, seatsByBroker } from "../src/features/lead-distribution/duty-escala-import";
import {
  buildRangeOccurrences,
  dayOfWeekOf,
  isValidOn,
  localDateKey,
  occurrenceValidity,
  parsePlanSettings,
  shiftEnd,
  typeKeyOf,
  type MonthlyPlanAssignment,
  type MonthlyPlanOccurrence,
  type MonthlyPlanSchedule,
  type PlanSettings,
} from "../src/features/lead-distribution/monthly-duty-plan";

if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const VALUE_OPTIONS = new Set(["--sheet", "--type", "--tenant", "--user", "--name-prefix"]);
const file = args.find((arg, index) => !arg.startsWith("--") && !VALUE_OPTIONS.has(args[index - 1] ?? ""));
const apply = args.includes("--apply");
const sheetName = option("--sheet") ?? "Planilha1";
const typeName = option("--type") ?? "PME";
const namePrefix = option("--name-prefix") ?? typeName;
const TZ = "America/Sao_Paulo";

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!file) throw new Error("Informe o caminho da planilha.");
if (!databaseUrl) throw new Error("SUPABASE_DB_URL ou DATABASE_URL é obrigatório.");

type StoredAssignment = MonthlyPlanAssignment & { rosterAssignmentId?: string };
const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);
const short = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

async function main() {
  // ---------- spreadsheet
  const book = XLSX.readFile(file!);
  const sheet = book.Sheets[sheetName];
  if (!sheet) throw new Error(`A aba "${sheetName}" não existe. Abas: ${book.SheetNames.join(", ")}`);
  const parsed = parseEscalaSheet(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][]);

  const client = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  try {
    const now = new Date();
    const today = localDateKey(now, TZ);

    // ---------- tenant + type
    const typeRows = await db.select().from(schema.dutyScheduleTypes)
      .where(and(sql`lower(${schema.dutyScheduleTypes.name}) = lower(${typeName})`, eq(schema.dutyScheduleTypes.status, "active")));
    const tenantOption = option("--tenant");
    const candidates = tenantOption ? typeRows.filter((row) => row.tenantId === tenantOption) : typeRows;
    if (!candidates.length) throw new Error(`Não achei o tipo de plantão "${typeName}"${tenantOption ? " nesta empresa" : ""}. Crie o tipo antes.`);
    const allCodes = new Set(parsed.days.flatMap((day) => day.brokers.map((broker) => broker.code)));
    const brokersOf = async (tenantId: string) => db.select({
      id: schema.user.id, name: schema.user.name, email: schema.user.email, code: schema.brokerProfiles.internalCode, branchId: schema.tenantMemberships.branchId,
    }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, tenantId)))
      .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")));
    let chosen: { type: (typeof candidates)[number]; brokers: Awaited<ReturnType<typeof brokersOf>> } | null = null;
    for (const type of candidates) {
      const brokers = await brokersOf(type.tenantId);
      const hits = brokers.filter((broker) => allCodes.has(normalizeBrokerCode(broker.code))).length;
      const best = chosen ? chosen.brokers.filter((broker) => allCodes.has(normalizeBrokerCode(broker.code))).length : -1;
      if (hits > best) chosen = { type, brokers };
    }
    const { type, brokers } = chosen!;
    const tenantId = type.tenantId;
    const brokerByCode = new Map(brokers.filter((broker) => broker.code).map((broker) => [normalizeBrokerCode(broker.code), broker]));

    // ---------- actor (who creates the plantões and the draft)
    const userEmail = option("--user");
    const [actor] = await db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active"), userEmail ? eq(schema.user.email, userEmail) : undefined))
      .limit(1);
    if (!actor) throw new Error(userEmail ? `Nenhum Diretor ativo com o e-mail ${userEmail}.` : "Nenhum Diretor ativo nesta empresa.");

    // ---------- plantões of the type
    const scheduleRows = await db.select().from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), eq(schema.unitDutySchedules.typeId, type.id), eq(schema.unitDutySchedules.status, "active")));
    if (!scheduleRows.length) throw new Error(`Não há nenhum plantão ativo do tipo ${type.name} para servir de modelo.`);
    const template = [...scheduleRows].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];
    const templateQueues = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, ids: schema.leadQueues.exclusiveDutyScheduleIds, single: schema.leadQueues.exclusiveDutyScheduleId })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, tenantId), sql`(${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([template.id])}::jsonb OR ${schema.leadQueues.exclusiveDutyScheduleId} = ${template.id})`));
    const typeBranchIds = Array.isArray(type.branchIds) ? type.branchIds : [];
    const asPlanSchedule = (row: typeof scheduleRows[number]): MonthlyPlanSchedule => ({
      id: row.id, name: row.name, branchId: row.branchId, dayOfWeek: row.dayOfWeek, startsAt: row.startsAt, endsAt: row.endsAt,
      minimumBrokers: row.minimumBrokers, maximumBrokers: row.maximumBrokers, timezone: row.timezone, validFrom: row.validFrom, validUntil: row.validUntil,
      typeId: row.typeId, attendanceMode: row.attendanceMode, typeBranchIds,
    });
    const existing = scheduleRows.map(asPlanSchedule);

    // ---------- per date: past / existing plantão / to create
    type Plan = { date: string; scheduleIds: string[]; create: boolean; codes: string[] };
    const plans: Plan[] = [];
    const skipped: string[] = [];
    for (const day of parsed.days) {
      if (!day.brokers.length) continue;
      const onDate = existing.filter((schedule) => schedule.dayOfWeek === dayOfWeekOf(day.date) && isValidOn(schedule, day.date));
      const end = shiftEnd(onDate[0] ?? { startsAt: template.startsAt, endsAt: template.endsAt, timezone: template.timezone }, day.date);
      if (day.date < today || end.getTime() <= now.getTime()) { skipped.push(day.date); continue; }
      plans.push({ date: day.date, scheduleIds: onDate.map((schedule) => schedule.id), create: onDate.length === 0, codes: day.brokers.map((broker) => broker.code) });
    }
    const unknownCodes = [...new Set(plans.flatMap((plan) => plan.codes))].filter((code) => !brokerByCode.has(code));
    const nameOfCode = new Map(parsed.days.flatMap((day) => day.brokers.map((broker) => [broker.code, broker.name] as const)));

    // ---------- report
    console.log(`Planilha: ${parsed.days.length} datas na aba "${sheetName}". Empresa: ${tenantId}. Tipo: ${type.name}. Diretor: ${actor.name} <${actor.email}>.`);
    console.log(`Modelo dos plantões novos: "${template.name}" ${template.startsAt.slice(0, 5)}–${template.endsAt.slice(0, 5)}, ${template.attendanceMode}, mín. ${template.minimumBrokers}${template.maximumBrokers ? `, máx. ${template.maximumBrokers}` : ""}, filas: ${templateQueues.map((queue) => queue.name).join(", ") || "nenhuma"}.`);
    if (skipped.length) console.log(`Ignoradas (já passaram): ${skipped.map(short).join(", ")}`);
    console.log(`\nDatas a importar: ${plans.length}`);
    for (const plan of plans) {
      const found = plan.codes.filter((code) => brokerByCode.has(code)).length;
      console.log(`  ${short(plan.date)} ${plan.create ? "CRIAR plantão" : `já existe (${plan.scheduleIds.length})`} · ${found}/${plan.codes.length} corretores: ${plan.codes.map((code) => `${code}${brokerByCode.has(code) ? "" : "?"}`).join(", ")}`);
    }
    const toCreate = plans.filter((plan) => plan.create);
    console.log(`\nPlantões a criar: ${toCreate.length}${toCreate.length ? ` (${toCreate.map((plan) => short(plan.date)).join(", ")})` : ""}`);
    if (unknownCodes.length) {
      console.log(`Corretores da planilha não encontrados pelo código (ficam de fora): ${unknownCodes.length}`);
      for (const code of unknownCodes) console.log(`  ? ${code} - ${nameOfCode.get(code) ?? ""}`);
    }
    if (parsed.unreadable.length) {
      console.log(`Células que não são "código - nome" (ignoradas): ${parsed.unreadable.length}`);
      for (const cell of parsed.unreadable.slice(0, 20)) console.log(`  · ${short(cell.date)}: ${cell.text}`);
    }
    const futureSeats = seatsByBroker(parsed.days.filter((day) => plans.some((plan) => plan.date === day.date)));
    console.log(`\nCadeiras por corretor (datas futuras): ${[...futureSeats].map(([code, seats]) => `${nameOfCode.get(code)?.split(" ")[0] ?? code} ${seats}`).join(" · ")}`);
    if (!plans.length) { console.log("\nNada a importar."); return; }
    if (!apply) {
      console.log("\nSimulação: nada foi gravado. Rode com --apply para criar os plantões e a escala em rascunho.");
      return;
    }

    // ---------- apply
    const monthKey = plans[0].date.slice(0, 7);
    const rangeFrom = plans[0].date;
    const rangeUntil = plans.at(-1)!.date;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}), hashtext('duty-plan'))`);
      const stamp = new Date();
      // 1) Missing plantões, copied from the template.
      const created: MonthlyPlanSchedule[] = [];
      for (const plan of toCreate) {
        const id = randomUUID();
        const validity = occurrenceValidity(plan.date, template.timezone);
        await tx.insert(schema.unitDutySchedules).values({
          id, tenantId, branchId: null, queueId: null,
          name: `${namePrefix} ${short(plan.date)}`,
          typeId: type.id, dayOfWeek: dayOfWeekOf(plan.date), startsAt: template.startsAt, endsAt: template.endsAt,
          priority: template.priority, minimumBrokers: template.minimumBrokers, maximumBrokers: template.maximumBrokers,
          maxLeadsPerBroker: template.maxLeadsPerBroker, shiftSplitAt: null, attendanceMode: template.attendanceMode,
          status: "active", timezone: template.timezone, validFrom: validity.validFrom, validUntil: validity.validUntil,
          webhookCredentialId: template.webhookCredentialId, createdBy: actor.id, createdAt: stamp, updatedAt: stamp,
        });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.id, entidade: "unit_duty_schedule", entidadeId: id, acao: "duty_schedule.created_by_import" });
        plan.scheduleIds = [id];
        created.push({ ...asPlanSchedule({ ...template, id, name: `${namePrefix} ${short(plan.date)}`, dayOfWeek: dayOfWeekOf(plan.date), validFrom: validity.validFrom, validUntil: validity.validUntil }) });
      }
      // The new plantões receive the same queues as the template.
      if (created.length) {
        for (const queue of templateQueues) {
          const current = [...new Set([...(queue.ids ?? []), ...(queue.single ? [queue.single] : [])])];
          const next = [...new Set([...current, ...created.map((schedule) => schedule.id)])];
          await tx.update(schema.leadQueues).set({ exclusiveDutyScheduleIds: next, exclusiveDutyScheduleId: next[0] ?? null, updatedAt: stamp })
            .where(and(eq(schema.leadQueues.id, queue.id), eq(schema.leadQueues.tenantId, tenantId)));
        }
      }

      // 2) Draft escala: the imported dates of this type, everything else kept from the previous revision.
      const planningBrokers = brokers.filter((broker): broker is typeof broker & { branchId: string } => Boolean(broker.branchId)).map((broker) => ({ id: broker.id, branchId: broker.branchId }));
      const importedScheduleIds = new Set(plans.flatMap((plan) => plan.scheduleIds));
      const importedDates = new Set(plans.map((plan) => plan.date));
      const fresh = buildRangeOccurrences(rangeFrom, rangeUntil, [...existing, ...created].filter((schedule) => importedScheduleIds.has(schedule.id)), planningBrokers, { from: now })
        .filter((occurrence) => importedDates.has(occurrence.dutyDate));
      const [latest] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
        .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey)))
        .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision)).limit(1);
      const freshIds = new Set(fresh.map((occurrence) => occurrence.id));
      const typeOfSchedule = new Map(scheduleRows.map((row) => [row.id, row.typeId]));
      const keptOccurrences = asArray<MonthlyPlanOccurrence>(latest?.occurrences)
        .map((occurrence) => (occurrence.typeId === undefined ? { ...occurrence, typeId: typeOfSchedule.get(occurrence.scheduleId) ?? null } : occurrence))
        .filter((occurrence) => !freshIds.has(occurrence.id) && shiftEnd({ ...occurrence, timezone: TZ }, occurrence.dutyDate).getTime() > now.getTime());
      const keptIds = new Set(keptOccurrences.map((occurrence) => occurrence.id));
      const keptAssignments = asArray<StoredAssignment>(latest?.assignments).filter((item) => keptIds.has(item.occurrenceId))
        .map((item) => ({ occurrenceId: item.occurrenceId, brokerId: item.brokerId, ...(item.origin ? { origin: item.origin } : {}) }));

      // Brokers already on the real roster of these plantões stay (shown as "já escalado").
      const roster = await tx.select({ scheduleId: schema.dutyRosterAssignments.scheduleId, brokerId: schema.dutyRosterAssignments.brokerId, dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text` })
        .from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.tenantId, tenantId), eq(schema.dutyRosterAssignments.status, "active"), inArray(schema.dutyRosterAssignments.scheduleId, [...importedScheduleIds])));
      const assignments: StoredAssignment[] = [];
      const occurrences = fresh.map((occurrence) => {
        const plan = plans.find((item) => item.date === occurrence.dutyDate)!;
        const forced: string[] = [];
        const add = (brokerId: string, origin: StoredAssignment["origin"]) => {
          if (assignments.some((item) => item.occurrenceId === occurrence.id && item.brokerId === brokerId)) return;
          if (!occurrence.allowedBrokerIds.includes(brokerId)) forced.push(brokerId);
          assignments.push({ occurrenceId: occurrence.id, brokerId, origin });
        };
        for (const row of roster) if (row.scheduleId === occurrence.scheduleId && (row.dutyDate === occurrence.dutyDate || row.dutyDate === null)) add(row.brokerId, row.dutyDate ? "existing" : "weekly");
        for (const code of plan.codes) { const broker = brokerByCode.get(code); if (broker) add(broker.id, "generated"); }
        return forced.length ? { ...occurrence, allowedBrokerIds: [...occurrence.allowedBrokerIds, ...forced], forcedBrokerIds: forced } : occurrence;
      });

      const typeKey = typeKeyOf(type.id);
      const previous = parsePlanSettings(latest?.settings);
      const seats = new Map<string, number>();
      for (const item of assignments) if (item.origin === "generated") seats.set(item.brokerId, (seats.get(item.brokerId) ?? 0) + 1);
      const brokerSettings = new Map((previous?.brokers ?? []).map((item) => [item.brokerId, { ...item, seats: Object.fromEntries(Object.entries(item.seats).filter(([key]) => key !== typeKey)) }]));
      for (const [brokerId, count] of seats) {
        const current = brokerSettings.get(brokerId) ?? { brokerId, modality: "any" as const, seats: {}, forcedTypeKeys: [] };
        brokerSettings.set(brokerId, { ...current, seats: { ...current.seats, [typeKey]: count } });
      }
      const settings: PlanSettings = {
        rangeFrom: previous && previous.rangeFrom < rangeFrom ? previous.rangeFrom : rangeFrom,
        rangeUntil: previous && previous.rangeUntil > rangeUntil ? previous.rangeUntil : rangeUntil,
        typeKeys: [...new Set([...(previous?.typeKeys ?? []), typeKey])],
        generatedTypeKeys: [typeKey],
        brokers: [...brokerSettings.values()].filter((item) => Object.keys(item.seats).length),
      };
      const planId = randomUUID();
      await tx.insert(schema.dutyScheduleMonthlyPlans).values({
        id: planId, tenantId, monthKey, revision: (latest?.revision ?? 0) + 1, status: "draft",
        quotas: settings.brokers.map((item) => ({ brokerId: item.brokerId, quota: Object.values(item.seats).reduce((sum, value) => sum + value, 0) })),
        occurrences: [...keptOccurrences, ...occurrences].sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)),
        assignments: [...keptAssignments, ...assignments],
        settings, generatedBy: actor.id,
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.id, entidade: "duty_schedule_monthly_plan", entidadeId: planId, acao: "duty_schedule_monthly_plan.imported" });
      return { created: created.length, occurrences: occurrences.length, assignments: assignments.length, revision: (latest?.revision ?? 0) + 1 };
    });
    console.log(`\nAplicado: ${result.created} plantões criados; escala de ${monthKey} em RASCUNHO (revisão ${result.revision}) com ${result.occurrences} datas e ${result.assignments} alocações.`);
    console.log("Próximo passo: Plantões -> Escala de outubro -> revise na etapa 3 e publique. Nada foi publicado ainda.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
