import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import {
  prioritizeBrokerWorkspace,
  type BrokerWorkspacePriority,
  type BrokerWorkspacePriorityLead,
  type BrokerWorkspacePriorityTask,
} from "@/features/broker-workspace/priority";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const activeLeadStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export type BrokerWorkspaceData = {
  viewer: { tenantId: string; userId: string; name: string; branchName: string; availabilityStatus: "available" | "paused" | "offline" };
  nextAction: BrokerWorkspacePriority | null;
  today: { awaitingResponse: number; overdueTasks: number; returnsDue: number; newLeads: number; pendingDocuments: number; pendingProposals: number; unreadNotifications: number };
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
  const [profile, leads] = await Promise.all([
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
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), inArray(schema.leads.status, activeLeadStatuses)))
      .orderBy(desc(schema.leads.createdAt))
      .limit(200),
  ]);

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
  const queue = [...leads]
    .sort((left, right) => {
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
    nextAction: priorities[0] ?? null,
    today: {
      awaitingResponse: new Set(priorities.filter((priority) => priority.kind === "awaiting_response").map((priority) => priority.leadId)).size,
      overdueTasks: priorities.filter((priority) => priority.kind === "task_overdue").length,
      returnsDue: priorities.filter((priority) => priority.kind === "return_due" && priority.dueAt && priority.dueAt.getTime() <= now.getTime() + 24 * 60 * 60 * 1000).length,
      newLeads: new Set(priorities.filter((priority) => priority.kind === "new_lead").map((priority) => priority.leadId)).size,
      pendingDocuments: documents.length,
      pendingProposals: quotes.length,
      unreadNotifications: unreadNotifications.length,
    },
    inbox,
    agenda: tasks.slice(0, 6).map((task) => ({ id: task.id, leadId: task.leadId, leadName: leadNameById.get(task.leadId) ?? "Lead", title: task.title, dueAt: task.dueAt, priority: task.priority as BrokerWorkspacePriorityTask["priority"], href: `/leads/${task.leadId}#tarefas` })),
    queue,
    goal: goals[0] ? { name: goals[0].name, percentage: Number(goals[0].percentage ?? 0), currentValue: String(goals[0].currentValue ?? "0"), targetValue: String(goals[0].targetValue) } : null,
    updatedAt: now,
  };
}
