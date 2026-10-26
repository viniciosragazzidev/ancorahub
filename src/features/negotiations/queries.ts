import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { computeNegotiationLevel, NEGOTIATION_LIMITS, type NegotiationLevel } from "./negotiation-model";
import { canViewNegotiationLead } from "./negotiation-scope";

const ACTIVE_STATUSES = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;
const BROKER_MESSAGE = sql`(${schema.whatsappMessages.direction} = 'outgoing' or (${schema.whatsappMessages.direction} = 'outbound' and coalesce(${schema.whatsappMessages.senderRole}, '') not in ('assistant', 'system'))) `;
const REAL_MESSAGE = sql`(${schema.whatsappMessages.mediaKind} is not null or lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) not in ('', '[text]'))`;

export type NegotiationsScope = {
  role: "director" | "manager" | "supervisor";
  branchId: string | null;
  branchName: string | null;
  branches: Array<{ id: string; name: string }>;
  supervisorId: string | null;
  scopeMessage: string | null;
};

export type NegotiationLead = {
  id: string;
  name: string;
  status: string;
  stageEnteredAt: string | null;
  daysAtStage: number | null;
  assignedAt: string | null;
  firstContactAt: string | null;
  firstContactLatencySeconds: number | null;
  brokerId: string;
  brokerName: string;
  branchId: string | null;
  branchName: string | null;
  level: NegotiationLevel;
  lastCustomerMessageAt: string | null;
  lastBrokerMessageAt: string | null;
  lastExchangeAt: string | null;
  customerWaiting: boolean;
  replyOwedBy: "broker" | "customer" | "none";
  statusBehindAi: boolean;
  hasCrmConversation: boolean;
  customerSentPdf: boolean;
  customerSentImage: boolean;
  ai: {
    conversationStage: string;
    customerIntent: string;
    pendingFrom: string | null;
    summary: string | null;
    nextBestAction: string | null;
    risk: string | null;
    objections: string[];
    buyingSignals: string[];
    lastAnalyzedAt: string | null;
  };
};

export type NegotiationTimelineEvent = {
  id: string;
  leadId: string;
  kind: "assigned" | "first_contact" | "customer_message" | "broker_message" | "document" | "status_change" | "ai_feedback";
  label: string;
  detail: string | null;
  at: string;
};

export type NegotiationBrokerStats = {
  brokerId: string;
  brokerName: string;
  total: number;
  levels: Record<NegotiationLevel, number>;
  customersWaiting: number;
  averageFirstResponseSeconds: number | null;
  averageReplySeconds: number | null;
  crmConversationPercent: number;
};

export type NegotiationDayStats = { day: string; label: string; leadsWithExchange: number; brokerMessages: number; newlyAdvanced: number; newlyClosing: number };

export type NegotiationsDashboardData = {
  generatedAt: string;
  scope: NegotiationsScope;
  leads: NegotiationLead[];
  brokers: Array<{ id: string; name: string }>;
  counts: Record<NegotiationLevel | "customers_waiting", number>;
  brokerStats: NegotiationBrokerStats[];
  dailyStats: NegotiationDayStats[];
  aiHealth: { analysesLast24Hours: number; failuresLast24Hours: number };
};

function asDate(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toIso(value: Date | string | null | undefined) {
  return asDate(value)?.toISOString() ?? null;
}

function parseAiDetails(value: unknown) {
  const details = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const raw = details.aiIntelligence && typeof details.aiIntelligence === "object" && !Array.isArray(details.aiIntelligence)
    ? details.aiIntelligence as Record<string, unknown>
    : {};
  const strings = (item: unknown) => Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === "string") : [];
  return {
    conversationStage: typeof raw.conversationStage === "string" ? raw.conversationStage : "UNKNOWN",
    customerIntent: typeof raw.customerIntent === "string" ? raw.customerIntent : "UNKNOWN",
    pendingFrom: typeof raw.pendingFrom === "string" ? raw.pendingFrom : null,
    summary: typeof raw.summary === "string" ? raw.summary : null,
    nextBestAction: typeof raw.nextBestAction === "string" ? raw.nextBestAction : null,
    risk: typeof raw.risk === "string" ? raw.risk : null,
    objections: strings(raw.objections),
    buyingSignals: strings(raw.buyingSignals),
    lastAnalyzedAt: toIso(details.aiLastAnalyzedAt as string | null | undefined),
  };
}

function localDayKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateLabel(day: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit" }).format(new Date(`${day}T12:00:00.000Z`));
}

export function canAccessNegotiations(context: TenantContext) {
  return context.role === "director" || context.role === "manager" || context.role === "supervisor";
}

function emptyData(scope: NegotiationsScope, now: Date): NegotiationsDashboardData {
  return {
    generatedAt: now.toISOString(), scope, leads: [], brokers: [],
    counts: { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0, customers_waiting: 0 },
    brokerStats: [], dailyStats: [], aiHealth: { analysesLast24Hours: 0, failuresLast24Hours: 0 },
  };
}

/** Consulta única da página: limites de tenant e equipe/unidade vêm somente do contexto autenticado. */
export async function getNegotiationsDashboard(context: TenantContext, requestedBranchId?: string | null, now = new Date()): Promise<NegotiationsDashboardData> {
  if (!canAccessNegotiations(context)) throw new Error("A área de negociações não está disponível para este papel.");

  const db = getDatabase();
  const branches = context.role === "director"
    ? await db.select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
      .orderBy(asc(schema.branches.name))
    : [];
  const branchId = context.role === "director"
    ? branches.some((branch) => branch.id === requestedBranchId) ? requestedBranchId! : null
    : context.role === "manager" ? context.branchId : null;
  const branchName = branches.find((branch) => branch.id === branchId)?.name ?? null;
  let supervisorBrokerIds: string[] | null = null;
  if (context.role === "supervisor") {
    const members = await db.select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.supervisorId, context.userId),
        eq(schema.tenantMemberships.status, "active"),
      ));
    supervisorBrokerIds = members.map((member) => member.userId);
  }
  const scope: NegotiationsScope = {
    role: context.role as NegotiationsScope["role"],
    branchId,
    branchName,
    branches,
    supervisorId: context.role === "supervisor" ? context.userId : null,
    scopeMessage: context.role === "manager" && !context.branchId
      ? "Sua conta ainda não está vinculada a uma unidade."
      : context.role === "supervisor" && supervisorBrokerIds?.length === 0
        ? "Nenhum corretor está associado à sua equipe."
        : null,
  };
  if (scope.scopeMessage) return emptyData(scope, now);

  const leadConditions = [
    eq(schema.leads.tenantId, context.tenantId),
    inArray(schema.leads.status, ACTIVE_STATUSES),
    isNotNull(schema.leads.corretorId),
    isNull(schema.leads.archivedAt),
    isNull(schema.leads.deletedAt),
  ];
  if (branchId) leadConditions.push(eq(schema.leads.branchId, branchId));
  if (context.role === "manager" && !branchId) return emptyData(scope, now);
  if (context.role === "supervisor") {
    if (!supervisorBrokerIds?.length) return emptyData(scope, now);
    leadConditions.push(inArray(schema.leads.corretorId, supervisorBrokerIds));
  }

  const brokerExists = sql<boolean>`exists (
    select 1 from ${schema.whatsappMessages} crm_msg
    where crm_msg.tenant_id = ${schema.leads.tenantId}
      and crm_msg.lead_id = ${schema.leads.id}
      and (crm_msg.direction = 'outgoing' or (crm_msg.direction = 'outbound' and coalesce(crm_msg.sender_role, '') not in ('assistant', 'system')))
      and (crm_msg.media_kind is not null or lower(trim(coalesce(crm_msg.body, ''))) not in ('', '[text]'))
  )`;
  const anyMessageExists = sql<boolean>`exists (
    select 1 from ${schema.whatsappMessages} any_msg
    where any_msg.tenant_id = ${schema.leads.tenantId}
      and any_msg.lead_id = ${schema.leads.id}
      and (any_msg.media_kind is not null or lower(trim(coalesce(any_msg.body, ''))) not in ('', '[text]'))
  )`;

  const leadRows = await db.select({
    id: schema.leads.id,
    name: schema.leads.nome,
    status: schema.leads.status,
    branchId: schema.leads.branchId,
    branchName: schema.branches.name,
    brokerId: schema.leads.corretorId,
    brokerName: schema.user.name,
    assignedAt: schema.leads.assignedAt,
    firstContactAt: schema.leads.firstContactAt,
    firstContactLatencySeconds: schema.leads.firstContactLatencySeconds,
    stageEnteredAt: schema.leads.stageEnteredAt,
    qualificationDetails: schema.leads.qualificationDetails,
    hasBrokerMessageEver: brokerExists,
    hasAnyMessageEver: anyMessageExists,
  })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.leads.branchId))
    .where(and(...leadConditions))
    .orderBy(desc(schema.leads.stageEnteredAt), asc(schema.leads.nome));

  const leadIds = leadRows.map((lead) => lead.id);
  if (!leadIds.length) {
    // A read-only audit entry keeps access to customer and AI summary data accountable without recording message content.
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "negotiations_area", entidadeId: branchId ?? context.tenantId, acao: "negotiations.viewed", createdAt: now }).catch(() => undefined);
    return emptyData(scope, now);
  }

  const since = new Date(now.getTime() - NEGOTIATION_LIMITS.messageWindowDays * 24 * 60 * 60 * 1000);
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayKey = sql<string>`to_char(${schema.whatsappMessages.sentAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  const customerAt = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${schema.whatsappMessages.direction} = 'incoming' and ${REAL_MESSAGE})`;
  const brokerAt = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${BROKER_MESSAGE} and ${REAL_MESSAGE})`;
  const messagesByLeadAndDay = await db.select({
    leadId: schema.whatsappMessages.leadId,
    day: dayKey,
    customerAt,
    brokerAt,
    brokerMessages: sql<number>`count(*) filter (where ${BROKER_MESSAGE} and ${REAL_MESSAGE})::int`,
    customerPdf: sql<boolean>`bool_or(${schema.whatsappMessages.direction} = 'incoming' and ${schema.whatsappMessages.mediaKind} = 'document' and (lower(coalesce(${schema.whatsappMessages.mediaMimeType}, '')) = 'application/pdf' or lower(coalesce(${schema.whatsappMessages.mediaFilename}, '')) like '%.pdf') and ${schema.whatsappMessages.sentAt} >= ${schema.leads.assignedAt})`,
    customerImage: sql<boolean>`bool_or(${schema.whatsappMessages.direction} = 'incoming' and ${schema.whatsappMessages.mediaKind} = 'image' and ${schema.whatsappMessages.sentAt} >= ${schema.leads.assignedAt})`,
    customerDocument: sql<boolean>`bool_or(${schema.whatsappMessages.direction} = 'incoming' and ${schema.whatsappMessages.mediaKind} = 'document' and ${schema.whatsappMessages.sentAt} >= ${schema.leads.assignedAt})`,
  })
    .from(schema.whatsappMessages)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.whatsappMessages.leadId))
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      eq(schema.leads.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, leadIds),
      gte(schema.whatsappMessages.sentAt, since),
      sql`${REAL_MESSAGE}`,
    ))
    .groupBy(schema.whatsappMessages.leadId, dayKey);

  const groupedMessages = new Map<string, typeof messagesByLeadAndDay>();
  for (const row of messagesByLeadAndDay) {
    if (!row.leadId) continue;
    const rows = groupedMessages.get(row.leadId) ?? [];
    rows.push(row);
    groupedMessages.set(row.leadId, rows);
  }

  const replyWindow = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${schema.whatsappMessages.direction} = 'incoming') over (partition by ${schema.whatsappMessages.leadId} order by ${schema.whatsappMessages.sentAt} rows between unbounded preceding and 1 preceding)`;
  const orderedMessages = db.select({
    brokerId: schema.leads.corretorId,
    leadId: schema.whatsappMessages.leadId,
    sentAt: schema.whatsappMessages.sentAt,
    lastCustomerAt: replyWindow,
    isBroker: sql<boolean>`${BROKER_MESSAGE}`,
  })
    .from(schema.whatsappMessages)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.whatsappMessages.leadId))
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      eq(schema.leads.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, leadIds),
      gte(schema.whatsappMessages.sentAt, since),
      REAL_MESSAGE,
    )).as("ordered_messages");
  const brokerReplyCandidates = db.select({
    brokerId: orderedMessages.brokerId,
    sentAt: orderedMessages.sentAt,
    lastCustomerAt: orderedMessages.lastCustomerAt,
    replyOrder: sql<number>`row_number() over (partition by ${orderedMessages.leadId}, ${orderedMessages.lastCustomerAt} order by ${orderedMessages.sentAt})`,
  })
    .from(orderedMessages)
    .where(and(eq(orderedMessages.isBroker, true), isNotNull(orderedMessages.lastCustomerAt)))
    .as("broker_reply_candidates");
  const replyRows = await db.select({
    brokerId: brokerReplyCandidates.brokerId,
    averageReplySeconds: sql<number | null>`avg(extract(epoch from (${brokerReplyCandidates.sentAt} - ${brokerReplyCandidates.lastCustomerAt})))::float8`,
  })
    .from(brokerReplyCandidates)
    .where(eq(brokerReplyCandidates.replyOrder, 1))
    .groupBy(brokerReplyCandidates.brokerId);
  const replyAverageByBroker = new Map(replyRows.filter((row): row is typeof row & { brokerId: string; averageReplySeconds: number } => Boolean(row.brokerId && row.averageReplySeconds !== null && Number.isFinite(row.averageReplySeconds) && row.averageReplySeconds >= 0)).map((row) => [row.brokerId!, { totalSeconds: row.averageReplySeconds!, count: 1 }]));

  const leads: NegotiationLead[] = [];
  const dayExchangeLeadIds = new Map<string, Set<string>>();
  const brokerMessageCounts = new Map<string, number>();
  const brokerBase = new Map<string, { name: string; total: number; crmCount: number; firstResponseSum: number; firstResponseCount: number }>();
  for (const row of leadRows) {
    if (!row.brokerId) continue;
    const daily = groupedMessages.get(row.id) ?? [];
    const latestCustomer = daily.reduce<Date | null>((latest, item) => item.customerAt && (!latest || item.customerAt > latest) ? item.customerAt : latest, null);
    const latestBroker = daily.reduce<Date | null>((latest, item) => item.brokerAt && (!latest || item.brokerAt > latest) ? item.brokerAt : latest, null);
    const fiveDayCutoff = now.getTime() - NEGOTIATION_LIMITS.exchangeHistoryDays * 24 * 60 * 60 * 1000;
    const twoWayDaysLast5 = daily.filter((item) => item.customerAt && item.brokerAt && item.customerAt.getTime() >= fiveDayCutoff && item.brokerAt.getTime() >= fiveDayCutoff).length;
    const ai = parseAiDetails(row.qualificationDetails);
    const customerSentPdf = daily.some((item) => item.customerPdf === true);
    const customerSentImage = daily.some((item) => item.customerImage === true);
    const assessment = computeNegotiationLevel({
      status: row.status,
      stageEnteredAt: row.stageEnteredAt,
      assignedAt: row.assignedAt,
      now,
      lastCustomerMessageAt: latestCustomer,
      lastBrokerMessageAt: latestBroker,
      twoWayExchangeDaysLast5: twoWayDaysLast5,
      customerSentPdf,
      customerSentImage,
      hasBrokerMessageEver: row.hasBrokerMessageEver,
      hasAnyMessageEver: row.hasAnyMessageEver,
      ai,
    });
    for (const item of daily) {
      if (item.customerAt && item.brokerAt) {
        const ids = dayExchangeLeadIds.get(item.day) ?? new Set<string>();
        ids.add(row.id);
        dayExchangeLeadIds.set(item.day, ids);
      }
      brokerMessageCounts.set(item.day, (brokerMessageCounts.get(item.day) ?? 0) + item.brokerMessages);
    }
    const baseSummary = brokerBase.get(row.brokerId) ?? { name: row.brokerName ?? "Corretor", total: 0, crmCount: 0, firstResponseSum: 0, firstResponseCount: 0 };
    baseSummary.total += 1;
    baseSummary.crmCount += row.hasAnyMessageEver ? 1 : 0;
    if (row.firstContactAt && row.firstContactAt >= since && row.firstContactLatencySeconds !== null) {
      baseSummary.firstResponseSum += row.firstContactLatencySeconds;
      baseSummary.firstResponseCount += 1;
    }
    brokerBase.set(row.brokerId, baseSummary);
    if (!assessment.level) continue;
    leads.push({
      id: row.id,
      name: row.name,
      status: row.status,
      stageEnteredAt: toIso(row.stageEnteredAt),
      daysAtStage: assessment.daysAtStage,
      assignedAt: toIso(row.assignedAt),
      firstContactAt: toIso(row.firstContactAt),
      firstContactLatencySeconds: row.firstContactLatencySeconds,
      brokerId: row.brokerId,
      brokerName: row.brokerName ?? "Corretor",
      branchId: row.branchId,
      branchName: row.branchName ?? null,
      level: assessment.level,
      lastCustomerMessageAt: toIso(latestCustomer),
      lastBrokerMessageAt: toIso(latestBroker),
      lastExchangeAt: assessment.lastExchangeAt,
      customerWaiting: assessment.customerWaiting,
      replyOwedBy: assessment.replyOwedBy,
      statusBehindAi: assessment.statusBehindAi,
      hasCrmConversation: row.hasAnyMessageEver,
      customerSentPdf,
      customerSentImage,
      ai,
    });
  }

  const counts: NegotiationsDashboardData["counts"] = { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0, customers_waiting: 0 };
  const brokerMap = new Map<string, NegotiationBrokerStats>([...brokerBase.entries()].map(([brokerId, base]) => [brokerId, {
    brokerId, brokerName: base.name, total: base.total,
    levels: { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0 },
    customersWaiting: 0, averageFirstResponseSeconds: null, averageReplySeconds: null, crmConversationPercent: base.crmCount,
  }]));
  for (const lead of leads) {
    counts[lead.level] += 1;
    if (lead.customerWaiting) counts.customers_waiting += 1;
    const broker = brokerMap.get(lead.brokerId) ?? {
      brokerId: lead.brokerId, brokerName: lead.brokerName, total: 0,
      levels: { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0 },
      customersWaiting: 0, averageFirstResponseSeconds: null, averageReplySeconds: null, crmConversationPercent: 0,
    };
    broker.levels[lead.level] += 1;
    broker.customersWaiting += lead.customerWaiting ? 1 : 0;
    brokerMap.set(lead.brokerId, broker);
  }

  const brokerStats = [...brokerMap.values()].map((broker) => {
    const first = brokerBase.get(broker.brokerId);
    const replies = replyAverageByBroker.get(broker.brokerId);
    return {
      ...broker,
      averageFirstResponseSeconds: first && first.firstResponseCount ? Math.round(first.firstResponseSum / first.firstResponseCount) : null,
      averageReplySeconds: replies && replies.count ? Math.round(replies.totalSeconds / replies.count) : null,
      crmConversationPercent: broker.total ? Math.round((broker.crmConversationPercent / broker.total) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total || a.brokerName.localeCompare(b.brokerName, "pt-BR"));

  const dailyStats: NegotiationDayStats[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    const day = localDayKey(date);
    const advanced = new Set(leads.filter((lead) => lead.level === "advanced" && lead.stageEnteredAt && localDayKey(new Date(lead.stageEnteredAt)) === day).map((lead) => lead.id));
    const closing = new Set(leads.filter((lead) => lead.level === "closing" && lead.stageEnteredAt && localDayKey(new Date(lead.stageEnteredAt)) === day).map((lead) => lead.id));
    dailyStats.push({ day, label: dateLabel(day), leadsWithExchange: dayExchangeLeadIds.get(day)?.size ?? 0, brokerMessages: brokerMessageCounts.get(day) ?? 0, newlyAdvanced: advanced.size, newlyClosing: closing.size });
  }

  const aiAuditPromise = db.select({ total: countDistinct(schema.auditLogs.id) })
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entidade, "lead_conversation_intelligence"), inArray(schema.auditLogs.entidadeId, leadIds), gte(schema.auditLogs.createdAt, since24Hours)));
  const aiFailuresPromise = db.select({ total: countDistinct(schema.aiAttendanceLogs.id) })
    .from(schema.aiAttendanceLogs)
    .where(and(
      eq(schema.aiAttendanceLogs.tenantId, context.tenantId),
      inArray(schema.aiAttendanceLogs.leadId, leadIds),
      eq(schema.aiAttendanceLogs.provider, "conversation_intelligence"),
      eq(schema.aiAttendanceLogs.status, "failed"),
      gte(schema.aiAttendanceLogs.createdAt, since24Hours),
    ));
  const [aiAudit, aiFailures] = await Promise.all([aiAuditPromise, aiFailuresPromise]);

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "negotiations_area",
    entidadeId: branchId ?? context.tenantId,
    acao: "negotiations.viewed",
    createdAt: now,
  }).catch((error) => console.warn("[negotiations] auditoria de visualização indisponível", error));

  return {
    generatedAt: now.toISOString(),
    scope,
    leads,
    brokers: [...new Map(leads.map((lead) => [lead.brokerId, { id: lead.brokerId, name: lead.brokerName }])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    counts,
    brokerStats,
    dailyStats,
    aiHealth: { analysesLast24Hours: Number(aiAudit[0]?.total ?? 0), failuresLast24Hours: Number(aiFailures[0]?.total ?? 0) },
  };
}

/** Details load only when a user opens a drawer. The visible lead is rechecked against the current session scope. */
export async function getNegotiationTimeline(context: TenantContext, leadId: string): Promise<NegotiationTimelineEvent[]> {
  if (context.role !== "director" && context.role !== "manager" && context.role !== "supervisor") {
    throw new Error("A área de negociações não está disponível para este papel.");
  }
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, brokerId: schema.leads.corretorId, brokerName: schema.user.name, assignedAt: schema.leads.assignedAt, firstContactAt: schema.leads.firstContactAt })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, context.tenantId),
      inArray(schema.leads.status, ACTIVE_STATUSES),
      isNotNull(schema.leads.corretorId),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.deletedAt),
    ))
    .limit(1);
  if (!lead) throw new Error("Lead não encontrado na área de negociações.");

  const supervisorBrokerIds = new Set<string>();
  if (context.role === "supervisor" && lead.brokerId) {
    const [member] = await db.select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, lead.brokerId),
        eq(schema.tenantMemberships.supervisorId, context.userId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
      ))
      .limit(1);
    if (member) supervisorBrokerIds.add(member.userId);
  }
  const roleScope = {
    role: context.role,
    tenantId: context.tenantId,
    branchId: context.role === "manager" ? context.branchId : null,
    supervisorId: context.role === "supervisor" ? context.userId : null,
  } as const;
  if (!canViewNegotiationLead(roleScope, lead, supervisorBrokerIds)) throw new Error("Este lead não pertence à sua unidade ou equipe.");

  const since = new Date(Date.now() - NEGOTIATION_LIMITS.messageWindowDays * 24 * 60 * 60 * 1000);
  const customerAt = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${schema.whatsappMessages.direction} = 'incoming' and ${REAL_MESSAGE})`;
  const brokerAt = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${BROKER_MESSAGE} and ${REAL_MESSAGE})`;
  const documentAt = sql<Date | null>`max(${schema.whatsappMessages.sentAt}) filter (where ${schema.whatsappMessages.direction} = 'incoming' and ${schema.whatsappMessages.mediaKind} = 'document' and ${schema.whatsappMessages.sentAt} >= ${schema.leads.assignedAt})`;
  const [messages, interactions] = await Promise.all([
    db.select({ lastCustomerAt: customerAt, lastBrokerAt: brokerAt, lastDocumentAt: documentAt })
      .from(schema.whatsappMessages)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.whatsappMessages.leadId))
      .where(and(
        eq(schema.whatsappMessages.tenantId, context.tenantId),
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.whatsappMessages.leadId, leadId),
        gte(schema.whatsappMessages.sentAt, since),
        REAL_MESSAGE,
      )),
    db.select({ id: schema.leadInteractions.id, type: schema.leadInteractions.tipo, content: schema.leadInteractions.conteudo, createdAt: schema.leadInteractions.createdAt })
      .from(schema.leadInteractions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leadInteractions.leadId, leadId),
        or(
          eq(schema.leadInteractions.tipo, "status_change"),
          and(eq(schema.leadInteractions.tipo, "system_alert"), sql`${schema.leadInteractions.conteudo} like '[IA Feedback]%'`),
        ),
      ))
      .orderBy(desc(schema.leadInteractions.createdAt))
      .limit(40),
  ]);

  const timeline: NegotiationTimelineEvent[] = [];
  const pushEvent = (id: string, kind: NegotiationTimelineEvent["kind"], label: string, at: Date | string | null | undefined, detail: string | null = null) => {
    const isoAt = toIso(at);
    if (isoAt) timeline.push({ id, leadId, kind, label, detail, at: isoAt });
  };
  pushEvent(`${leadId}:assigned`, "assigned", `Atribuído a ${lead.brokerName ?? "Corretor"}`, lead.assignedAt);
  pushEvent(`${leadId}:first-contact`, "first_contact", "Primeiro contato registrado", lead.firstContactAt);
  pushEvent(`${leadId}:customer-message`, "customer_message", "Última resposta do cliente", messages[0]?.lastCustomerAt);
  pushEvent(`${leadId}:broker-message`, "broker_message", "Última mensagem do corretor", messages[0]?.lastBrokerAt);
  pushEvent(`${leadId}:document`, "document", "Cliente enviou documento", messages[0]?.lastDocumentAt);
  for (const interaction of interactions) {
    const isAiFeedback = interaction.type === "system_alert";
    const detail = isAiFeedback ? interaction.content.replace(/^\[IA Feedback\]\s*/, "").slice(0, 1200) : interaction.content.slice(0, 500);
    pushEvent(interaction.id, isAiFeedback ? "ai_feedback" : "status_change", isAiFeedback ? "Feedback da IA" : "Mudança de status", interaction.createdAt, detail);
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "negotiations_area", entidadeId: leadId, acao: "negotiations.lead_detail_viewed", createdAt: new Date() }).catch((error) => console.warn("[negotiations] auditoria do detalhe indisponível", error));
  return timeline;
}
