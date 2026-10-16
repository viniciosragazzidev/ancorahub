import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, not, sql } from "drizzle-orm";

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
  duty: {
    active: BrokerActiveDuty | null;
    /** Every plantão running now (a broker can be in PME and Presencial at once); the first one is `active`. */
    activeAll?: BrokerActiveDuty[];
    next: { scheduleName: string; queueName: string | null; dutyDate: string; startsAt: Date; endsAt: Date; paused: boolean } | null;
    readyToReceive: boolean;
    /** The plantão the broker must confirm now (from 30 min before until the end); null when nothing to confirm. */
    presence?: DutyPresenceAsk | null;
  } | null;
  today: { awaitingResponse: number; overdueTasks: number; returnsDue: number; newLeads: number; pendingDocuments: number; pendingProposals: number; unreadNotifications: number; receivedToday: number; acceptedToday: number; inServiceNow: number; slaAtRiskNow: number };
  inbox: Array<{ id: string; source: "message" | "task" | "lead" | "document" | "proposal" | "notification"; title: string; description: string; href: string; severity: "critical" | "warning" | "normal" }>;
  agenda: Array<{ id: string; leadId: string; leadName: string; title: string; dueAt: Date | null; priority: "low" | "normal" | "urgent"; href: string }>;
  queue: Array<{ id: string; name: string; status: string; source: string; nextAction: BrokerWorkspacePriority | null }>;
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
  const [profile, leads, dutyInputs, todayCountRows] = await Promise.all([
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
      .orderBy(desc(schema.leads.createdAt))
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
  ]);

  const duty = await buildDutySummary({
    tenantId: context.tenantId,
    rows: dutyInputs.rows,
    publishedRows: dutyInputs.publishedRows,
    now,
    monthlySchedulingEnabled: todayCountRows[0]?.monthlySchedulingEnabled === "true",
    presenceRequired: todayCountRows[0]?.presenceConfirmationEnabled === "true",
    availabilityStatus: profile[0]?.availabilityStatus ?? "available",
  });

  const leadIds = leads.map((lead) => lead.id);
  const latestMessagesSubquery = leadIds.length
    ? db
      .select({
        leadId: schema.whatsappMessages.leadId,
        direction: schema.whatsappMessages.direction,
        sentAt: schema.whatsappMessages.sentAt,
        rowNumber: sql<number>`row_number() over (partition by ${schema.whatsappMessages.leadId} order by ${schema.whatsappMessages.sentAt} desc)`.as("row_number"),
      })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), inArray(schema.whatsappMessages.leadId, leadIds)))
      .as("workspace_latest_messages")
    : null;
  const latestMessages = latestMessagesSubquery
    ? await db.select({ leadId: latestMessagesSubquery.leadId, direction: latestMessagesSubquery.direction, sentAt: latestMessagesSubquery.sentAt }).from(latestMessagesSubquery).where(eq(latestMessagesSubquery.rowNumber, 1))
    : [];

  const latestMessageByLead = new Map<string, { direction: string; sentAt: Date }>();
  for (const message of latestMessages) {
    if (message.leadId && !latestMessageByLead.has(message.leadId)) {
      latestMessageByLead.set(message.leadId, { direction: message.direction, sentAt: message.sentAt });
    }
  }

  const [tasks, documents, quotes, goals, notifications] = await Promise.all([
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
  ]);

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
  const priorityRankByLead = new Map<string, number>();
  for (const [index, priority] of priorities.entries()) {
    if (!priorityByLead.has(priority.leadId)) {
      priorityByLead.set(priority.leadId, priority);
      priorityRankByLead.set(priority.leadId, index);
    }
  }
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

  const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));
  // Leads that reached the broker today come first, newest first: older leads
  // with a pending reply were taking the top and brokers lost today's arrivals.
  const arrivalOf = (lead: (typeof leads)[number]) => (lead.assignedAt ?? lead.createdAt).getTime();
  const arrivedToday = (lead: (typeof leads)[number]) => arrivalOf(lead) >= todayStart.getTime();
  const todayLeadIds = new Set(leads.filter(arrivedToday).map((lead) => lead.id));
  const queue = [...leads]
    .sort((left, right) => {
      const todayLeft = arrivedToday(left);
      const todayRight = arrivedToday(right);
      if (todayLeft !== todayRight) return todayLeft ? -1 : 1;
      if (todayLeft) return arrivalOf(right) - arrivalOf(left);
      const normalizedLeft = priorityRankByLead.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const normalizedRight = priorityRankByLead.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return normalizedLeft !== normalizedRight ? normalizedLeft - normalizedRight : right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, 8)
    .map((lead) => ({ id: lead.id, name: lead.name, status: lead.status, source: lead.source, nextAction: priorityByLead.get(lead.id) ?? null }));

  return {
    viewer: {
      tenantId: context.tenantId,
      userId: context.userId,
      name: profile[0]?.name ?? "Corretor",
      branchName: profile[0]?.branchName ?? "Unidade não identificada",
      availabilityStatus: profile[0]?.availabilityStatus ?? "available",
    },
    nextAction: (queue.find((lead) => todayLeadIds.has(lead.id) && lead.nextAction)?.nextAction) ?? priorities[0] ?? null,
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
    agenda: tasks.slice(0, 6).map((task) => ({ id: task.id, leadId: task.leadId, leadName: leadNameById.get(task.leadId) ?? "Lead", title: task.title, dueAt: task.dueAt, priority: task.priority as BrokerWorkspacePriorityTask["priority"], href: `/leads/${task.leadId}#tarefas` })),
    queue,
    goal: goals[0] ? { name: goals[0].name, percentage: Number(goals[0].percentage ?? 0), currentValue: String(goals[0].currentValue ?? "0"), targetValue: String(goals[0].targetValue) } : null,
    updatedAt: now,
  };
}
