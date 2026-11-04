import "server-only";

import { and, eq } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { getDatabase, schema } from "@/shared/db";
import { entersClosingStage } from "./closing-stage-notice-core";
import {
  CLOSING_DIRECTOR_NOTICE_KEY,
  CLOSING_DIRECTOR_PURPOSE,
  closingDirectorAlertKey,
  closingDirectorAlertVariables,
  closingDirectorRecipientsKey,
  parseRecipientPhones,
} from "./closing-director-alert-core";

export async function getClosingDirectorRecipients(tenantId: string): Promise<string[]> {
  try {
    return parseRecipientPhones(await getSystemSetting(closingDirectorRecipientsKey(tenantId)));
  } catch {
    return [];
  }
}

function readSummary(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const intelligence = (details as { aiIntelligence?: { summary?: unknown } }).aiIntelligence;
  const summary = typeof intelligence?.summary === "string" ? intelligence.summary.trim() : "";
  return summary.length >= 20 ? summary : null;
}

/**
 * Tells the direction that a lead entered the closing stage: client, broker and
 * the AI summary of the conversation, to each number set in Avisos da equipe.
 * Once per lead and number. Never throws: the status change is already saved.
 */
export async function notifyDirectorsClosingStage(input: {
  tenantId: string;
  leadId: string;
  previousStatus: string;
  newStatus: string;
}) {
  if (!entersClosingStage(input.previousStatus, input.newStatus)) return { notified: 0 };
  try {
    const recipients = await getClosingDirectorRecipients(input.tenantId);
    if (!recipients.length) return { notified: 0 };
    // Switched off in Avisos da equipe: nothing goes out (the outbox would also skip it; this saves the lookups).
    const notice = teamNoticeByKey(CLOSING_DIRECTOR_NOTICE_KEY);
    if (!notice || !(await getTeamNoticeSetting(input.tenantId, notice)).enabled) return { notified: 0 };
    const db = getDatabase();
    const [lead] = await db
      .select({
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        tipo: schema.leads.tipo,
        livesCount: schema.leads.livesCount,
        monthlyValue: schema.leads.monthlyValue,
        qualificationDetails: schema.leads.qualificationDetails,
        brokerName: schema.user.name,
        legacyPlanName: schema.carrierPlans.name,
        globalPlanName: schema.globalPlans.name,
        tenantPrivatePlanName: schema.tenantPrivatePlans.name,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .leftJoin(schema.carrierPlans, and(eq(schema.leads.planId, schema.carrierPlans.id), eq(schema.carrierPlans.tenantId, input.tenantId)))
      .leftJoin(schema.globalPlans, eq(schema.leads.planId, schema.globalPlans.id))
      .leftJoin(schema.tenantPrivatePlans, and(eq(schema.leads.planId, schema.tenantPrivatePlans.id), eq(schema.tenantPrivatePlans.tenantId, input.tenantId)))
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    if (!lead) return { notified: 0 };
    const variables = closingDirectorAlertVariables({
      leadId: input.leadId,
      leadName: lead.nome,
      leadPhone: lead.telefone,
      leadType: lead.tipo,
      livesCount: lead.livesCount,
      monthlyValue: lead.monthlyValue,
      planName: lead.legacyPlanName ?? lead.globalPlanName ?? lead.tenantPrivatePlanName ?? null,
      brokerName: lead.brokerName,
      stage: input.newStatus,
      summary: readSummary(lead.qualificationDetails),
    });
    const settled = await Promise.allSettled(recipients.map((phone) => enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      destinationPhone: phone,
      purpose: CLOSING_DIRECTOR_PURPOSE,
      variables,
      requestedBy: null,
      idempotencyKey: closingDirectorAlertKey(input.leadId, phone),
    }).then((queued) => (queued.duplicate || (queued.status as string) === "skipped"
      ? false
      // Exact-id dispatch: an older queued message never takes this one's place.
      : processMetaOutboundBatch(1, input.tenantId, queued.id).then(() => true)))));
    let notified = 0;
    for (const item of settled) {
      if (item.status === "fulfilled" && item.value) notified += 1;
      if (item.status === "rejected") console.warn("[closing-director] notice_failed", { leadId: input.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
    }
    return { notified };
  } catch (error) {
    console.error("[closing-director] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { notified: 0 };
  }
}
