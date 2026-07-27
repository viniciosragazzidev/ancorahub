import "server-only";

import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";
import { chooseAvailableBroker } from "./assignment";
import { notifyLeadReassigned, notifyNewLead } from "@/features/notifications/send-push-helper";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";

const activeStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;
type SlaKind = "lead_unworked" | "lead_stalled";

export type SlaSweepResult = { tenants: number; unworked: number; stalled: number; notifications: number };

export async function runSlaSweep(tenantId?: string): Promise<SlaSweepResult> {
  if (!(await isNotificationCapabilityEnabled("lead_sla"))) return { tenants: 0, unworked: 0, stalled: 0, notifications: 0 };
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id, firstContactMinutes: schema.tenants.slaFirstContactMinutes, stagnantDays: schema.tenants.slaStagnantDays })
    .from(schema.tenants).where(tenantId ? eq(schema.tenants.id, tenantId) : eq(schema.tenants.status, "active"));
  let unworked = 0;
  let stalled = 0;
  let notifications = 0;
  const now = Date.now();
  for (const tenant of tenants) {
    const firstContactMinutes = Math.max(1, Number.parseInt(tenant.firstContactMinutes, 10) || 15);
    const stagnantDays = Math.max(1, Number.parseInt(tenant.stagnantDays, 10) || 3);
    const unworkedCutoff = new Date(now - firstContactMinutes * 60 * 1000);
    const stagnantCutoff = new Date(now - stagnantDays * 24 * 60 * 60 * 1000);
    
    const leads = await db.select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      branchId: schema.leads.branchId,
      status: schema.leads.status,
      corretorId: schema.leads.corretorId,
      assignedAt: schema.leads.assignedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
      webhookCredentialId: schema.leads.webhookCredentialId,
    })
      .from(schema.leads).where(and(eq(schema.leads.tenantId, tenant.id), or(and(eq(schema.leads.status, "distributed"), lt(schema.leads.assignedAt, unworkedCutoff)), and(inArray(schema.leads.status, activeStatuses), lt(schema.leads.stageEnteredAt, stagnantCutoff)))));
    
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
      const kind: SlaKind = lead.status === "distributed" && lead.assignedAt && lead.assignedAt < unworkedCutoff ? "lead_unworked" : "lead_stalled";
      
      if (kind === "lead_unworked") {
        unworked += 1;

        // Save previous owner to notify them later
        const previousOwnerId = lead.corretorId;
        
        // Active automatic redistribution of the unworked lead
        const nextBrokerId = await chooseAvailableBroker(tenant.id, lead.branchId, lead.corretorId, lead.webhookCredentialId);
        const updateTime = new Date();
        
        await db.transaction(async (tx) => {
          await tx.update(schema.leads)
            .set({
              corretorId: nextBrokerId,
              status: nextBrokerId ? "distributed" : "new",
              distributionStatus: nextBrokerId ? "assigned" : "queued",
              assignedAt: nextBrokerId ? updateTime : null,
              stageEnteredAt: updateTime,
              distributionUpdatedAt: updateTime,
              firstContactAt: null,
              serviceStartedAt: null,
              serviceStartedBy: null,
            })
            .where(eq(schema.leads.id, lead.id));

          if (systemUserId) {
            await tx.insert(schema.leadInteractions).values({
              id: randomUUID(),
              leadId: lead.id,
              userId: systemUserId,
              tipo: "system_alert",
              conteudo: nextBrokerId
                ? `Lead redistribuído automaticamente por estouro de SLA (atendimento não iniciado pelo corretor anterior).`
                : `Lead retornado para a fila da unidade por estouro de SLA (sem outro corretor disponível).`,
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

        // Trigger real-time push and WS notifications in background
        await notifyNewLead(lead.id, tenant.id, lead.branchId, nextBrokerId, lead.nome).catch(console.error);

        // Notify the previous broker that they lost the lead
        if (previousOwnerId && previousOwnerId !== nextBrokerId) {
          void notifyLeadReassigned(lead.id, tenant.id, previousOwnerId, lead.nome).catch(console.error);
        }

      } else {
        stalled += 1;
      }
      
      // Notify managers and directors
      for (const recipient of recipients) {
        if (recipient.role === "manager" && recipient.branchId !== lead.branchId) continue;
        const key = `${recipient.userId}:${lead.id}:${kind}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        pending.push({ id: randomUUID(), tenantId: tenant.id, recipientUserId: recipient.userId, leadId: lead.id, type: kind, title: kind === "lead_unworked" ? "Lead não trabalhado" : "Lead estagnado", message: kind === "lead_unworked" ? `O lead ${lead.nome} está sem primeiro contato há mais de ${firstContactMinutes} minutos.` : `O lead ${lead.nome} está sem avanço há mais de ${stagnantDays} dias.`, createdAt: new Date() });
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
    if (pending.length) { await db.insert(schema.notifications).values(pending); notifications += pending.length; }
  }
  return { tenants: tenants.length, unworked, stalled, notifications };
}
