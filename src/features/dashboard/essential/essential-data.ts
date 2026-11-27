import "server-only";

import { and, count, eq, gte, inArray, isNull, like, lt, lte, notInArray, or, sql } from "drizzle-orm";

import { COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX } from "@/features/ai-qualification/cold-lead-requalification-policy";
import { getSaoPauloDateKey } from "@/features/lead-distribution/dated-duty-roster";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { brokerWhatsAppMembershipScope, brokerWhatsAppMessageSourceCondition } from "../whatsapp-activity-query";
import { getDashboardWelcome, type DashboardDuty } from "../welcome";
import type { OverviewPeriod } from "../overview-filter";
import { resolveOverviewFilter } from "../today";
import { businessDaysBack, businessTurnStart, windowLabel } from "./business-window";
import {
  dutyStartsAt,
  summarizeDuties,
  summarizeQueues,
  summarizeWhatsApp,
  type EssentialDuty,
  type EssentialWhatsApp,
  type ColdLeadRow,
  type EssentialQueue,
} from "./essential-summary";
import { channelSql } from "../entries/entries-by-turn";
import { PULSE_BUCKETS, PULSE_FIRST_HOUR, PULSE_LAST_HOUR, toBuckets, toHours, type DashboardPulse } from "./pulse-core";

/** Distribution states of a lead that is waiting for a broker (same as the command center). */
const WAITING_STATES = ["queued", "unassigned", "returned_to_queue"] as const;
/** Outbox states that were never sent, so they are not a requalification attempt. */
const NOT_AN_ATTEMPT = ["cancelled", "expired", "skipped"];
const LEGACY_REQUALIFICATION_PREFIX = "cold-lead-reactivation:";
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<OverviewPeriod, number> = { today: 1, "7d": 7, "30d": 30 };

export type EssentialDashboard = {
  generatedAt: string;
  /** Primeiro nome de quem olha (saudação do cabeçalho); null quando o usuário não tem nome. */
  firstName: string | null;
  duties: { running: EssentialDuty[]; next: DashboardDuty | null };
  queues: { since: string; label: string; rows: EssentialQueue[]; totals: ReturnType<typeof summarizeQueues>["totals"] };
  whatsapp: EssentialWhatsApp & { since: string; label: string };
  /** Números do período com mini barras e entradas por hora (27/11/2026); ausente em dados de exemplo antigos. */
  pulse?: DashboardPulse;
};

/**
 * Painel essencial do diretor. Blocos 1 e 3 são "agora" (o período não muda nada); o bloco 2 segue o período.
 * A unidade vale para os três. Consultas agregadas, uma por conta, sem N+1.
 */
export async function getEssentialDashboard(
  context: TenantContext,
  filter: { period: OverviewPeriod; branchId?: string | null; queueId?: string | null; window?: { since: Date; until: Date; label: string } | null },
  now = new Date(),
): Promise<EssentialDashboard> {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const overview = await resolveOverviewFilter(context, scope, { period: filter.period, branchId: filter.branchId }, now);
  const unit = overview.narrowBranchId;
  // Intervalo personalizado (20/11/2026): só os leads por fila seguem a janela; plantões e WhatsApp são "agora".
  const queueSince = filter.window?.since ?? businessTurnStart(now, businessDaysBack(PERIOD_DAYS[filter.period]));
  const queueUntil = filter.window ? lt(schema.leads.createdAt, filter.window.until) : undefined;
  const todayTurn = businessTurnStart(now, 0);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const alive = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    scope.leadScope,
    unit ? eq(schema.leads.branchId, unit) : undefined,
    // Fila escolhida no topo do Painel (20/11/2026): intervalo e fila, como nas outras abas.
    filter.queueId ? eq(schema.leads.queueId, filter.queueId) : undefined,
  );
  const today = getSaoPauloDateKey(now);

  // Velocidade (25/11/2026): os três blocos não dependem um do outro; antes rodavam em fila (~1 s).
  const [{ welcome, duties }, queues, whatsapp, pulse] = await Promise.all([(async () => {
  // Bloco 1: plantões rodando agora, com leads da fila de cada plantão e corretores confirmados hoje.
  const welcome = await getDashboardWelcome(context, now, { branchId: unit });
  const running = welcome.runningDuties ?? [];
  const runningIds = running.map((duty) => duty.scheduleId);
  const dutyQueueIds = new Map<string, string | null>();
  const waitingByQueue = new Map<string, number>();
  const distributedBySchedule = new Map<string, number>();
  const confirmedBySchedule = new Map<string, number>();
  if (runningIds.length) {
    const [schedules, queues, waiting, confirmed] = await Promise.all([
      db.select({ id: schema.unitDutySchedules.id, queueId: schema.unitDutySchedules.queueId })
        .from(schema.unitDutySchedules)
        .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), inArray(schema.unitDutySchedules.id, runningIds))),
      db.select({
        id: schema.leadQueues.id,
        exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
        exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds,
      })
        .from(schema.leadQueues)
        .where(and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt))),
      db.select({ queueId: schema.leads.queueId, value: count() })
        .from(schema.leads)
        .where(and(alive, isNull(schema.leads.corretorId), inArray(schema.leads.distributionStatus, [...WAITING_STATES])))
        .groupBy(schema.leads.queueId),
      db.select({ scheduleId: schema.dutyPresenceConfirmations.scheduleId, total: sql<number>`count(distinct ${schema.dutyPresenceConfirmations.brokerId})::int` })
        .from(schema.dutyPresenceConfirmations)
        .where(and(
          eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
          inArray(schema.dutyPresenceConfirmations.scheduleId, runningIds),
          eq(schema.dutyPresenceConfirmations.dutyDate, today),
          eq(schema.dutyPresenceConfirmations.status, "confirmed"),
        ))
        .groupBy(schema.dutyPresenceConfirmations.scheduleId),
    ]);
    // A fila do plantão: a exclusiva que aponta para ele; sem ela, a fila legada do próprio plantão.
    const legacyQueueOf = new Map(schedules.map((row) => [row.id, row.queueId]));
    for (const scheduleId of runningIds) {
      const linked = queues.find((queue) => queue.exclusiveDutyScheduleIds.includes(scheduleId) || queue.exclusiveDutyScheduleId === scheduleId);
      dutyQueueIds.set(scheduleId, linked?.id ?? legacyQueueOf.get(scheduleId) ?? null);
    }
    for (const row of waiting) if (row.queueId) waitingByQueue.set(row.queueId, Number(row.value));
    for (const row of confirmed) confirmedBySchedule.set(row.scheduleId, Number(row.total));
    // Distribuídos desde o início de cada plantão (não desde 00h): um contador por plantão, poucos plantões por unidade.
    await Promise.all(running.map(async (duty) => {
      const queueId = dutyQueueIds.get(duty.scheduleId) ?? null;
      if (!queueId) return;
      const [row] = await db.select({ value: count() })
        .from(schema.leads)
        .where(and(
          alive,
          eq(schema.leads.queueId, queueId),
          sql`${schema.leads.corretorId} is not null`,
          gte(schema.leads.assignedAt, dutyStartsAt(duty.dutyDate, duty.startsAt)),
        ));
      distributedBySchedule.set(duty.scheduleId, Number(row?.value ?? 0));
    }));
  }
  const duties = summarizeDuties(
    running.map((duty) => ({ ...duty, queueId: dutyQueueIds.get(duty.scheduleId) ?? null })),
    waitingByQueue,
    distributedBySchedule,
    confirmedBySchedule,
  );
  return { welcome, duties };
  })(), (async () => {
  // Bloco 2: leads por fila no período (entraram, temperatura, em qualificação e requalificação dos frios).
  const [leadGroups, queueNames, coldLeads] = await Promise.all([
    db.select({ queueId: schema.leads.queueId, status: schema.leads.qualificationStatus, leads: count() })
      .from(schema.leads)
      .where(and(alive, gte(schema.leads.createdAt, queueSince), queueUntil))
      .groupBy(schema.leads.queueId, schema.leads.qualificationStatus),
    db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, hue: schema.leadQueues.colorHue })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt))),
    // Um lead frio por linha; as tentativas são as saídas do outbox do requalificador (automática ou manual).
    db.select({ queueId: schema.leads.queueId, attempts: count(schema.whatsappOutboundMessages.id) })
      .from(schema.leads)
      .leftJoin(schema.whatsappOutboundMessages, and(
        eq(schema.whatsappOutboundMessages.recipientId, schema.leads.id),
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        or(
          like(schema.whatsappOutboundMessages.idempotencyKey, `${COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX}%`),
          like(schema.whatsappOutboundMessages.idempotencyKey, `${LEGACY_REQUALIFICATION_PREFIX}%`),
        ),
        notInArray(schema.whatsappOutboundMessages.status, NOT_AN_ATTEMPT),
      ))
      .where(and(alive, gte(schema.leads.createdAt, queueSince), queueUntil, eq(schema.leads.qualificationStatus, "cold")))
      .groupBy(schema.leads.id, schema.leads.queueId),
  ]);
  const names = new Map(queueNames.map((row) => [row.id, row]));
  const queues = summarizeQueues(
    leadGroups.map((row) => {
      const queue = row.queueId ? names.get(row.queueId) : undefined;
      return { queueId: row.queueId, queueName: queue?.name ?? null, hue: queue?.hue ?? null, status: row.status, leads: Number(row.leads) };
    }),
    [],
    coldLeads.map((row): ColdLeadRow => ({ queueId: row.queueId, attempts: Number(row.attempts) })),
  );
  return queues;
  })(), (async () => {
  // Bloco 3: WhatsApp dos corretores na janela do dia (fixa, não segue o período) e atendimentos das últimas 24h.
  const brokerScope = brokerWhatsAppMembershipScope({ role: context.role, branchId: context.branchId, supervisedBrokerIds: scope.supervisedBrokerIds });
  const brokers = brokerScope === null
    ? []
    : await db.select({ id: schema.tenantMemberships.userId, name: schema.user.name })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        brokerScope,
        unit ? eq(schema.tenantMemberships.branchId, unit) : undefined,
      ));
  const brokerIds = brokers.map((broker) => broker.id);
  const whatsappRows = brokerIds.length ? await loadBrokerWhatsApp(context, alive, brokerIds, todayTurn, dayAgo, now) : null;
  const whatsapp = summarizeWhatsApp(brokers.map((broker) => ({
    id: broker.id,
    name: broker.name,
    connected: whatsappRows?.connected.has(broker.id) ?? false,
    received: whatsappRows?.received.get(broker.id) ?? 0,
    responding: whatsappRows?.responding.get(broker.id) ?? 0,
    active: whatsappRows?.active.get(broker.id) ?? 0,
  })));
  return whatsapp;
  })(), loadPulse(alive, queueSince, filter.window?.until ?? now, filter.period, Boolean(filter.window), now).catch((error) => {
    console.error("[essential-dashboard] pulse_failed", { message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return undefined;
  })]);

  return {
    generatedAt: now.toISOString(),
    firstName: welcome.firstName,
    duties: { running: duties, next: welcome.nextDuty },
    queues: { since: queueSince.toISOString(), label: filter.window?.label ?? windowLabel(queueSince), rows: queues.queues, totals: queues.totals },
    whatsapp: { ...whatsapp, since: todayTurn.toISOString(), label: windowLabel(todayTurn) },
    pulse,
  };
}

/**
 * Pulso do período (27/11/2026): entraram, qualificados, distribuídos e vendas em 12 faixas da janela, o tempo médio
 * até o corretor, o valor vendido, os que entraram na janela anterior e as entradas por hora (06h a 19h) por canal.
 * Cinco consultas agregadas em paralelo, no mesmo escopo (`alive`: tenant, escopo, unidade e fila).
 */
async function loadPulse(alive: ReturnType<typeof and>, since: Date, until: Date, period: OverviewPeriod, custom: boolean, now: Date): Promise<DashboardPulse> {
  const db = getDatabase();
  const span = Math.max(60_000, until.getTime() - since.getTime());
  const step = span / PULSE_BUCKETS / 1000;
  const sinceIso = since.toISOString();
  const bucketOf = (column: unknown) => sql<number>`floor(extract(epoch from (${column} - ${sinceIso}::timestamptz)) / ${step})::int`;
  const arrivedBucket = bucketOf(schema.leads.createdAt);
  const assignedBucket = bucketOf(schema.leads.assignedAt);
  const saleBucket = bucketOf(schema.sales.saleDate);
  const localHour = sql<number>`extract(hour from (${schema.leads.createdAt} at time zone 'America/Sao_Paulo'))::int`;
  const previousSince = new Date(since.getTime() - span);
  const [arrivedRows, assignedRows, saleRows, previousRows, hourRows] = await Promise.all([
    db.select({
      bucket: arrivedBucket,
      arrived: sql<number>`count(*)::int`,
      qualified: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} in ('hot', 'warm'))::int`,
    })
      .from(schema.leads)
      .where(and(alive, gte(schema.leads.createdAt, since), lt(schema.leads.createdAt, until)))
      .groupBy(arrivedBucket),
    db.select({
      bucket: assignedBucket,
      value: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(extract(epoch from (${schema.leads.assignedAt} - ${schema.leads.createdAt})) / 60), 0)::float`,
    })
      .from(schema.leads)
      .where(and(alive, sql`${schema.leads.corretorId} is not null`, gte(schema.leads.assignedAt, since), lt(schema.leads.assignedAt, until)))
      .groupBy(assignedBucket),
    db.select({
      bucket: saleBucket,
      value: sql<number>`count(*)::int`,
      amount: sql<number>`coalesce(sum(${schema.sales.saleValue}), 0)::float`,
    })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.sales.leadId))
      .where(and(alive, eq(schema.sales.status, "active"), gte(schema.sales.saleDate, since), lt(schema.sales.saleDate, until)))
      .groupBy(saleBucket),
    custom ? Promise.resolve([]) : db.select({ value: count() })
      .from(schema.leads)
      .where(and(alive, gte(schema.leads.createdAt, previousSince), lt(schema.leads.createdAt, since))),
    db.select({ hour: localHour, channel: channelSql, total: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(
        alive,
        gte(schema.leads.createdAt, period === "today" && !custom ? businessTurnStart(now, 0) : since),
        lt(schema.leads.createdAt, until),
        sql`${localHour} between ${PULSE_FIRST_HOUR} and ${PULSE_LAST_HOUR}`,
      ))
      .groupBy(localHour, channelSql),
  ]);
  const distributedTotal = assignedRows.reduce((sum, row) => sum + Number(row.value), 0);
  const assignMinutes = assignedRows.reduce((sum, row) => sum + Number(row.minutes), 0);
  return {
    arrived: toBuckets(arrivedRows.map((row) => ({ bucket: row.bucket, value: row.arrived }))),
    qualified: toBuckets(arrivedRows.map((row) => ({ bucket: row.bucket, value: row.qualified }))),
    distributed: toBuckets(assignedRows.map((row) => ({ bucket: row.bucket, value: row.value }))),
    sales: toBuckets(saleRows.map((row) => ({ bucket: row.bucket, value: row.value }))),
    distributedTotal,
    avgAssignMinutes: distributedTotal ? Math.round(assignMinutes / distributedTotal) : null,
    salesTotal: saleRows.reduce((sum, row) => sum + Number(row.value), 0),
    salesValue: saleRows.reduce((sum, row) => sum + Number(row.amount), 0),
    previousArrived: custom ? null : Number(previousRows[0]?.value ?? 0),
    hours: toHours(hourRows.map((row) => ({ hour: Number(row.hour), channel: String(row.channel), total: Number(row.total) }))),
  };
}

/**
 * Conexão pronta, leads recebidos na janela, leads respondendo na janela e atendimentos ativos (leads abertos
 * com resposta do cliente nas últimas 24h pela conexão do corretor). Duas consultas, por corretor.
 */
async function loadBrokerWhatsApp(
  context: TenantContext,
  alive: ReturnType<typeof and>,
  brokerIds: string[],
  since: Date,
  dayAgo: Date,
  now: Date,
) {
  const db = getDatabase();
  const [connections, received, conversations] = await Promise.all([
    db.select({ userId: schema.whatsappConnections.userId })
      .from(schema.whatsappConnections)
      .where(and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.status, "ready"),
        inArray(schema.whatsappConnections.userId, brokerIds),
      )),
    db.select({ brokerId: schema.leads.corretorId, value: count() })
      .from(schema.leads)
      .where(and(alive, inArray(schema.leads.corretorId, brokerIds), gte(schema.leads.assignedAt, since)))
      .groupBy(schema.leads.corretorId),
    db.select({
      brokerId: schema.leads.corretorId,
      // postgres.js does not encode a raw Date inside sql``: send ISO text and cast.
      responding: sql<number>`(count(distinct ${schema.leads.id}) filter (where ${schema.leads.assignedAt} >= ${since.toISOString()}::timestamptz and ${schema.whatsappMessages.sentAt} >= ${since.toISOString()}::timestamptz))::int`,
      active: sql<number>`(count(distinct ${schema.leads.id}) filter (where ${schema.leads.status} not in ('converted', 'lost') and ${schema.whatsappMessages.sentAt} >= ${dayAgo.toISOString()}::timestamptz))::int`,
    })
      .from(schema.leads)
      .innerJoin(schema.whatsappMessages, and(
        eq(schema.whatsappMessages.leadId, schema.leads.id),
        eq(schema.whatsappMessages.tenantId, context.tenantId),
        eq(schema.whatsappMessages.provider, "waha"),
        inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
        gte(schema.whatsappMessages.sentAt, dayAgo < since ? dayAgo : since),
        lte(schema.whatsappMessages.sentAt, now),
        notStatusBroadcastSql(schema.whatsappMessages.messageId),
        sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
        brokerWhatsAppMessageSourceCondition({ tenantId: context.tenantId, brokerUserId: schema.leads.corretorId, message: schema.whatsappMessages }),
      ))
      .where(and(alive, inArray(schema.leads.corretorId, brokerIds)))
      .groupBy(schema.leads.corretorId),
  ]);

  return {
    connected: new Set(connections.map((row) => row.userId)),
    received: new Map(received.map((row) => [row.brokerId ?? "", Number(row.value)])),
    responding: new Map(conversations.map((row) => [row.brokerId ?? "", Number(row.responding)])),
    active: new Map(conversations.map((row) => [row.brokerId ?? "", Number(row.active)])),
  };
}
