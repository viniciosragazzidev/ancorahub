import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, lt, or, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { processQueuedLead } from "@/features/lead-distribution/service";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { publishRealtimeSyncSignals } from "@/features/notifications/realtime-sync";
import { isWithinBusinessHours } from "@/shared/time/business-hours";

export type FeedbackSlaResult = { checked: number; released: number; reassigned: number; notifications: number };

export async function runFeedbackSlaSweep(tenantId?: string): Promise<FeedbackSlaResult> {
  if (!isWithinBusinessHours()) return { checked: 0, released: 0, reassigned: 0, notifications: 0 };
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id, feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, autoRedistribute: schema.tenants.autoRedistributeOnFeedbackTimeout, firstContactMinutes: schema.tenants.slaFirstContactMinutes, graceMinutes: schema.tenants.feedbackGraceMinutes })
    .from(schema.tenants)
    .where(tenantId ? eq(schema.tenants.id, tenantId) : eq(schema.tenants.status, "active"));
  const result: FeedbackSlaResult = { checked: 0, released: 0, reassigned: 0, notifications: 0 };
  const notificationsEnabled = await isNotificationCapabilityEnabled("lead_feedback_overdue");

  for (const tenant of tenants) {
    if (!tenant.feedbackRequiredEnabled || !tenant.autoRedistribute) continue;
    const minutes = (Number.parseInt(tenant.firstContactMinutes, 10) || 15) + (Number.parseInt(tenant.graceMinutes, 10) || 5);
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const leads = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, distributionOrigin: schema.leads.distributionOrigin, assignmentSource: schema.leads.assignmentSource, assignedAt: schema.leads.assignedAt })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, tenant.id), eq(schema.leads.status, "distributed"), isNull(schema.leads.firstContactAt), isNull(schema.leads.serviceStartedAt), lt(schema.leads.assignedAt, cutoff), or(eq(schema.leads.distributionStatus, "assigned"), eq(schema.leads.distributionStatus, "queued"))));
    result.checked += leads.length;
    if (!leads.length) continue;
    const [actor] = await db.select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active"))).limit(1);
    if (!actor) continue;

    for (const lead of leads) {
      if (!lead.corretorId || !lead.branchId) continue;
      const brokerId = lead.corretorId;
      const now = new Date();

      // Emitir alerta de feedback pendente SEM retirar o lead do corretor nem redistribuir
      const notified = await db.transaction(async (tx) => {
        await tx.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: lead.id,
          userId: actor.userId,
          tipo: "system_alert",
          conteudo: "Alerta de SLA: Ausência de registro de primeiro contato/feedback dentro do prazo.",
        });
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: actor.userId,
          entidade: "lead",
          entidadeId: lead.id,
          acao: "lead.feedback_timeout_warning",
        });

        const notifications = notificationsEnabled
          ? [
              { id: randomUUID(), tenantId: tenant.id, userId: brokerId },
              { id: randomUUID(), tenantId: tenant.id, userId: actor.userId },
            ]
          : [];

        if (notifications.length) {
          await tx.insert(schema.notifications).values([
            { id: notifications[0].id, tenantId: tenant.id, recipientUserId: brokerId, leadId: lead.id, type: "lead_feedback_overdue", title: "Feedback pendente no Lead ⏳", message: `O lead ${lead.nome} está aguardando primeiro contato ou registro de feedback.`, createdAt: now },
            { id: notifications[1].id, tenantId: tenant.id, recipientUserId: actor.userId, leadId: lead.id, type: "lead_feedback_overdue", title: "Lead com feedback pendente", message: `O lead ${lead.nome} do corretor está sem registro de feedback dentro do SLA.`, createdAt: now },
          ]);
        }
        return notifications;
      });

      if (!notified) continue;
      void publishRealtimeSyncSignals(notified.map((notification) => ({
        tenantId: notification.tenantId,
        userId: notification.userId,
        notificationId: notification.id,
      })));
      result.notifications += notified.length;
    }
  }
  return result;
}
