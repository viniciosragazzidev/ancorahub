import "server-only";

import { and, eq, gte, isNotNull, isNull, lte, notExists, sql } from "drizzle-orm";

import { loadSaleMissingItems } from "@/features/conversation-intelligence/sale-detection";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import {
  SALE_REMINDER_DAYS,
  SALE_REMINDER_KEY_PREFIX,
  SALE_REMINDER_MAX,
  isSaleReminderHour,
  saleReminderDue,
  saleReminderKey,
  saleReminderNotice,
} from "./sale-registration-reminder-core";

const DAY = 24 * 60 * 60_000;

/**
 * Lembra o corretor de registrar a venda de um lead Convertido sem venda registrada (1, 3 e 5 dias
 * depois). Roda no job de SLA (a cada 5 min); só age em horário comercial. Nunca lança.
 */
export async function runSaleRegistrationReminderSweep(now = new Date()) {
  if (!isSaleReminderHour(now)) return { checked: 0, reminded: 0 };
  try {
    const db = getDatabase();
    const lastDue = SALE_REMINDER_DAYS[SALE_REMINDER_MAX - 1];
    const leads = await db
      .select({
        id: schema.leads.id,
        tenantId: schema.leads.tenantId,
        nome: schema.leads.nome,
        corretorId: schema.leads.corretorId,
        convertedAt: schema.leads.stageEnteredAt,
        sent: sql<number>`(select count(*)::int from ${schema.notifications} n where n.tenant_id = ${schema.leads.tenantId} and n.lead_id = ${schema.leads.id} and n.idempotency_key like ${`${SALE_REMINDER_KEY_PREFIX}%`})`,
      })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.status, "converted"),
        isNotNull(schema.leads.corretorId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
        lte(schema.leads.stageEnteredAt, new Date(now.getTime() - SALE_REMINDER_DAYS[0] * DAY)),
        // Depois do último lembrete (com folga de 2 dias) o lead sai da varredura.
        gte(schema.leads.stageEnteredAt, new Date(now.getTime() - (lastDue + 2) * DAY)),
        notExists(db.select({ value: sql`1` }).from(schema.sales).where(and(
          eq(schema.sales.leadId, schema.leads.id),
          eq(schema.sales.tenantId, schema.leads.tenantId),
        ))),
      ))
      .limit(200);

    let reminded = 0;
    for (const lead of leads) {
      if (!lead.corretorId || !lead.convertedAt) continue;
      const reminder = saleReminderDue(lead.convertedAt, Number(lead.sent) || 0, now);
      if (!reminder) continue;
      const missing = await loadSaleMissingItems(lead.tenantId, lead.id).catch(() => [] as string[]);
      const sent = await publishNotification({
        capability: "lead_converted",
        tenantId: lead.tenantId,
        recipientUserId: lead.corretorId,
        leadId: lead.id,
        type: "lead_sale_registration_reminder",
        ...saleReminderNotice(lead.nome, reminder, missing),
        url: `/leads/${lead.id}`,
        tag: `lead-${lead.id}`,
        idempotencyKey: saleReminderKey(lead.id, reminder),
      }).catch((error) => {
        console.warn("[sale-reminder] notice_failed", { leadId: lead.id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        return false;
      });
      if (sent) reminded += 1;
    }
    return { checked: leads.length, reminded };
  } catch (error) {
    console.error("[sale-reminder] failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return { checked: 0, reminded: 0 };
  }
}
