import "server-only";

import { and, asc, count, desc, eq, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { canSeeTeamTasks } from "./task-due-groups";
import type { TaskListFilters, TaskListScope } from "./task-list-filters";

export type { TaskListFilters, TaskListScope, TaskListSituation } from "./task-list-filters";

export const TASKS_PAGE_SIZE = 50;

export type TaskListRow = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "urgent";
  dueAt: string | null;
  completedAt: string | null;
  leadId: string;
  leadName: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export type TaskListResult = {
  rows: TaskListRow[];
  total: number;
  /** Abertas com prazo vencido no mesmo escopo e responsável (independe da situação escolhida). */
  overdue: number;
  assignees: { id: string; name: string }[];
};

/**
 * Escopo do papel sobre as tarefas. "Minhas": as atribuídas ao usuário. "Da equipe": as dos leads que o papel
 * enxerga nos relatórios (diretor: empresa; gestor: unidade; supervisor: corretores da equipe), sempre no tenant.
 */
async function scopeConditions(context: TenantContext, scope: TaskListScope): Promise<SQL[]> {
  const conditions: SQL[] = [eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)];
  if (scope === "minhas" || !canSeeTeamTasks(context.role)) {
    conditions.push(eq(schema.leadTasks.assignedTo, context.userId));
    return conditions;
  }
  const reportScope = await resolveReportDataScope(context);
  if (reportScope.leadScope) conditions.push(reportScope.leadScope);
  return conditions;
}

export async function getTaskList(context: TenantContext, filters: TaskListFilters, now: Date = new Date()): Promise<TaskListResult> {
  const db = getDatabase();
  const scoped = await scopeConditions(context, filters.scope);
  const byAssignee = filters.assigneeId ? [eq(schema.leadTasks.assignedTo, filters.assigneeId)] : [];
  const situation = filters.situation === "concluidas" ? isNotNull(schema.leadTasks.completedAt) : isNull(schema.leadTasks.completedAt);
  const where = and(...scoped, ...byAssignee, situation);
  const overdueWhere = and(...scoped, ...byAssignee, isNull(schema.leadTasks.completedAt), lt(schema.leadTasks.dueAt, now));
  const order = filters.situation === "concluidas"
    ? [desc(schema.leadTasks.completedAt), desc(schema.leadTasks.createdAt)]
    : [sql`${schema.leadTasks.dueAt} asc nulls last`, desc(schema.leadTasks.createdAt)];
  const join = eq(schema.leads.id, schema.leadTasks.leadId);

  const [rows, totalRows, overdueRows, assigneeRows] = await Promise.all([
    db.select({
      id: schema.leadTasks.id,
      title: schema.leadTasks.title,
      description: schema.leadTasks.description,
      priority: schema.leadTasks.priority,
      dueAt: schema.leadTasks.dueAt,
      completedAt: schema.leadTasks.completedAt,
      leadId: schema.leadTasks.leadId,
      leadName: schema.leads.nome,
      assigneeId: schema.leadTasks.assignedTo,
      assigneeName: schema.user.name,
    })
      .from(schema.leadTasks)
      .innerJoin(schema.leads, join)
      .leftJoin(schema.user, eq(schema.user.id, schema.leadTasks.assignedTo))
      .where(where)
      .orderBy(...order)
      .limit(TASKS_PAGE_SIZE)
      .offset((filters.page - 1) * TASKS_PAGE_SIZE),
    db.select({ total: count(schema.leadTasks.id) }).from(schema.leadTasks).innerJoin(schema.leads, join).where(where),
    db.select({ total: count(schema.leadTasks.id) }).from(schema.leadTasks).innerJoin(schema.leads, join).where(overdueWhere),
    filters.scope === "equipe"
      ? db.selectDistinct({ id: schema.user.id, name: schema.user.name })
        .from(schema.leadTasks)
        .innerJoin(schema.leads, join)
        .innerJoin(schema.user, eq(schema.user.id, schema.leadTasks.assignedTo))
        .where(and(...scoped))
        .orderBy(asc(schema.user.name))
        .limit(200)
      : Promise.resolve([] as { id: string; name: string | null }[]),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority as TaskListRow["priority"],
      dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      leadId: row.leadId,
      leadName: row.leadName,
      assigneeId: row.assigneeId,
      assigneeName: row.assigneeName,
    })),
    total: Number(totalRows[0]?.total ?? 0),
    overdue: Number(overdueRows[0]?.total ?? 0),
    assignees: assigneeRows.map((row) => ({ id: row.id, name: row.name ?? "Sem nome" })),
  };
}
