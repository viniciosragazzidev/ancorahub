import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";

const REENGAGEMENT_DAYS = 30;
const NOTIFICATION_TYPE = "lead_reengagement";

export async function createLeadReengagementReminders(now = new Date()) {
  if (!(await isNotificationCapabilityEnabled("lead_reengagement"))) return { reengagement: 0 };
  const db = getDatabase();

  const cutoff = new Date(now.getTime() - REENGAGEMENT_DAYS * 24 * 60 * 60 * 1000);

  const lostLeads = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      nome: schema.leads.nome,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.status, "lost"),
        lte(schema.leads.stageEnteredAt, cutoff),
      ),
    );

  if (!lostLeads.length) return { reengagement: 0 };

  const dedupWindow = new Date(now.getTime() - REENGAGEMENT_DAYS * 24 * 60 * 60 * 1000);

  const existing = await db
    .select({ leadId: schema.notifications.leadId, recipientUserId: schema.notifications.recipientUserId })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.type, NOTIFICATION_TYPE),
        inArray(
          schema.notifications.leadId,
          lostLeads.map((lead) => lead.id),
        ),
        gte(schema.notifications.createdAt, dedupWindow),
      ),
    );

  const sent = new Set(existing.map((item) => `${item.leadId}:${item.recipientUserId}`));

  const pending = lostLeads
    .filter((lead) => lead.corretorId && !sent.has(`${lead.id}:${lead.corretorId}`))
    .map((lead) => ({
      id: randomUUID(),
      tenantId: lead.tenantId,
      recipientUserId: lead.corretorId!,
      leadId: lead.id,
      type: NOTIFICATION_TYPE,
      title: "Lead perdido pode ser reengajado",
      message: `${lead.nome} está em status perdido há mais de ${REENGAGEMENT_DAYS} dias. Considere tentar um novo contato.`,
      createdAt: now,
    }));

  if (pending.length) await db.insert(schema.notifications).values(pending);

  return { reengagement: pending.length };
}
