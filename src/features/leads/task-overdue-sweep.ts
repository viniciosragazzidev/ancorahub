import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, eq, gte, inArray, isNull, lt } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { publishNotification } from "@/features/notifications/send-push-helper";

export type TaskOverdueSweepResult = {
  tenants: number;
  overdue: number;
  notifications: number;
};

/**
 * Sweep for overdue tasks and notify assignees.
 *
 * Processes each tenant independently. When `tenantId` is provided,
 * only that tenant is processed.
 */
export async function runTaskOverdueSweep(tenantId?: string): Promise<TaskOverdueSweepResult> {
  if (!(await isNotificationCapabilityEnabled("task_overdue"))) {
    return { tenants: 0, overdue: 0, notifications: 0 };
  }

  const db = getDatabase();
  const now = new Date();

  const tenants = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(tenantId ? eq(schema.tenants.id, tenantId) : eq(schema.tenants.status, "active"));

  let totalOverdue = 0;
  let totalNotifications = 0;

  for (const tenant of tenants) {
    // Find all overdue tasks (dueAt in the past, not completed)
    const overdueTasks = await db
      .select({
        id: schema.leadTasks.id,
        title: schema.leadTasks.title,
        leadId: schema.leadTasks.leadId,
        assignedTo: schema.leadTasks.assignedTo,
        leadName: schema.leads.nome,
      })
      .from(schema.leadTasks)
      .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leadTasks.tenantId, tenant.id),
          isNull(schema.leadTasks.completedAt),
          lt(schema.leadTasks.dueAt, now),
        ),
      );

    if (!overdueTasks.length) continue;

    totalOverdue += overdueTasks.length;

    // Deduplicate — check if we already sent a notification in the last 24h
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const existing = await db
      .select({
        leadId: schema.notifications.leadId,
        recipientUserId: schema.notifications.recipientUserId,
        count: count(schema.notifications.id),
      })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.type, "task_overdue"),
          eq(schema.notifications.tenantId, tenant.id),
          inArray(
            schema.notifications.leadId,
            overdueTasks.map((t) => t.leadId),
          ),
          gte(schema.notifications.createdAt, twentyFourHoursAgo),
        ),
      )
      .groupBy(schema.notifications.leadId, schema.notifications.recipientUserId);

    const recentKeys = new Set(
      existing.map((r) => `${r.leadId}:${r.recipientUserId}`),
    );

    // Notify each assignee (only if not already notified in the last 24h)
    for (const task of overdueTasks) {
      if (!task.assignedTo) continue;
      const key = `${task.leadId}:${task.assignedTo}`;
      if (recentKeys.has(key)) continue;
      recentKeys.add(key);

      void publishNotification({
        capability: "task_overdue",
        tenantId: tenant.id,
        recipientUserId: task.assignedTo,
        leadId: task.leadId,
        type: "task_overdue",
        title: "Tarefa vencida ⏰",
        message: `A tarefa \"${task.title}\" do lead ${task.leadName} está com prazo vencido.`,
        pushTitle: "Tarefa Vencida! ⏰",
        pushBody: `\"${task.title}\" — ${task.leadName}. Prazo expirado.`,
        url: `/leads/${task.leadId}`,
        tag: `task-${task.id}`,
      }).catch(() => { /* non-blocking */ });

      totalNotifications += 1;
    }
  }

  return { tenants: tenants.length, overdue: totalOverdue, notifications: totalNotifications };
}
