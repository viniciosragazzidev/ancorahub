import "server-only";

import { and, count, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { enqueueMetaTemplateMessage } from "@/features/communication-channels/outbound-service";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

const activeStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;
const MAX_DAILY_FEEDBACK_REMINDERS = 2;

export type FeedbackReminderResult = {
  reminders: number;
  tenants: number;
  skipped: number;
  escalated: number;
};

/**
 * Create feedback reminders for leads that haven't been updated recently.
 *
 * Processes each tenant independently with its own configurable interval,
 * max attempt count, and channel flags (push / toast).
 *
 * When `tenantId` is provided, only that tenant is processed.
 */
export async function createLeadFeedbackReminders(tenantId?: string): Promise<FeedbackReminderResult> {
  if (!(await isNotificationCapabilityEnabled("lead_feedback_reminder"))) {
    return { reminders: 0, tenants: 0, skipped: 0, escalated: 0 };
  }

  const db = getDatabase();
  const now = new Date();

  const tenants = await db
    .select({
      id: schema.tenants.id,
      reminderIntervalMinutes: schema.tenants.feedbackReminderIntervalMinutes,
      maxAttempts: schema.tenants.feedbackReminderMaxAttempts,
      pushEnabled: schema.tenants.feedbackPushEnabled,
      toastEnabled: schema.tenants.feedbackToastEnabled,
      slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes,
    })
    .from(schema.tenants)
    .where(tenantId ? eq(schema.tenants.id, tenantId) : eq(schema.tenants.status, "active"));

  let totalReminders = 0;
  let totalSkipped = 0;
  let totalEscalated = 0;

  for (const tenant of tenants) {
    if (!tenant.toastEnabled && !tenant.pushEnabled) {
      totalSkipped += 1;
      continue;
    }

    const intervalMinutes = Math.max(Number.parseInt(tenant.reminderIntervalMinutes, 10) || 30, 1);
    const maxAttempts = Math.max(tenant.maxAttempts || 5, 1);
    const slaFirstContactMinutes = Math.max(Number.parseInt(tenant.slaFirstContactMinutes, 10) || 15, 1);
    // For unworked (distributed) leads, use a shorter interval so the
    // reminder fires BEFORE the SLA sweep redistributes the lead.
    const distributedIntervalMinutes = Math.max(1, Math.floor(slaFirstContactMinutes / 2));
    const distributedMaxAttempts = 2; // only 2 reminders before SLA expires
    let tenantEscalated = 0;

    const cutoff = new Date(now.getTime() - intervalMinutes * 60 * 1000);
    const distributedCutoff = new Date(now.getTime() - distributedIntervalMinutes * 60 * 1000);

    // Leads in active statuses (post-first-contact) — regular feedback reminders
    const activeLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        corretorId: schema.leads.corretorId,
        tenantId: schema.leads.tenantId,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenant.id),
          inArray(schema.leads.status, [...activeStatuses]),
          isNotNull(schema.leads.corretorId),
          lt(schema.leads.stageEnteredAt, cutoff),
        ),
      );

    // Leads in distributed status (pre-first-contact) — SLA warnings
    const distributedLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        corretorId: schema.leads.corretorId,
        tenantId: schema.leads.tenantId,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenant.id),
          eq(schema.leads.status, "distributed"),
          isNotNull(schema.leads.corretorId),
          isNotNull(schema.leads.assignedAt),
          lt(schema.leads.assignedAt, distributedCutoff),
        ),
      );

    const leads = [...activeLeads, ...distributedLeads];

    if (!leads.length) continue;

    // Count existing reminders sent within a window wide enough for
    // maxAttempts reminders to accumulate (intervalMinutes × maxAttempts).
    // Without this, active leads (maxAttempts=5) would never escalate because
    // only 2-3 reminders fit inside the interval window with a 15-minute cron.
    const reminderCountWindow = intervalMinutes * maxAttempts;
    const existingReminders = await db
      .select({
        leadId: schema.notifications.leadId,
        recipientUserId: schema.notifications.recipientUserId,
        count: count(schema.notifications.id),
      })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.type, "lead_feedback_reminder"),
          eq(schema.notifications.tenantId, tenant.id),
          inArray(
            schema.notifications.leadId,
            leads.map((l) => l.id),
          ),
          gte(schema.notifications.createdAt, new Date(now.getTime() - reminderCountWindow * 60 * 1000)),
        ),
      )
      .groupBy(schema.notifications.leadId, schema.notifications.recipientUserId);

    const sentCounts = new Map(
      existingReminders.map((r) => [`${r.leadId}:${r.recipientUserId}`, Number(r.count)]),
    );    const toNotify: Array<{
      tenantId: string;
      recipientUserId: string;
      leadId: string | null;
      type: string;
      title: string;
      message: string;
    }> = [];
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyReminders = await db.select({ recipientUserId: schema.notifications.recipientUserId, count: count(schema.notifications.id) })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.type, "lead_feedback_reminder"),
        eq(schema.notifications.tenantId, tenant.id),
        gte(schema.notifications.createdAt, dayStart),
        inArray(schema.notifications.recipientUserId, leads.map((lead) => lead.corretorId!).filter(Boolean)),
      ))
      .groupBy(schema.notifications.recipientUserId);
    const dailyCounts = new Map(dailyReminders.map((row) => [row.recipientUserId, Number(row.count)]));

    for (const lead of leads) {
      if (!lead.corretorId) continue;
      const key = `${lead.id}:${lead.corretorId}`;
      const attemptCount = sentCounts.get(key) ?? 0;

      if (lead.status === "distributed") {
        // Distributed leads (pre-first-contact) — warn about impending SLA
        if (attemptCount >= distributedMaxAttempts) {
          tenantEscalated += 1;
          toNotify.push({
            tenantId: tenant.id,
            recipientUserId: lead.corretorId,
            leadId: lead.id,
            type: "lead_feedback_reminder",
            title: "⚠️ Primeiro contato urgente",
            message: `O lead ${lead.nome} está sem primeiro contato há mais de ${slaFirstContactMinutes} minutos. Será redistribuído em breve.`,
          });
          continue;
        }

        toNotify.push({
          tenantId: tenant.id,
          recipientUserId: lead.corretorId,
          leadId: lead.id,
          type: "lead_feedback_reminder",
          title: "⚡ Faça o primeiro contato",
          message: `Você recebeu ${lead.nome} há mais de ${distributedIntervalMinutes} min. Inicie o atendimento para não perder o lead (${attemptCount + 1}/${distributedMaxAttempts}).`,
        });
      } else {
        // Active status leads (post-first-contact) — regular feedback reminders
        if ((dailyCounts.get(lead.corretorId) ?? 0) >= MAX_DAILY_FEEDBACK_REMINDERS) continue;
        if (attemptCount >= maxAttempts) {
          tenantEscalated += 1;
          toNotify.push({
            tenantId: tenant.id,
            recipientUserId: lead.corretorId,
            leadId: lead.id,
            type: "lead_feedback_reminder",
            title: "⚠️ Feedback urgente",
            message: `O lead ${lead.nome} precisa de feedback há mais de ${maxAttempts} períodos. Registre agora para evitar redistribuição.`,
          });
          continue;
        }

        toNotify.push({
          tenantId: tenant.id,
          recipientUserId: lead.corretorId,
          leadId: lead.id,
          type: "lead_feedback_reminder",
          title: "Atualize o atendimento",
          message: `Registre um feedback sobre ${lead.nome} e atualize o status (${attemptCount + 1}/${maxAttempts}).`,
        });
        dailyCounts.set(lead.corretorId, (dailyCounts.get(lead.corretorId) ?? 0) + 1);
      }
    }

    if (!toNotify.length) continue;

    // Publish notifications (handles both in-app insert + push, respects capability)
    await Promise.allSettled(
      toNotify.map((n) =>
        publishNotification({
          capability: "lead_feedback_reminder",
          tenantId: n.tenantId,
          recipientUserId: n.recipientUserId,
          leadId: n.leadId,
          type: "lead_feedback_reminder",
          title: n.title,
          message: n.message,
          pushBody: n.message,
          url: `/leads/${n.leadId}`,
          tag: `feedback-${n.leadId}`,
        }).catch(() => { /* non-blocking */ }),
      ),
    );

    const feedbackNotices = toNotify.filter((notice) => notice.leadId && notice.message.startsWith("Registre um feedback"));
    if (feedbackNotices.length) {
      const brokerIds = [...new Set(feedbackNotices.map((notice) => notice.recipientUserId))];
      const brokers = await db.select({ userId: schema.user.id, name: schema.user.name, phone: schema.brokerProfiles.phone })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, tenant.id)))
        .where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.userId, brokerIds)));
      const brokerMap = new Map(brokers.map((broker) => [broker.userId, broker]));
      const requestedBy = await resolveSystemUserId(tenant.id);
      await Promise.allSettled(feedbackNotices.map(async (notice) => {
        const broker = brokerMap.get(notice.recipientUserId);
        const lead = leads.find((item) => item.id === notice.leadId);
        const phone = broker?.phone?.trim();
        if (!broker || !lead || !phone || !notice.leadId) return;
        await enqueueMetaTemplateMessage({
          tenantId: tenant.id,
          recipientType: "user",
          recipientId: broker.userId,
          destinationPhone: phone,
          purpose: "leadFeedbackReminder",
          variables: [broker.name?.trim() || "Corretor(a)", lead.nome],
          requestedBy,
          idempotencyKey: `feedback-reminder:${lead.id}:${broker.userId}:${dayStart.toISOString()}:${dailyCounts.get(broker.userId) ?? 1}`,
        });
      }));
    }

    totalReminders += toNotify.length;

    // Escalate overdue leads to manager/director
    if (tenantEscalated > 0) {
      const supervisors = await db
        .select({ userId: schema.tenantMemberships.userId })
        .from(schema.tenantMemberships)
        .where(
          and(
            eq(schema.tenantMemberships.tenantId, tenant.id),
            eq(schema.tenantMemberships.status, "active"),
            inArray(schema.tenantMemberships.role, ["manager", "director"]),
          ),
        )
        .groupBy(schema.tenantMemberships.userId)
        .limit(5);

      await Promise.allSettled(
        supervisors.map((sup) =>
          publishNotification({
            capability: "lead_feedback_reminder",
            tenantId: tenant.id,
            recipientUserId: sup.userId,
            type: "lead_feedback_reminder",
            title: "Corretor não registrou feedback",
            message: `${tenantEscalated} lead(s) com feedback pendente acima do limite de tentativas. Verifique a operação.`,
            pushBody: `${tenantEscalated} lead(s) precisam de atenção — feedback pendente há mais de ${maxAttempts} períodos.`,
            url: "/minha-fila",
            tag: "feedback-escalated",
          }).catch(() => { /* non-blocking */ }),
        ),
      );
      totalEscalated += tenantEscalated;
    }
  }

  return { reminders: totalReminders, tenants: tenants.length, skipped: totalSkipped, escalated: totalEscalated };
}
