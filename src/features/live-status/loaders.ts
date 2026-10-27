import "server-only";

import { and, count, eq, gt, gte, inArray, isNotNull, isNull, like, ne, notInArray, or, sql, type SQL } from "drizzle-orm";

import {
  COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX,
  isEligibleColdLeadForManualRequalification,
  coldSinceAt,
} from "@/features/ai-qualification/cold-lead-requalification-policy";
import { QUALIFICATION_TIMEOUT_SKIPPED_STATUSES } from "@/features/ai-agent/qualification-timeout-sweep";
import { readColdAgeRelease } from "@/features/lead-distribution/cold-age-release";
import { todayKeyInSaoPaulo } from "@/features/lead-distribution/cold-age-release-rules";
import { getSaoPauloDateKey } from "@/features/lead-distribution/dated-duty-roster";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { readJobHeartbeats } from "./heartbeat";
import { buildAiQualificationStatus } from "./providers/ai-qualification";
import { buildColdLeadsStatus } from "./providers/cold-leads";
import { buildColdReleaseStatus } from "./providers/cold-release";
import { buildDistributionEngineSeal } from "./providers/distribution-engine";
import { buildDutyStatus } from "./providers/duty";
import { buildFirstContactStatus } from "./providers/first-contact";
import { buildOffersStatus } from "./providers/offers";
import { buildWaitingBrokerStatus } from "./providers/waiting-broker";
import { buildWhatsAppQueueStatus } from "./providers/whatsapp-queue";
import { liveLeadScope } from "./scope";
import type { LiveScope, LiveSeal, LiveStatus } from "./types";

/**
 * Uma consulta agregada por status, sempre com tenant e o recorte do papel, e sempre limitada por data ou estado
 * com índice existente (leads_tenant_created_live_idx, leads_tenant_assigned_live_idx,
 * lead_distribution_jobs_due_idx, lead_offers_tenant_offered_at_idx, whatsapp_outbound_messages_queue_idx).
 * Nada de consulta por item. postgres.js não codifica Date cru dentro de sql``: datas vão em ISO com ::timestamptz.
 */

const HOUR = 3_600_000;
const LEGACY_REQUALIFICATION_PREFIX = "cold-lead-reactivation:";
const WAITING_DISTRIBUTION = ["queued", "unassigned", "returned_to_queue"];
const ACTIVE_OFFER = ["PENDING", "SENT", "DELIVERED", "READ"];
const WAITING_OUTBOX = ["pending", "queued", "processing"];

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const toDate = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string));
const alive = () => and(isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt));

export async function loadColdLeads(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const db = getDatabase();
  const since = new Date(now.getTime() - 48 * HOUR);
  const outbox = schema.whatsappOutboundMessages;
  // Tentativas = saídas do outbox do requalificador (automática ou manual), como no painel essencial. Uma agregação
  // só, limitada às 48 h pelo índice (tenant_id, created_at): a tentativa nunca é anterior à chegada do lead.
  const attempts = db.select({ recipientId: outbox.recipientId, attempts: sql<number>`count(*)::int`.as("attempts") })
    .from(outbox)
    .where(and(
      eq(outbox.tenantId, scope.tenantId),
      gte(outbox.createdAt, since),
      or(like(outbox.idempotencyKey, `${COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX}%`), like(outbox.idempotencyKey, `${LEGACY_REQUALIFICATION_PREFIX}%`)),
      notInArray(outbox.status, ["cancelled", "expired", "skipped"]),
    ))
    .groupBy(outbox.recipientId)
    .as("requalification_attempts");
  const [rows, automatic, turboCovers] = await Promise.all([
    db.select({
      id: schema.leads.id,
      createdAt: schema.leads.createdAt,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationState: schema.leads.qualificationState,
      qualificationCompletedAt: schema.leads.qualificationCompletedAt,
      corretorId: schema.leads.corretorId,
      status: schema.leads.status,
      distributionStatus: schema.leads.distributionStatus,
      distributionRemovedAt: schema.leads.distributionRemovedAt,
      archivedAt: schema.leads.archivedAt,
      deletedAt: schema.leads.deletedAt,
      queueId: schema.leads.queueId,
      // Quando esfriou sem dado válido: o tempo limite que segurou o lead (mesma regra do requalificador).
      timeoutHoldAt: sql<string | null>`(select max(e.created_at) from lead_distribution_events e where e.tenant_id = ${schema.leads.tenantId} and e.lead_id = ${schema.leads.id} and e.action = 'qualification_timeout_manual_hold')`,
      attempts: sql<number>`coalesce(${attempts.attempts}, 0)`,
    })
      .from(schema.leads)
      .leftJoin(attempts, eq(attempts.recipientId, schema.leads.id))
      .where(and(
        liveLeadScope(scope),
        alive(),
        isNull(schema.leads.corretorId),
        eq(schema.leads.qualificationStatus, "cold"),
        isNull(schema.leads.distributionRemovedAt),
        notInArray(schema.leads.status, ["lost", "converted", "under_analysis"]),
        notInArray(schema.leads.distributionStatus, ["assigned", "held", "removed", "returned_to_queue"]),
        gte(schema.leads.createdAt, since),
      ))
      .limit(500),
    getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION).catch(() => "true"),
    import("@/features/qualification-turbo/cadence-job").then((module) => module.turboCadenceCoversRequalification(scope.tenantId)).catch(() => false),
  ]);
  const eligible = rows.filter((row) => isEligibleColdLeadForManualRequalification(row));
  return buildColdLeadsStatus({
    rows: eligible.map((row) => ({ coldSince: coldSinceAt(row, toDate(row.timeoutHoldAt)), attempts: Number(row.attempts) })),
    now,
    scope,
    automaticEnabled: automatic === "true",
    turboCovers,
  });
}

export async function loadColdRelease(scope: LiveScope, now: Date): Promise<LiveStatus | null> {
  const db = getDatabase();
  const queues = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, scope.tenantId), isNull(schema.leadQueues.deletedAt), eq(schema.leadQueues.status, "active")));
  // A configuração de cada fila mora em system_settings, lida do cache de configurações (sem ida ao banco por fila).
  const configs = await Promise.all(queues.map(async (queue) => ({ queue, config: await readColdAgeRelease(queue.id, queue.name) })));
  const enabled = configs.filter((item) => item.config.enabled);
  if (!enabled.length) return null;
  const leads = await db.select({ queueId: schema.leads.queueId, createdAt: schema.leads.createdAt })
    .from(schema.leads)
    .where(and(
      liveLeadScope(scope),
      alive(),
      isNull(schema.leads.corretorId),
      isNull(schema.leads.distributionRemovedAt),
      inArray(schema.leads.queueId, enabled.map((item) => item.queue.id)),
      inArray(schema.leads.distributionStatus, WAITING_DISTRIBUTION),
      gte(schema.leads.createdAt, new Date(now.getTime() - 5 * 24 * HOUR)),
    ))
    .limit(2000);
  const today = todayKeyInSaoPaulo(now);
  return buildColdReleaseStatus({
    queues: enabled.map(({ queue, config }) => ({
      queueId: queue.id,
      name: queue.name,
      releasedEarlyToday: config.releasedEarlyOn === today,
      waitingCreatedAt: leads.filter((lead) => lead.queueId === queue.id).map((lead) => lead.createdAt),
    })),
    now,
    scope,
  });
}

export async function loadAiQualification(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const rows = await getDatabase().select({
    lastActivityAt: sql<string>`coalesce((select max(c.last_activity_at) from ai_conversations c where c.tenant_id = ${schema.leads.tenantId} and c.lead_id = ${schema.leads.id}), ${schema.leads.createdAt})`,
    timeoutMinutes: sql<number | null>`(select q.timeout_minutes from ai_qualification_configs q where q.tenant_id = ${schema.leads.tenantId} limit 1)`,
  })
    .from(schema.leads)
    // O mesmo recorte da varredura (qualification-timeout-sweep.ts), limitado aos 2 últimos dias.
    .where(and(
      liveLeadScope(scope),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.corretorId),
      ne(schema.leads.distributionStatus, "manual_hold"),
      isNull(schema.leads.distributionRemovedAt),
      or(
        eq(schema.leads.qualificationState, "IN_PROGRESS"),
        eq(schema.leads.qualificationStatus, "qualifying"),
        eq(schema.leads.qualificationStatus, "pending"),
        isNull(schema.leads.qualificationStatus),
      ),
      notInArray(schema.leads.qualificationStatus, [...QUALIFICATION_TIMEOUT_SKIPPED_STATUSES]),
      gte(schema.leads.createdAt, new Date(now.getTime() - 48 * HOUR)),
    ))
    .limit(500);
  return buildAiQualificationStatus({
    rows: rows.map((row) => ({ lastActivityAt: new Date(row.lastActivityAt) })),
    timeoutMinutes: Number(rows[0]?.timeoutMinutes ?? 15),
    now,
    scope,
  });
}

/** Gestor: só os itens de leads da unidade. Diretor: a empresa. (Supervisor e corretor não veem estes status.) */
function branchLeadJoin(scope: LiveScope, leadId: SQL | typeof schema.leadDistributionJobs.leadId) {
  return scope.role === "manager" && scope.branchId
    ? sql`exists (select 1 from leads l where l.id = ${leadId} and l.tenant_id = ${scope.tenantId} and l.branch_id = ${scope.branchId})`
    : undefined;
}

export async function loadWaitingBroker(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const groups = await getDatabase().select({
    reason: schema.leadDistributionJobs.lastErrorMessage,
    total: count(),
    nextRunAfter: sql<string | null>`min(${schema.leadDistributionJobs.runAfter})`,
  })
    .from(schema.leadDistributionJobs)
    .where(and(
      inArray(schema.leadDistributionJobs.status, ["pending", "retrying"]),
      eq(schema.leadDistributionJobs.tenantId, scope.tenantId),
      branchLeadJoin(scope, schema.leadDistributionJobs.leadId),
    ))
    .groupBy(schema.leadDistributionJobs.lastErrorMessage);
  return buildWaitingBrokerStatus({
    groups: groups.map((group) => ({ reason: group.reason, total: Number(group.total), nextRunAfter: toDate(group.nextRunAfter) })),
    now,
  });
}

function offerScope(scope: LiveScope): SQL | undefined {
  if (scope.role === "broker") return eq(schema.leadOffers.brokerId, scope.userId);
  if (scope.role === "supervisor") return inSupervisorTeam(schema.leadOffers.brokerId, scope.tenantId, scope.userId);
  if (scope.role === "manager") return branchLeadJoin(scope, sql`${schema.leadOffers.leadId}`);
  return undefined;
}

export async function loadOffers(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const [row] = await getDatabase().select({
    total: count(),
    firstExpiresAt: sql<string | null>`min(${schema.leadOffers.expiresAt})`,
    firstOfferedAt: sql<string | null>`(array_agg(${schema.leadOffers.offeredAt} order by ${schema.leadOffers.expiresAt}))[1]`,
  })
    .from(schema.leadOffers)
    .where(and(
      eq(schema.leadOffers.tenantId, scope.tenantId),
      gte(schema.leadOffers.offeredAt, new Date(now.getTime() - 24 * HOUR)),
      inArray(schema.leadOffers.status, ACTIVE_OFFER),
      gt(schema.leadOffers.expiresAt, now),
      offerScope(scope),
    ));
  return buildOffersStatus({
    aggregate: { total: Number(row?.total ?? 0), firstExpiresAt: toDate(row?.firstExpiresAt), firstOfferedAt: toDate(row?.firstOfferedAt) },
    now,
    scope,
  });
}

export async function loadFirstContact(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const db = getDatabase();
  const [rows, [tenant]] = await Promise.all([
    db.select({ assignedAt: schema.leads.assignedAt })
      .from(schema.leads)
      // O mesmo recorte da varredura feedback-sla.ts, limitado às últimas 24 h (índice leads_tenant_assigned_live_idx).
      .where(and(
        liveLeadScope(scope),
        alive(),
        isNotNull(schema.leads.corretorId),
        eq(schema.leads.status, "distributed"),
        isNull(schema.leads.firstContactAt),
        isNull(schema.leads.serviceStartedAt),
        inArray(schema.leads.distributionStatus, ["assigned", "queued"]),
        gte(schema.leads.assignedAt, new Date(now.getTime() - 24 * HOUR)),
      ))
      .limit(1000),
    db.select({ firstContactMinutes: schema.tenants.slaFirstContactMinutes, graceMinutes: schema.tenants.feedbackGraceMinutes })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, scope.tenantId))
      .limit(1),
  ]);
  return buildFirstContactStatus({
    assignedAt: rows.flatMap((row) => (row.assignedAt ? [row.assignedAt] : [])),
    settings: {
      firstContactMinutes: Number.parseInt(tenant?.firstContactMinutes ?? "", 10) || 15,
      graceMinutes: Number.parseInt(tenant?.graceMinutes ?? "", 10) || 5,
    },
    now,
    scope,
  });
}

function dutyScope(scope: LiveScope): SQL | undefined {
  const table = schema.dutyPresenceConfirmations;
  if (scope.role === "broker") return eq(table.brokerId, scope.userId);
  if (scope.role === "supervisor") return inSupervisorTeam(table.brokerId, scope.tenantId, scope.userId);
  if (scope.role === "manager" && scope.branchId) {
    return sql`exists (select 1 from unit_duty_schedules s where s.id = ${table.scheduleId} and s.tenant_id = ${scope.tenantId} and s.branch_id = ${scope.branchId})`;
  }
  return undefined;
}

export async function loadDuty(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const today = getSaoPauloDateKey(now);
  // O turno da noite começa ontem e ainda pode estar rodando.
  const yesterday = getSaoPauloDateKey(new Date(now.getTime() - 24 * HOUR));
  const rows = await getDatabase().select({
    status: schema.dutyPresenceConfirmations.status,
    shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
    shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
  })
    .from(schema.dutyPresenceConfirmations)
    .where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, scope.tenantId),
      inArray(schema.dutyPresenceConfirmations.dutyDate, [today, yesterday]),
      gt(schema.dutyPresenceConfirmations.shiftEndsAt, now),
      dutyScope(scope),
    ))
    .limit(1000);
  return buildDutyStatus({ rows, now, scope });
}

function outboxScope(scope: LiveScope) {
  if (scope.role !== "manager" || !scope.branchId) return sql``;
  // Gestor: mensagens para leads da unidade ou para pessoas da unidade.
  return sql` and ((w.recipient_type = 'lead' and exists (select 1 from leads l where l.id = w.recipient_id and l.tenant_id = ${scope.tenantId} and l.branch_id = ${scope.branchId}))
    or (w.recipient_type = 'user' and exists (select 1 from tenant_memberships m where m.user_id = w.recipient_id and m.tenant_id = ${scope.tenantId} and m.branch_id = ${scope.branchId})))`;
}

/** Início do dia em São Paulo (sem horário de verão desde 2019). */
function startOfDaySaoPaulo(now: Date) {
  return new Date(`${getSaoPauloDateKey(now)}T00:00:00-03:00`);
}

export async function loadWhatsAppQueue(scope: LiveScope, now: Date): Promise<LiveStatus> {
  const dayStart = startOfDaySaoPaulo(now);
  const waiting = sql.raw(`w.status in (${WAITING_OUTBOX.map((status) => `'${status}'`).join(", ")})`);
  const held = sql`(w.hold_reason is not null or coalesce(w.next_attempt_at, w.scheduled_at) > ${iso(now)} + interval '1 minute')`;
  const failedToday = sql`(w.status = 'failed' and w.failed_at >= ${iso(dayStart)})`;
  const [result, heartbeats] = await Promise.all([
    getDatabase().execute(sql`
      select
        (count(*) filter (where ${waiting}))::int as waiting,
        (count(*) filter (where ${waiting} and ${held}))::int as held,
        min(coalesce(w.next_attempt_at, w.scheduled_at)) filter (where ${waiting} and ${held}) as held_until,
        min(coalesce(w.next_attempt_at, w.scheduled_at, w.created_at)) filter (where ${waiting} and not ${held}) as next_free_at,
        (count(*) filter (where ${failedToday}))::int as failed_today,
        mode() within group (order by w.provider_error_code) filter (where ${failedToday}) as top_error_code
      from whatsapp_outbound_messages w
      where w.tenant_id = ${scope.tenantId}
        and (${waiting} or ${failedToday})${outboxScope(scope)}
    `),
    readJobHeartbeats().catch(() => new Map()),
  ]);
  const list = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<Record<string, unknown>>;
  const row = list[0] ?? {};
  return buildWhatsAppQueueStatus({
    aggregate: {
      waiting: Number(row.waiting ?? 0),
      held: Number(row.held ?? 0),
      heldUntil: toDate(row.held_until),
      nextFreeAt: toDate(row.next_free_at),
      failedToday: Number(row.failed_today ?? 0),
      topErrorCode: (row.top_error_code as string | null) ?? null,
    },
    heartbeat: heartbeats.get("whatsapp") ?? null,
    now,
    scope,
  });
}

export async function loadDistributionEngineSeal(scope: LiveScope, now: Date): Promise<LiveSeal> {
  const since = new Date(now.getTime() - 24 * HOUR);
  const branch = scope.role === "manager" && scope.branchId ? scope.branchId : null;
  const leadInBranch = (column: SQL) => (branch ? sql` and exists (select 1 from leads l where l.id = ${column} and l.tenant_id = ${scope.tenantId} and l.branch_id = ${branch})` : sql``);
  const [result, heartbeats] = await Promise.all([
    getDatabase().execute(sql`
      select
        (select count(*)::int from lead_distribution_jobs j
          where j.status = 'failed' and j.tenant_id = ${scope.tenantId} and j.updated_at >= ${iso(since)}${leadInBranch(sql`j.lead_id`)}) as failed_jobs,
        (select count(*)::int from lead_effect_outbox o
          where o.status = 'failed' and o.tenant_id = ${scope.tenantId} and o.failed_at >= ${iso(since)}${leadInBranch(sql`o.lead_id`)}) as failed_effects
    `),
    readJobHeartbeats().catch(() => new Map()),
  ]);
  const list = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<Record<string, unknown>>;
  const row = list[0] ?? {};
  return buildDistributionEngineSeal({
    heartbeat: heartbeats.get("distribution") ?? null,
    failedJobs: Number(row.failed_jobs ?? 0),
    failedEffects: Number(row.failed_effects ?? 0),
    now,
    scope,
  });
}
