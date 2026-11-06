import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { POST_SALE_ALERT_REASON_LABELS, postSaleAlertIdempotencyKey, postSaleAlertReasons } from "./alert-rules";

export async function ensurePostSaleSurveyAlerts(survey: {
  id: string;
  tenantId: string;
  leadId: string;
  outcome: string | null;
  rating: number | null;
  answers: unknown;
  alertsHandledAt: Date | null;
}) {
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") return;
  if (survey.alertsHandledAt) return;
  const reasons = postSaleAlertReasons(survey);
  if (!reasons.length) return;

  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId, queueBranchId: schema.leadQueues.branchId })
    .from(schema.leads)
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .where(and(eq(schema.leads.id, survey.leadId), eq(schema.leads.tenantId, survey.tenantId)))
    .limit(1);
  if (!lead) return;
  const effectiveBranchId = lead.branchId ?? lead.queueBranchId;
  const recipients = await db.selectDistinct({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, survey.tenantId),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
      or(
        eq(schema.tenantMemberships.role, "director"),
        effectiveBranchId ? and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, effectiveBranchId)) : undefined,
      ),
    ));
  if (!recipients.length) return;

  const systemUserId = await resolveSystemUserId(survey.tenantId);
  const now = new Date();
  for (const reason of reasons) {
    const messages = recipients.map((recipient) => ({
      id: randomUUID(),
      tenantId: survey.tenantId,
      recipientUserId: recipient.userId,
      leadId: survey.leadId,
      type: "post_sale_alert",
      title: "Atenção no pós-venda",
      message: POST_SALE_ALERT_REASON_LABELS[reason],
      idempotencyKey: postSaleAlertIdempotencyKey(survey.id, reason, recipient.userId),
      createdAt: now,
    }));
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(schema.notifications).values(messages)
        .onConflictDoNothing()
        .returning({ id: schema.notifications.id });
      if (!inserted.length) return;
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: systemUserId,
        entidade: "post_sale_survey",
        entidadeId: survey.id,
        acao: "post_sale.alert.created",
        metadata: { source: "post_sale_audit", reason, recipientCount: inserted.length },
        createdAt: now,
      });
    });
  }
}
