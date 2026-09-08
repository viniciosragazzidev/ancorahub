import "server-only";

import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";
import { notifyLeadReassigned, publishNotification, sendNotificationToUser } from "@/features/notifications/send-push-helper";
import { publishRealtimeSyncSignals } from "@/features/notifications/realtime-sync";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { enqueueAndProcessLeadDistribution } from "@/features/lead-distribution/jobs";

const activeStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;
type SlaKind = "lead_unworked" | "lead_warning_10m" | "lead_stalled";

export type SlaSweepResult = { tenants: number; unworked: number; warnings: number; stalled: number; notifications: number };

export async function runSlaSweep(tenantId?: string): Promise<SlaSweepResult> {
  if (!(await isNotificationCapabilityEnabled("lead_sla"))) return { tenants: 0, unworked: 0, warnings: 0, stalled: 0, notifications: 0 };
  const db = getDatabase();
  const tenants = await db.select({
    id: schema.tenants.id,
    firstContactMinutes: schema.tenants.slaFirstContactMinutes,
    stagnantDays: schema.tenants.slaStagnantDays,
    autoRedistribute: schema.tenants.autoRedistributeOnFeedbackTimeout,
  })
    .from(schema.tenants).where(tenantId ? eq(schema.tenants.id, tenantId) : eq(schema.tenants.status, "active"));
  let unworked = 0;
  let warnings = 0;
  let stalled = 0;
  let notifications = 0;
  const now = Date.now();
  for (const tenant of tenants) {
    const firstContactMinutes = Math.max(1, Number.parseInt(tenant.firstContactMinutes, 10) || 15);
    const stagnantDays = Math.max(1, Number.parseInt(tenant.stagnantDays, 10) || 3);
    const unworkedCutoff = new Date(now - firstContactMinutes * 60 * 1000);
    const warningMinutes = Math.min(10, Math.max(1, Math.floor(firstContactMinutes * 0.66)));
    const warningCutoff = new Date(now - warningMinutes * 60 * 1000);
    const stagnantCutoff = new Date(now - stagnantDays * 24 * 60 * 60 * 1000);
    
    const leads = await db.select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      branchId: schema.leads.branchId,
      status: schema.leads.status,
      corretorId: schema.leads.corretorId,
      assignedAt: schema.leads.assignedAt,
      firstContactAt: schema.leads.firstContactAt,
      serviceStartedAt: schema.leads.serviceStartedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
      webhookCredentialId: schema.leads.webhookCredentialId,
      redistributionCount: schema.leads.redistributionCount,
    })
      .from(schema.leads).where(
        and(
          eq(schema.leads.tenantId, tenant.id),
          or(
            and(eq(schema.leads.status, "distributed"), lt(schema.leads.assignedAt, warningCutoff)),
            and(inArray(schema.leads.status, activeStatuses), lt(schema.leads.stageEnteredAt, stagnantCutoff))
          )
        )
      );
    
    if (!leads.length) continue;
    
    const recipients = await db.select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId })
      .from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.role, ["manager", "director"])));
    
    const [anyActiveMember] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.status, "active")))
      .limit(1);
    const systemUserId = anyActiveMember?.userId;

    const leadIds = leads.map((lead) => lead.id);
    const existing = await db.select({ recipientUserId: schema.notifications.recipientUserId, leadId: schema.notifications.leadId, type: schema.notifications.type })
      .from(schema.notifications).where(and(eq(schema.notifications.tenantId, tenant.id), inArray(schema.notifications.leadId, leadIds), gte(schema.notifications.createdAt, new Date(now - 24 * 60 * 60 * 1000))));
    const existingKeys = new Set(existing.map((item) => `${item.recipientUserId}:${item.leadId}:${item.type}`));
    const pending: Array<typeof schema.notifications.$inferInsert> = [];
    
    for (const lead of leads) {
      let kind: SlaKind = "lead_stalled";
      const isAcceptedOrStarted = Boolean(lead.firstContactAt || lead.serviceStartedAt || lead.status !== "distributed");
      if (lead.status === "distributed" && lead.assignedAt && !isAcceptedOrStarted) {
        if (lead.assignedAt < unworkedCutoff) {
          kind = "lead_unworked";
        } else if (lead.assignedAt <= warningCutoff) {
          kind = "lead_warning_10m";
        }
      }
      
      if (kind === "lead_unworked") {
        unworked += 1;

        if (tenant.autoRedistribute === false) {
          for (const recipient of recipients) {
            await publishNotification({
              capability: "lead_assignment",
              tenantId: tenant.id,
              recipientUserId: recipient.userId,
              leadId: lead.id,
              type: "lead_unworked",
              title: "Lead aguardando início de atendimento ⚠️",
              message: `O lead "${lead.nome}" ultrapassou o tempo limite de ${firstContactMinutes} minutos sem início de atendimento.`,
              pushTitle: "Alerta de SLA ⚠️",
              pushBody: `"${lead.nome}" ultrapassou ${firstContactMinutes} minutos sem primeiro contato.`,
              url: `/leads/${lead.id}`,
              tag: "corretop-leads",
            }).catch(console.error);
          }
          continue;
        }

        // Save previous owner to exclude them from the next automatic offer cycle.
        const previousOwnerId = lead.corretorId;
        const currentRedistributions = lead.redistributionCount ?? 0;
        const updateTime = new Date();
        await db.transaction(async (tx) => {
          await tx.update(schema.leads)
            .set({
              corretorId: null,
              status: "new",
              distributionStatus: "queued",
              redistributionCount: currentRedistributions + 1,
              assignedAt: null,
              assignmentSource: "redistribution",
              stageEnteredAt: updateTime,
              distributionUpdatedAt: updateTime,
              firstContactAt: null,
              serviceStartedAt: null,
              serviceStartedBy: null,
            })
            .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, tenant.id)));

          if (previousOwnerId) {
            const [existingOffer] = await tx
              .select({ id: schema.leadOffers.id })
              .from(schema.leadOffers)
              .where(
                and(
                  eq(schema.leadOffers.tenantId, tenant.id),
                  eq(schema.leadOffers.leadId, lead.id),
                  eq(schema.leadOffers.brokerId, previousOwnerId),
                ),
              )
              .limit(1);
            if (!existingOffer) {
              await tx.insert(schema.leadOffers).values({
                id: randomUUID(),
                tenantId: tenant.id,
                leadId: lead.id,
                brokerId: previousOwnerId,
                status: "EXPIRED",
                offeredAt: lead.assignedAt ?? updateTime,
                expiresAt: updateTime,
                createdAt: updateTime,
                updatedAt: updateTime,
              });
            }
          }

          if (systemUserId) {
            await tx.insert(schema.leadInteractions).values({
              id: randomUUID(),
              leadId: lead.id,
              userId: systemUserId,
              tipo: "system_alert",
              conteudo: `Lead devolvido ao ciclo automático por estouro de SLA. O corretor anterior foi excluído da próxima tentativa.`,
            });
            await tx.insert(schema.auditLogs).values({
              id: randomUUID(),
              userId: systemUserId,
              entidade: "lead",
              entidadeId: lead.id,
              acao: "lead.redistributed_sla",
            });
          }
        });

        await enqueueAndProcessLeadDistribution({
          tenantId: tenant.id,
          leadId: lead.id,
          source: "sla_timeout",
        });

        if (previousOwnerId) {
          void notifyLeadReassigned(lead.id, tenant.id, previousOwnerId, lead.nome).catch(console.error);
          void publishLeadInvalidation({ tenantId: tenant.id, actorId: previousOwnerId }).catch(() => {});
        }

      } else if (kind === "lead_warning_10m") {
        warnings += 1;
        if (lead.corretorId) {
          const brokerKey = `${lead.corretorId}:${lead.id}:lead_warning_10m`;
          if (!existingKeys.has(brokerKey)) {
            existingKeys.add(brokerKey);
            pending.push({
              id: randomUUID(),
              tenantId: tenant.id,
              recipientUserId: lead.corretorId,
              leadId: lead.id,
              type: "lead_warning_10m",
              title: "Atenção: Atendimento Pendente ⚠️",
              message: `Você recebeu o lead "${lead.nome}" há ${warningMinutes} minutos e ainda não iniciou o atendimento. Inicie o contato imediatamente para evitar a redistribuição automática do lead!`,
              createdAt: new Date(),
            });

            void sendNotificationToUser(lead.corretorId, {
              title: "Atenção: Atendimento Pendente ⚠️",
              body: `Você recebeu o lead "${lead.nome}" há ${warningMinutes} minutos. Inicie o contato agora para evitar que ele seja redistribuído!`,
              url: `/leads/${lead.id}`,
              tag: `corretop-warning-${lead.id}`,
            }).catch(console.error);
          }
        }
      } else {
        stalled += 1;
      }
      
      // Notify managers and directors only for lead_unworked and lead_stalled
      if (kind === "lead_unworked" || kind === "lead_stalled") {
        for (const recipient of recipients) {
          if (recipient.role === "manager" && recipient.branchId !== lead.branchId) continue;
          const key = `${recipient.userId}:${lead.id}:${kind}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          pending.push({ id: randomUUID(), tenantId: tenant.id, recipientUserId: recipient.userId, leadId: lead.id, type: kind, title: kind === "lead_unworked" ? "Lead não trabalhado" : "Lead estagnado", message: kind === "lead_unworked" ? `O lead ${lead.nome} está sem primeiro contato há mais de ${firstContactMinutes} minutos.` : `O lead ${lead.nome} está sem avanço há mais de ${stagnantDays} dias.`, createdAt: new Date() });
        }
      }

      // For stalled leads, also notify the broker who owns the lead
      if (kind === "lead_stalled" && lead.corretorId) {
        const brokerKey = `${lead.corretorId}:${lead.id}:${kind}`;
        if (!existingKeys.has(brokerKey)) {
          existingKeys.add(brokerKey);
          pending.push({
            id: randomUUID(),
            tenantId: tenant.id,
            recipientUserId: lead.corretorId,
            leadId: lead.id,
            type: kind,
            title: "Seu lead está parado ⏳",
            message: `O lead ${lead.nome} está sem avanço há mais de ${stagnantDays} dias. Registre um feedback para evitar redistribuição.`,
            createdAt: new Date(),
          });
        }
      }
    }
    if (pending.length) {
      const inserted = await db.insert(schema.notifications).values(pending).returning({
        id: schema.notifications.id,
        tenantId: schema.notifications.tenantId,
        userId: schema.notifications.recipientUserId,
      });
      void publishRealtimeSyncSignals(inserted.map((notification) => ({
        tenantId: notification.tenantId,
        userId: notification.userId,
        notificationId: notification.id,
      })));
      notifications += pending.length;
    }
  }
  return { tenants: tenants.length, unworked, warnings, stalled, notifications };
}
