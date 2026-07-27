import "server-only";

import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSettings } from "@/features/system-settings/queries";

const unworkedLeadStatuses = ["new", "distributed"] as const;
const activeLeadStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type AttentionItem = {
  id: "unworked" | "stalled" | "overdue-tasks" | "pending-documents" | "webhook-errors";
  title: string;
  description: string;
  count: number;
  /** ISO timestamp because this data crosses the Server/Client boundary in the roadmap tabs. */
  oldestAt: string | null;
  href: string;
  icon: "lead" | "stalled" | "task" | "document" | "integration";
};

export type AttentionCenterData = {
  enabled: boolean;
  stagnantDays: number;
  items: AttentionItem[];
};

type Aggregate = { count: number; oldestAt: string | null };

function leadScope(tenantId: string, role: "director" | "manager" | "broker", branchId: string | null, userId: string) {
  const conditions = [eq(schema.leads.tenantId, tenantId)];
  if (role === "manager" && branchId) conditions.push(eq(schema.leads.branchId, branchId));
  if (role === "broker") conditions.push(eq(schema.leads.corretorId, userId));
  return and(...conditions);
}

function taskScope(role: "director" | "manager" | "broker", branchId: string | null, userId: string) {
  if (role === "broker") {
    return or(eq(schema.leadTasks.assignedTo, userId), eq(schema.leadTaskAssignees.userId, userId));
  }
  if (role === "manager" && branchId) return eq(schema.leads.branchId, branchId);
  return undefined;
}

function toAggregate(row: { count: number | string; oldestAt: Date | string | null }): Aggregate {
  const date = row.oldestAt instanceof Date ? row.oldestAt : row.oldestAt ? new Date(row.oldestAt) : null;
  return {
    count: Number(row.count),
    oldestAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
  };
}

export async function getAttentionCenter(): Promise<AttentionCenterData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const settings = await getSystemSettings(["feature_central_atencao_enabled", "feature_central_atencao_stagnant_days"]);
  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const enabled = settingMap.get("feature_central_atencao_enabled") !== "false";
  const stagnantDaysValue = Number(settingMap.get("feature_central_atencao_stagnant_days") ?? 3);
  const stagnantDays = Number.isInteger(stagnantDaysValue) && stagnantDaysValue > 0 ? stagnantDaysValue : 3;
  if (!enabled) return { enabled: false, stagnantDays, items: [] };

  const scope = leadScope(context.tenantId, context.role, context.branchId, context.userId);
  const assignedTaskScope = taskScope(context.role, context.branchId, context.userId);
  const now = new Date();
  const stagnantSince = new Date(now.getTime() - stagnantDays * 24 * 60 * 60 * 1000);

  const unworkedPromise = db
    .select({ count: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${schema.leads.createdAt})` })
    .from(schema.leads)
    .where(and(scope, inArray(schema.leads.status, unworkedLeadStatuses), isNull(schema.leads.serviceStartedAt)))
    .then((rows) => toAggregate(rows[0] ?? { count: 0, oldestAt: null }));

  const stalledPromise = db
    .select({ count: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${schema.leads.stageEnteredAt})` })
    .from(schema.leads)
    .where(and(scope, inArray(schema.leads.status, activeLeadStatuses), lt(schema.leads.stageEnteredAt, stagnantSince)))
    .then((rows) => toAggregate(rows[0] ?? { count: 0, oldestAt: null }));

  const overdueTasksPromise = db
    .select({ count: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${schema.leadTasks.dueAt})` })
    .from(schema.leadTasks)
    .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
    .leftJoin(schema.leadTaskAssignees, eq(schema.leadTaskAssignees.taskId, schema.leadTasks.id))
    .where(and(
      eq(schema.leadTasks.tenantId, context.tenantId),
      eq(schema.leads.tenantId, context.tenantId),
      ...(assignedTaskScope ? [assignedTaskScope] : []),
      isNull(schema.leadTasks.completedAt),
      lt(schema.leadTasks.dueAt, now)
    ))
    .then((rows) => toAggregate(rows[0] ?? { count: 0, oldestAt: null }));

  const pendingDocumentsPromise = context.role === "broker"
    ? Promise.resolve({ count: 0, oldestAt: null })
    : db
    .select({ count: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${schema.leadDocuments.createdAt})` })
    .from(schema.leadDocuments)
    .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
    .where(and(eq(schema.leadDocuments.tenantId, context.tenantId), scope, eq(schema.leadDocuments.status, "pending")))
    .then((rows) => toAggregate(rows[0] ?? { count: 0, oldestAt: null }));

  const webhookErrorsPromise = context.role !== "director"
    ? Promise.resolve({ count: 0, oldestAt: null })
    : db
        .select({ count: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${schema.webhookDeliveries.receivedAt})` })
        .from(schema.webhookDeliveries)
        .innerJoin(schema.leads, eq(schema.webhookDeliveries.leadId, schema.leads.id))
        .where(and(eq(schema.webhookDeliveries.tenantId, context.tenantId), scope, inArray(schema.webhookDeliveries.status, ["failed", "rejected"])))
        .then((rows) => toAggregate(rows[0] ?? { count: 0, oldestAt: null }));

  const [unworked, stalled, overdueTasks, pendingDocuments, webhookErrors] = await Promise.all([
    unworkedPromise,
    stalledPromise,
    overdueTasksPromise,
    pendingDocumentsPromise,
    webhookErrorsPromise,
  ]);

  const items: AttentionItem[] = [
    { id: "unworked", title: "Leads sem contato", description: "Leads novos ou distribuídos aguardando o primeiro atendimento.", ...unworked, href: "/leads?attention=unworked", icon: "lead" },
    { id: "stalled", title: "Leads estagnados", description: `Leads ativos sem avanço de etapa há mais de ${stagnantDays} dias.`, ...stalled, href: "/leads?attention=stalled", icon: "stalled" },
    { id: "overdue-tasks", title: "Tarefas vencidas", description: "Tarefas com prazo encerrado e ainda sem conclusão.", ...overdueTasks, href: "/tarefas?attention=overdue", icon: "task" },
    { id: "pending-documents", title: "Documentos pendentes", description: "Documentos enviados que ainda precisam de revisão.", ...pendingDocuments, href: "/documentos", icon: "document" },
    { id: "webhook-errors", title: "Integrações com problema", description: "Entregas de webhook rejeitadas ou com falha.", ...webhookErrors, href: "/settings?tab=integracoes", icon: "integration" },
  ];

  return { enabled: true, stagnantDays, items };
}
