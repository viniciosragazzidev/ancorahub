import "server-only";

import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lte, not, sql } from "drizzle-orm";

import {
  prioritizeBrokerWorkspace,
  type BrokerWorkspacePriority,
  type BrokerWorkspacePriorityLead,
  type BrokerWorkspacePriorityTask,
} from "@/features/broker-workspace/priority";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSaoPauloDateKey } from "@/features/lead-distribution/dated-duty-roster";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { buildBrokerWorkspaceTodayMetrics, getSaoPauloDayBounds } from "./workspace-data-domain";
import { buildDutySummary, loadBrokerDutyRows } from "./duty-summary";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";

const activeLeadStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export type DutyPresenceAsk = {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  branchName: string | null;
  mode: "online" | "presencial";
  startsAt: Date;
  endsAt: Date;
  /** awaiting_release: presencial photo sent, waiting for the director/manager to validate and release. */
  status: "pending" | "awaiting_release" | "confirmed";
  /** Confirmation id when a photo exists (the broker sees his own photo while waiting). */
  photoId: string | null;
};

export type BrokerActiveDuty = { scheduleId: string; scheduleName: string; queueName: string | null; branchName: string | null; dutyDate: string; startsAt: Date; endsAt: Date; paused: boolean; presenceStatus: "confirmed" | "pending" | "not_required"; attendanceMode?: string };

export type BrokerWorkspaceData = {
  viewer: { tenantId: string; userId: string; name: string; branchName: string; availabilityStatus: "available" | "paused" | "offline" };
  nextAction: BrokerWorkspacePriority | null;
  priorities: BrokerWorkspacePriority[];
  duty: {
    active: BrokerActiveDuty | null;
    /** Every plantão running now (a broker can be in PME and Presencial at once); the first one is `active`. */
    activeAll?: BrokerActiveDuty[];
    next: { scheduleName: string; queueName: string | null; dutyDate: string; startsAt: Date; endsAt: Date; paused: boolean } | null;
    readyToReceive: boolean;
    /** The plantão the broker must confirm now (from 30 min before until the end); null when nothing to confirm. */
    presence?: DutyPresenceAsk | null;
    /** Every active or imminent occurrence in the same confirmation window, pending first. */
    presences?: DutyPresenceAsk[];
  } | null;
  today: { awaitingResponse: number; overdueTasks: number; returnsDue: number; newLeads: number; pendingDocuments: number; pendingProposals: number; unreadNotifications: number; receivedToday: number; acceptedToday: number; inServiceNow: number; slaAtRiskNow: number };
  inbox: Array<{ id: string; source: "message" | "task" | "lead" | "document" | "proposal" | "notification"; title: string; description: string; href: string; severity: "critical" | "warning" | "normal" }>;
  agenda: Array<{ id: string; leadId: string; leadName: string; title: string; dueAt: Date | null; priority: "low" | "normal" | "urgent"; href: string }>;
  queue: Array<{ id: string; name: string; status: string; source: string; arrivedAt: Date | null; nextAction: BrokerWorkspacePriority | null }>;
  pendingOffers: Array<{ leadId: string; name: string; offeredAt: Date; expiresAt: Date; scheduleName: string | null }>;
  goal: { name: string; percentage: number; currentValue: string; targetValue: string } | null;
  updatedAt: Date;
};

export async function isBrokerWorkspaceEnabled() {
  return (await getSystemSetting("feature_broker_workspace_enabled")) !== "false";
}

function sourceForPriority(kind: BrokerWorkspacePriority["kind"]): BrokerWorkspaceData["inbox"][number]["source"] {
  if (kind === "awaiting_response") return "message";
  if (kind === "task_overdue" || kind === "return_due") return "task";
  if (kind === "document_pending") return "document";
  if (kind === "proposal_pending") return "proposal";
  return "lead";
}

function readablePriorityTitle(priority: BrokerWorkspacePriority) {
  if (priority.kind === "awaiting_response") return `Responder ${priority.title}`;
  if (priority.kind === "task_overdue" || priority.kind === "return_due") return priority.title;
  if (priority.kind === "sla_overdue" || priority.kind === "sla_risk") return `Atender ${priority.title}`;
  if (priority.kind === "new_lead") return `Novo lead: ${priority.title}`;
  if (priority.kind === "proposal_pending") return `Retomar cotação: ${priority.title}`;
  if (priority.kind === "document_pending") return `Documentos: ${priority.title}`;
  return `Retomar negociação: ${priority.title}`;
}

function parseSlaMinutes(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 15;
}

/**
 * One server-side contract for the broker home. Scope is derived solely from
 * the authenticated tenant context; it deliberately has no client parameters.
 */
export async function getBrokerWorkspaceData(): Promise<BrokerWorkspaceData> {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") throw new Error("O Workspace do Corretor é exclusivo para este papel.");

  const db = getDatabase();
  const now = new Date();
  const { start: todayStart, end: tomorrowStart } = getSaoPauloDayBounds(now);
  const todayKey = getSaoPauloDateKey(now);
  const [profile, leads, dutyInputs, todayCountRows, pendingOfferRows] = await Promise.all([
    db
      .select({
        name: schema.user.name,
        branchName: schema.branches.name,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .innerJoin(schema.tenants, eq(schema.tenantMemberships.tenantId, schema.tenants.id))
      .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId)))
      .limit(1),
    db
      .select({
        id: schema.leads.id,
        name: schema.leads.nome,
        status: schema.leads.status,
        source: schema.leads.origem,
        createdAt: schema.leads.createdAt,
        assignedAt: schema.leads.assignedAt,
        firstContactAt: schema.leads.firstContactAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt), not(ilike(schema.leads.nome, "Lead WhatsApp (%)")), inArray(schema.leads.status, activeLeadStatuses)))
      .orderBy(sql`${schema.leads.assignedAt} desc nulls last`, asc(schema.leads.id))
      .limit(200),
    loadBrokerDutyRows({ tenantId: context.tenantId, brokerId: context.userId, now, fromDateKey: todayKey }),
    db.select({
      receivedToday: sql<number>`(
        select count(*)::int from ${schema.leads}
        where ${schema.leads.tenantId} = ${context.tenantId}
          and ${schema.leads.corretorId} = ${context.userId}
          and ${schema.leads.deletedAt} is null
          and ${schema.leads.archivedAt} is null
          and ${schema.leads.assignedAt} >= ${todayStart.toISOString()}
          and ${schema.leads.assignedAt} < ${tomorrowStart.toISOString()}
      )`,
      acceptedToday: sql<number>`(
        select count(*)::int from ${schema.leadOffers}
        where ${schema.leadOffers.tenantId} = ${context.tenantId}
          and ${schema.leadOffers.brokerId} = ${context.userId}
          and ${schema.leadOffers.acceptedAt} >= ${todayStart.toISOString()}
          and ${schema.leadOffers.acceptedAt} < ${tomorrowStart.toISOString()}
      )`,
      inServiceNow: sql<number>`(
        select count(*)::int from ${schema.leads}
        where ${schema.leads.tenantId} = ${context.tenantId}
          and ${schema.leads.corretorId} = ${context.userId}
          and ${schema.leads.deletedAt} is null
          and ${schema.leads.status} in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
      )`,
      monthlySchedulingEnabled: sql<string>`coalesce((select ${schema.systemSettings.value} from ${schema.systemSettings} where ${schema.systemSettings.key} = ${FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING.key}), ${FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING.defaultValue})`,
      presenceConfirmationEnabled: sql<string>`coalesce((select ${schema.systemSettings.value} from ${schema.systemSettings} where ${schema.systemSettings.key} = ${FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION.key}), ${FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION.defaultValue})`,
    }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId)))
      .limit(1),
    db.select({
      leadId: schema.leadOffers.leadId,
      name: schema.leads.nome,
      offeredAt: schema.leadOffers.offeredAt,
      expiresAt: schema.leadOffers.expiresAt,
      scheduleName: schema.unitDutySchedules.name,
    })
      .from(schema.leadOffers)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, schema.leadOffers.tenantId)))
      .leftJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leadOffers.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, schema.leadOffers.tenantId)))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.brokerId, context.userId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        gt(schema.leadOffers.expiresAt, now),
        isNull(schema.leads.deletedAt),
      ))
      .orderBy(asc(schema.leadOffers.expiresAt))
      .limit(20),
  ]);

  const leadIds = leads.map((lead) => lead.id);
  // The latest message of each active lead, one index probe per lead (lateral
  // + limit 1): the old row_number() window read the whole history of up to
  // 200 conversations on every Início render and realtime refresh.
  const latestMessage = db
    .select({ direction: schema.whatsappMessages.direction, sentAt: schema.whatsappMessages.sentAt })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      eq(schema.whatsappMessages.leadId, schema.leads.id),
      // A story the client posted (status@broadcast) is not the client waiting.
      notStatusBroadcastSql(schema.whatsappMessages.messageId),
      // Contentless WhatsApp events ("[text]", hidden in the conversation) are not the client waiting.
      sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(1)
    .as("workspace_latest_message");

  // Duty summary, latest messages and the per-lead supplements are independent:
  // one wave of queries instead of three sequential ones.
  const [duty, latestMessages, [tasks, documents, quotes, goals, notifications]] = await Promise.all([
    buildDutySummary({
      tenantId: context.tenantId,
      rows: dutyInputs.rows,
      publishedRows: dutyInputs.publishedRows,
      now,
      monthlySchedulingEnabled: todayCountRows[0]?.monthlySchedulingEnabled === "true",
      presenceRequired: todayCountRows[0]?.presenceConfirmationEnabled === "true",
      availabilityStatus: profile[0]?.availabilityStatus ?? "available",
    }),
    leadIds.length
      ? db
        .select({ leadId: schema.leads.id, direction: latestMessage.direction, sentAt: latestMessage.sentAt })
        .from(schema.leads)
        .innerJoinLateral(latestMessage, sql`true`)
        .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds)))
      : Promise.resolve([] as { leadId: string; direction: string; sentAt: Date }[]),
    Promise.all([
      db
        .select({ id: schema.leadTasks.id, leadId: schema.leadTasks.leadId, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt, priority: schema.leadTasks.priority, createdAt: schema.leadTasks.createdAt })
        .from(schema.leadTasks)
        .where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.assignedTo, context.userId), isNull(schema.leadTasks.completedAt)))
        .orderBy(asc(schema.leadTasks.dueAt), desc(schema.leadTasks.createdAt))
        .limit(30),
      leadIds.length
        ? db.select({ leadId: schema.leadDocuments.leadId }).from(schema.leadDocuments).where(and(eq(schema.leadDocuments.tenantId, context.tenantId), inArray(schema.leadDocuments.leadId, leadIds), eq(schema.leadDocuments.status, "pending"), isNull(schema.leadDocuments.deletedAt)))
        : Promise.resolve([] as { leadId: string }[]),
      leadIds.length
        ? db.select({ leadId: schema.quotes.leadId }).from(schema.quotes).where(and(eq(schema.quotes.tenantId, context.tenantId), inArray(schema.quotes.leadId, leadIds), inArray(schema.quotes.status, ["shared", "sent"])))
        : Promise.resolve([] as { leadId: string }[]),
      db
        .select({ name: schema.goals.name, targetValue: schema.goals.targetValue, currentValue: schema.goalProgress.currentValue, percentage: schema.goalProgress.percentage })
        .from(schema.goals)
        .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
        .where(and(eq(schema.goals.tenantId, context.tenantId), eq(schema.goals.scope, "broker"), eq(schema.goals.scopeId, context.userId), eq(schema.goals.active, true), lte(schema.goals.startDate, now), gte(schema.goals.endDate, now)))
        .orderBy(asc(schema.goals.endDate))
        .limit(1),
      db
        .select({ id: schema.notifications.id, title: schema.notifications.title, message: schema.notifications.message, leadId: schema.notifications.leadId, readAt: schema.notifications.readAt, createdAt: schema.notifications.createdAt })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId)))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(8),
    ]),
  ]);

  const latestMessageByLead = new Map<string, { direction: string; sentAt: Date }>();
  for (const message of latestMessages) {
    if (message.leadId && !latestMessageByLead.has(message.leadId)) {
      latestMessageByLead.set(message.leadId, { direction: message.direction, sentAt: message.sentAt });
    }
  }


  const pendingDocumentsByLead = new Map<string, number>();
  for (const document of documents) pendingDocumentsByLead.set(document.leadId, (pendingDocumentsByLead.get(document.leadId) ?? 0) + 1);
  const pendingQuotesByLead = new Set(quotes.map((quote) => quote.leadId));

  const priorityLeads: BrokerWorkspacePriorityLead[] = leads.map((lead) => {
    const latestMessage = latestMessageByLead.get(lead.id);
    return {
      ...lead,
      lastIncomingAt: latestMessage?.direction === "incoming" ? latestMessage.sentAt : null,
      hasPendingQuote: pendingQuotesByLead.has(lead.id),
      pendingDocumentCount: pendingDocumentsByLead.get(lead.id) ?? 0,
    };
  });
  const priorityTasks: BrokerWorkspacePriorityTask[] = tasks.map((task) => ({ ...task, priority: task.priority as BrokerWorkspacePriorityTask["priority"] }));
  const priorities = prioritizeBrokerWorkspace({ leads: priorityLeads, tasks: priorityTasks, slaFirstContactMinutes: parseSlaMinutes(profile[0]?.slaFirstContactMinutes) });
  const priorityByLead = new Map<string, BrokerWorkspacePriority>();
  for (const priority of priorities) if (!priorityByLead.has(priority.leadId)) priorityByLead.set(priority.leadId, priority);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);

  const inbox = [
    ...priorities.slice(0, 6).map((priority) => ({
      id: `${priority.kind}-${priority.taskId ?? priority.leadId}`,
      source: sourceForPriority(priority.kind),
      title: readablePriorityTitle(priority),
      description: priority.description,
      href: priority.href,
      severity: priority.severity,
    })),
    ...unreadNotifications.slice(0, 3).map((notification) => ({
      id: `notification-${notification.id}`,
      source: "notification" as const,
      title: notification.title,
      description: notification.message,
      href: notification.leadId ? `/leads/${notification.leadId}` : "/notificacoes",
      severity: "normal" as const,
    })),
  ].slice(0, 8);

  const pendingOffers = pendingOfferRows.map((offer) => ({
    leadId: offer.leadId,
    name: offer.name,
    offeredAt: offer.offeredAt,
    expiresAt: offer.expiresAt,
    scheduleName: offer.scheduleName,
  }));
  const pendingOfferByLead = new Map<string, (typeof pendingOffers)[number]>();
  for (const offer of pendingOffers) if (!pendingOfferByLead.has(offer.leadId)) pendingOfferByLead.set(offer.leadId, offer);
  const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));
  // Order of arrival to this broker (offer time while pending, then the
  // acceptance/assignment), newest first. No priority or score: brokers asked
  // to read the list as the leads came (21/10); the screen splits it by day.
  const arrivalOf = (lead: (typeof leads)[number]) => pendingOfferByLead.get(lead.id)?.offeredAt ?? lead.assignedAt ?? null;
  const arrivedToday = (lead: (typeof leads)[number]) => {
    const arrivedAt = arrivalOf(lead);
    return Boolean(arrivedAt && arrivedAt >= todayStart && arrivedAt < tomorrowStart);
  };
  const todayLeadIds = new Set(leads.filter(arrivedToday).map((lead) => lead.id));
  const queue = [...leads]
    .sort((left, right) => {
      const arrivedLeft = arrivalOf(left)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const arrivedRight = arrivalOf(right)?.getTime() ?? Number.NEGATIVE_INFINITY;
      if (arrivedLeft !== arrivedRight) return arrivedRight - arrivedLeft;
      return left.name.localeCompare(right.name, "pt-BR");
    })
    .slice(0, 50)
    .map((lead) => ({ id: lead.id, name: lead.name, status: lead.status, source: lead.source, arrivedAt: arrivalOf(lead), nextAction: priorityByLead.get(lead.id) ?? null }));

  return {
    viewer: {
      tenantId: context.tenantId,
      userId: context.userId,
      name: profile[0]?.name ?? "Corretor",
      branchName: profile[0]?.branchName ?? "Unidade não identificada",
      availabilityStatus: profile[0]?.availabilityStatus ?? "available",
    },
    nextAction: (queue.find((lead) => todayLeadIds.has(lead.id) && lead.nextAction)?.nextAction) ?? priorities[0] ?? null,
    priorities,
    today: {
      awaitingResponse: new Set(priorities.filter((priority) => priority.kind === "awaiting_response").map((priority) => priority.leadId)).size,
      overdueTasks: priorities.filter((priority) => priority.kind === "task_overdue").length,
      returnsDue: priorities.filter((priority) => priority.kind === "return_due" && priority.dueAt && priority.dueAt.getTime() <= now.getTime() + 24 * 60 * 60 * 1000).length,
      newLeads: new Set(priorities.filter((priority) => priority.kind === "new_lead").map((priority) => priority.leadId)).size,
      pendingDocuments: documents.length,
      pendingProposals: quotes.length,
      unreadNotifications: unreadNotifications.length,
      ...buildBrokerWorkspaceTodayMetrics(todayCountRows[0] ?? { receivedToday: 0, acceptedToday: 0, inServiceNow: 0 }, priorities),
    },
    duty,
    inbox,
    agenda: tasks.map((task) => ({ id: task.id, leadId: task.leadId, leadName: leadNameById.get(task.leadId) ?? "Lead", title: task.title, dueAt: task.dueAt, priority: task.priority as BrokerWorkspacePriorityTask["priority"], href: `/leads/${task.leadId}#tarefas` })),
    queue,
    pendingOffers,
    goal: goals[0] ? { name: goals[0].name, percentage: Number(goals[0].percentage ?? 0), currentValue: String(goals[0].currentValue ?? "0"), targetValue: String(goals[0].targetValue) } : null,
    updatedAt: now,
  };
}
