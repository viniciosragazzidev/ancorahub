import "server-only";

import { and, count, eq, gte, inArray, isNull, like, lte, notInArray, or, sql } from "drizzle-orm";

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
};

/**
 * Painel essencial do diretor. Blocos 1 e 3 são "agora" (o período não muda nada); o bloco 2 segue o período.
 * A unidade vale para os três. Consultas agregadas, uma por conta, sem N+1.
 */
export async function getEssentialDashboard(context: TenantContext, filter: { period: OverviewPeriod; branchId?: string | null }, now = new Date()): Promise<EssentialDashboard> {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const overview = await resolveOverviewFilter(context, scope, { period: filter.period, branchId: filter.branchId }, now);
  const unit = overview.narrowBranchId;
  const queueSince = businessTurnStart(now, businessDaysBack(PERIOD_DAYS[filter.period]));
  const todayTurn = businessTurnStart(now, 0);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const alive = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    scope.leadScope,
    unit ? eq(schema.leads.branchId, unit) : undefined,
  );
  const today = getSaoPauloDateKey(now);

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

  // Bloco 2: leads por fila no período (entraram, temperatura, em qualificação e requalificação dos frios).
  const [leadGroups, queueNames, coldLeads] = await Promise.all([
    db.select({ queueId: schema.leads.queueId, status: schema.leads.qualificationStatus, leads: count() })
      .from(schema.leads)
      .where(and(alive, gte(schema.leads.createdAt, queueSince)))
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
      .where(and(alive, gte(schema.leads.createdAt, queueSince), eq(schema.leads.qualificationStatus, "cold")))
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

  return {
    generatedAt: now.toISOString(),
    firstName: welcome.firstName,
    duties: { running: duties, next: welcome.nextDuty },
    queues: { since: queueSince.toISOString(), label: windowLabel(queueSince), rows: queues.queues, totals: queues.totals },
    whatsapp: { ...whatsapp, since: todayTurn.toISOString(), label: windowLabel(todayTurn) },
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
