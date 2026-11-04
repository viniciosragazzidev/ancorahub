/**
 * Plantão Niterói (pedido do Vinicios, 04/11/2026): escala de outubro/novembro da unidade
 * Niterói 1, em três turnos por dia, recebendo só a fila "Alessandra Leads" (a fila da unidade).
 *
 * 1. Cria o tipo "Plantão Niterói" (presencial, só a unidade Niterói 1).
 * 2. Cria um plantão por data e turno (09:00–12:00, 12:00–15:00, 15:00–18:00; a planilha escreve
 *    12:01 e 15:01, mas o horário contínuo evita um minuto sem plantão). "Oportunidade" vira plantão
 *    sem corretor. O feriado de 19/10 fica de fora.
 * 3. Liga todos os plantões à fila "Alessandra Leads".
 * 4. Publica os corretores nos turnos que ainda não acabaram, na escala publicada do mês (como
 *    "Adicionar corretor" na escala publicada). Turnos que já acabaram ficam só como registro, sem
 *    corretor: escalar alguém no passado criaria falta de presença que não aconteceu.
 *
 * Simulação por padrão:   npx tsx scripts/create-plantao-niteroi.ts
 * Gravar:                 npx tsx scripts/create-plantao-niteroi.ts --apply
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/shared/db/schema";
import {
  buildRangeOccurrences,
  dayOfWeekOf,
  occurrenceValidity,
  shiftEnd,
  type MonthlyPlanAssignment,
  type MonthlyPlanOccurrence,
  type MonthlyPlanSchedule,
} from "../src/features/lead-distribution/monthly-duty-plan";

if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const envFile = process.argv[process.argv.indexOf("--env") + 1];
const TENANT_ID = "d47a4d41-4e45-450d-a0b8-a9e1be286903";
const BRANCH_ID = "21b3c7e7-9405-4465-9975-018c21f2eb65"; // Niterói 1 - Luiz Leopoldo
const QUEUE_ID = "3a8f6f3e-af4e-4b1d-8994-6fd93a6c3733"; // Alessandra Leads
const ACTOR_EMAIL = "crm@ancorasaude.com.br";
const TYPE_NAME = "Plantão Niterói";
const TZ = "America/Sao_Paulo";
const SHIFTS = [
  { startsAt: "09:00", endsAt: "12:00" },
  { startsAt: "12:00", endsAt: "15:00" },
  { startsAt: "15:00", endsAt: "18:00" },
] as const;

/** Código da planilha -> nome (para achar quem ainda não tem o código no nome do CRM). */
const SHEET_NAMES: Record<string, string> = {
  "12031": "Luiz Marques", "12499": "Patricia Vieira", "11854": "Divonete", "12374": "Kelly Santana",
  "12047": "Ivaldo Junior", "11775": "Renata Quadros", "4130": "Suzana Lippi", "9805": "Bruna Soares",
};

/** A planilha, linha por linha: manhã, meio-dia, tarde. null = Oportunidade (sem corretor). */
const SHEET: Array<[string, string | null, string | null, string | null]> = [
  ["2026-10-02", "12031", null, null],
  ["2026-10-05", "12499", "11854", null],
  ["2026-10-06", "12374", "12031", "12047"],
  ["2026-10-07", "11775", "12499", null],
  ["2026-10-08", "12031", "4130", "11775"],
  ["2026-10-13", "4130", "11775", "12374"],
  ["2026-10-14", "12047", "12031", "12499"],
  ["2026-10-15", "12374", "11775", null],
  ["2026-10-16", "11854", "12374", null],
  ["2026-10-20", "11775", "12031", null],
  ["2026-10-21", "9805", null, "12374"],
  ["2026-10-22", "12031", "11775", "11854"],
  ["2026-10-23", "12031", "12374", null],
  ["2026-10-26", "12374", "12047", "12047"],
  ["2026-10-27", "9805", "12374", "11854"],
  ["2026-10-28", "12031", "12031", "12374"],
  ["2026-10-29", "4130", "9805", "12499"],
  ["2026-10-30", "12031", "4130", "11775"],
  ["2026-11-03", "11854", null, "12374"],
  ["2026-11-04", "11775", "12047", "12031"],
  ["2026-11-05", "12374", "9805", "9805"],
  ["2026-11-06", "11775", "11775", "12374"],
  ["2026-11-09", "12499", "9805", "9805"],
];

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const short = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);
type StoredAssignment = MonthlyPlanAssignment & { rosterAssignmentId?: string };

async function main() {
  if (envFile && !envFile.startsWith("--")) {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(envFile, "utf8");
    const url = text.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? text.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
    if (url) process.env.SUPABASE_DB_URL = url;
  }
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!databaseUrl) throw new Error("SUPABASE_DB_URL ou DATABASE_URL é obrigatório.");
  const client = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  try {
    const now = new Date();

    // ---------- checks
    const [actor] = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, TENANT_ID), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.email, ACTOR_EMAIL)))
      .limit(1);
    if (!actor) throw new Error(`Nenhum Diretor ativo com o e-mail ${ACTOR_EMAIL}.`);
    const [queue] = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, status: schema.leadQueues.status, ids: schema.leadQueues.exclusiveDutyScheduleIds, single: schema.leadQueues.exclusiveDutyScheduleId })
      .from(schema.leadQueues).where(and(eq(schema.leadQueues.id, QUEUE_ID), eq(schema.leadQueues.tenantId, TENANT_ID))).limit(1);
    if (!queue || queue.status !== "active") throw new Error("A fila Alessandra Leads não está ativa.");
    const [existingType] = await db.select({ id: schema.dutyScheduleTypes.id }).from(schema.dutyScheduleTypes)
      .where(and(eq(schema.dutyScheduleTypes.tenantId, TENANT_ID), sql`lower(${schema.dutyScheduleTypes.name}) = lower(${TYPE_NAME})`)).limit(1);
    if (existingType) throw new Error(`O tipo "${TYPE_NAME}" já existe (${existingType.id}). Nada foi feito para não duplicar.`);

    // ---------- brokers (código no nome do CRM; senão, pelo nome da planilha)
    const brokers = await db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
      .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, TENANT_ID), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")));
    const brokerByCode = new Map<string, (typeof brokers)[number]>();
    const notes: string[] = [];
    for (const [code, sheetName] of Object.entries(SHEET_NAMES)) {
      const byCode = brokers.filter((broker) => new RegExp(`(^|\\D)${code}(\\D|$)`).test(broker.name));
      const wanted = fold(sheetName).split(/\s+/);
      const byName = brokers.filter((broker) => { const tokens = fold(broker.name).split(/\s+/); return wanted.every((word) => tokens.includes(word)); });
      const pick = byCode.length === 1 ? byCode[0] : byName.length === 1 ? byName[0] : null;
      if (pick) brokerByCode.set(code, pick);
      else notes.push(`${code} ${sheetName}: ${byCode.length || byName.length ? `mais de um no CRM (${[...byCode, ...byName].map((b) => b.name).join(" | ")})` : "não encontrado"}`);
    }

    // ---------- plan of plantões
    type Slot = { date: string; startsAt: string; endsAt: string; code: string | null; ended: boolean; id: string; name: string };
    const slots: Slot[] = SHEET.flatMap(([date, ...codes]) => SHIFTS.map((shift, index) => ({
      date, ...shift, code: codes[index],
      ended: shiftEnd({ ...shift, timezone: TZ }, date).getTime() <= now.getTime(),
      id: randomUUID(),
      name: `${TYPE_NAME} ${short(date)} · ${shift.startsAt}–${shift.endsAt}`,
    })));
    const toRoster = slots.filter((slot) => !slot.ended && slot.code && brokerByCode.has(slot.code));

    console.log(`Diretor: ${actor.name}. Fila: ${queue.name} (${(queue.ids ?? []).length} plantões ligados hoje).`);
    console.log(`Corretores: ${[...brokerByCode].map(([code, broker]) => `${code} → ${broker.name}${broker.branchId === BRANCH_ID ? "" : " (outra unidade)"}`).join("; ")}`);
    if (notes.length) console.log(`Sem correspondência (o turno fica sem corretor): ${notes.join("; ")}`);
    console.log(`\nPlantões a criar: ${slots.length} (${SHEET.length} datas × 3 turnos; ${slots.filter((slot) => !slot.code).length} "Oportunidade" sem corretor).`);
    console.log(`Já encerrados (só registro, sem corretor): ${slots.filter((slot) => slot.ended).length}.`);
    console.log("Corretores publicados agora:");
    for (const slot of toRoster) console.log(`  ${short(slot.date)} ${slot.startsAt}–${slot.endsAt}: ${brokerByCode.get(slot.code!)!.name}`);
    const unmatchedFuture = slots.filter((slot) => !slot.ended && slot.code && !brokerByCode.has(slot.code));
    if (unmatchedFuture.length) console.log(`Turnos futuros sem corretor encontrado: ${unmatchedFuture.map((slot) => `${short(slot.date)} ${slot.startsAt} (${slot.code})`).join(", ")}`);

    const months = [...new Set(toRoster.map((slot) => slot.date.slice(0, 7)))];
    const publishedByMonth = new Map<string, typeof schema.dutyScheduleMonthlyPlans.$inferSelect>();
    const draftByMonth = new Map<string, typeof schema.dutyScheduleMonthlyPlans.$inferSelect>();
    for (const monthKey of months) {
      const plans = await db.select().from(schema.dutyScheduleMonthlyPlans)
        .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, TENANT_ID), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey)))
        .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision));
      const published = plans.find((plan) => plan.status === "published");
      if (!published) throw new Error(`Não há escala publicada de ${monthKey}. Publique uma escala do mês antes.`);
      publishedByMonth.set(monthKey, published);
      const newerDraft = plans.find((plan) => plan.status === "draft" && plan.revision > published.revision);
      if (newerDraft) draftByMonth.set(monthKey, newerDraft);
      console.log(`Escala publicada de ${monthKey}: revisão ${published.revision}${newerDraft ? `; rascunho mais novo (revisão ${newerDraft.revision}) também recebe os turnos` : ""}.`);
    }
    if (!apply) { console.log("\nSimulação: nada foi gravado. Rode com --apply para gravar."); return; }

    // ---------- apply
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${TENANT_ID}), hashtext('duty-plan'))`);
      const stamp = new Date();
      const typeId = randomUUID();
      await tx.insert(schema.dutyScheduleTypes).values({
        id: typeId, tenantId: TENANT_ID, name: TYPE_NAME, status: "active", attendanceMode: "presencial", branchIds: [BRANCH_ID],
        defaultStartsAt: "09:00", defaultEndsAt: "18:00", defaultMinimumBrokers: 1, defaultMaximumBrokers: null,
        createdBy: actor.id, updatedBy: actor.id, createdAt: stamp, updatedAt: stamp,
      });
      await tx.insert(schema.unitDutySchedules).values(slots.map((slot) => ({
        id: slot.id, tenantId: TENANT_ID, branchId: null, queueId: null, name: slot.name, typeId,
        dayOfWeek: dayOfWeekOf(slot.date), startsAt: slot.startsAt, endsAt: slot.endsAt, priority: 100,
        minimumBrokers: 1, maximumBrokers: null, maxLeadsPerBroker: null, shiftSplitAt: null, attendanceMode: "presencial",
        status: "active", timezone: TZ, ...occurrenceValidity(slot.date, TZ), webhookCredentialId: null,
        createdBy: actor.id, createdAt: stamp, updatedAt: stamp,
      })));
      await tx.insert(schema.auditLogs).values(slots.map((slot) => ({ id: randomUUID(), userId: actor.id, entidade: "unit_duty_schedule", entidadeId: slot.id, acao: "duty_schedule.created_by_import" })));

      // The queue receives only from these plantões while one is running.
      const current = [...new Set([...(queue.ids ?? []), ...(queue.single ? [queue.single] : [])])];
      const next = [...new Set([...current, ...slots.map((slot) => slot.id)])];
      await tx.update(schema.leadQueues).set({ exclusiveDutyScheduleIds: next, exclusiveDutyScheduleId: next[0] ?? null, updatedAt: stamp })
        .where(and(eq(schema.leadQueues.id, QUEUE_ID), eq(schema.leadQueues.tenantId, TENANT_ID)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.id, entidade: "lead_queue", entidadeId: QUEUE_ID, acao: "queue.duty_schedule_linked" });

      // Published escala: occurrences, assignments and the dated roster rows of the shifts still ahead.
      const planBrokers = brokers.filter((broker): broker is typeof broker & { branchId: string } => Boolean(broker.branchId)).map((broker) => ({ id: broker.id, branchId: broker.branchId }));
      let rosterRows = 0;
      for (const monthKey of months) {
        const monthSlots = toRoster.filter((slot) => slot.date.startsWith(monthKey));
        const asSchedule = (slot: Slot): MonthlyPlanSchedule => ({
          id: slot.id, name: slot.name, branchId: null, dayOfWeek: dayOfWeekOf(slot.date), startsAt: slot.startsAt, endsAt: slot.endsAt,
          minimumBrokers: 1, maximumBrokers: null, timezone: TZ, ...occurrenceValidity(slot.date, TZ), typeId, attendanceMode: "presencial", typeBranchIds: [BRANCH_ID],
        });
        const occurrences: MonthlyPlanOccurrence[] = monthSlots.flatMap((slot) => buildRangeOccurrences(slot.date, slot.date, [asSchedule(slot)], planBrokers));
        const assignments: StoredAssignment[] = [];
        for (const slot of monthSlots) {
          const broker = brokerByCode.get(slot.code!)!;
          const occurrence = occurrences.find((item) => item.scheduleId === slot.id)!;
          if (!occurrence.allowedBrokerIds.includes(broker.id)) {
            occurrence.allowedBrokerIds.push(broker.id);
            occurrence.forcedBrokerIds = [...(occurrence.forcedBrokerIds ?? []), broker.id];
          }
          const rosterId = randomUUID();
          await tx.insert(schema.dutyRosterAssignments).values({
            id: rosterId, tenantId: TENANT_ID, branchId: broker.branchId ?? BRANCH_ID, scheduleId: slot.id, brokerId: broker.id,
            dayOfWeek: dayOfWeekOf(slot.date), startsAt: slot.startsAt, endsAt: slot.endsAt, ...occurrenceValidity(slot.date, TZ),
            dutyDate: slot.date, monthlyPlanId: publishedByMonth.get(monthKey)!.id, status: "active",
            createdBy: actor.id, updatedBy: actor.id, createdAt: stamp, updatedAt: stamp,
          });
          rosterRows += 1;
          assignments.push({ occurrenceId: occurrence.id, brokerId: broker.id, origin: "manual", rosterAssignmentId: rosterId });
        }
        for (const plan of [publishedByMonth.get(monthKey)!, draftByMonth.get(monthKey)].filter(Boolean) as Array<typeof schema.dutyScheduleMonthlyPlans.$inferSelect>) {
          await tx.update(schema.dutyScheduleMonthlyPlans).set({
            occurrences: [...asArray<MonthlyPlanOccurrence>(plan.occurrences), ...occurrences]
              .sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)),
            assignments: [...asArray<StoredAssignment>(plan.assignments), ...assignments],
            updatedAt: stamp,
          }).where(eq(schema.dutyScheduleMonthlyPlans.id, plan.id));
          await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.id, entidade: "duty_schedule_monthly_plan", entidadeId: plan.id, acao: "duty_schedule_monthly_plan.published_broker_added" });
        }
      }
      return { typeId, schedules: slots.length, rosterRows };
    });
    console.log(`\nAplicado: tipo ${TYPE_NAME} (${result.typeId}), ${result.schedules} plantões ligados à fila ${queue.name}, ${result.rosterRows} corretores publicados.`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
