import "server-only";

import { and, eq } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { resolveEventMessagePlan } from "@/features/communication-channels/message-policy-service";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { formatBrokerPhone, LEAD_BROKER_INTRO_PURPOSE, leadBrokerIntroVariables } from "./lead-broker-intro-core";

/**
 * Same message from the ids only (29/10): the broker took the lead by "Iniciar atendimento", by the
 * director's start or by an accepted offer. Loads the lead's and the broker's names and numbers.
 */
export async function sendLeadBrokerIntroForLead(input: { tenantId: string; leadId: string; brokerId: string }): Promise<LeadBrokerIntroOutcome> {
  try {
    const db = getDatabase();
    const [[lead], [broker]] = await Promise.all([
      db.select({ nome: schema.leads.nome, telefone: schema.leads.telefone }).from(schema.leads)
        .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1),
      db.select({ name: schema.user.name, phone: schema.brokerProfiles.phone }).from(schema.user)
        .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, input.tenantId)))
        .where(eq(schema.user.id, input.brokerId)).limit(1),
    ]);
    if (!lead) return "failed";
    return await sendLeadBrokerIntro({ tenantId: input.tenantId, leadId: input.leadId, leadName: lead.nome, leadPhone: lead.telefone, brokerId: input.brokerId, brokerName: broker?.name ?? null, brokerPhone: broker?.phone ?? null });
  } catch (error) {
    console.error("[lead-broker-intro] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return "failed";
  }
}

export type LeadBrokerIntroOutcome = "queued" | "disabled" | "no_phone" | "window_closed_no_template" | "failed";

/**
 * When a broker accepts a lead (29/10): the lead receives, on the company's official number, who
 * will take care of them and the broker's number. Free text only inside the 24 h window the lead
 * opened; outside it only an approved Meta template set for the event in Mensagens goes out
 * (free text there would be refused by Meta). Once per lead and broker. Never throws.
 */
export async function sendLeadBrokerIntro(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  brokerId: string;
  brokerName: string | null;
  brokerPhone: string | null;
}): Promise<LeadBrokerIntroOutcome> {
  try {
    if ((await getFeatureFlag(FEATURE_FLAGS.LEAD_BROKER_INTRO).catch(() => "true")) === "false") return "disabled";
    const brokerPhone = formatBrokerPhone(input.brokerPhone);
    if (!input.leadPhone || !brokerPhone) return "no_phone";
    const [tenant] = await getDatabase().select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1);
    const variables = leadBrokerIntroVariables({ leadName: input.leadName, brokerName: input.brokerName, brokerPhone, companyName: tenant?.name ?? null });
    const plan = await resolveEventMessagePlan({
      tenantId: input.tenantId,
      recipientType: "lead",
      recipientId: input.leadId,
      destinationPhone: input.leadPhone,
      purpose: LEAD_BROKER_INTRO_PURPOSE,
      variables,
    });
    if (!plan || (plan.primary.type === "text" && !plan.serviceWindowOpen)) {
      console.info("[lead-broker-intro] skipped", { leadId: input.leadId, reason: "window_closed_no_template" });
      return "window_closed_no_template";
    }
    const outbound = await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: "lead",
      recipientId: input.leadId,
      destinationPhone: input.leadPhone,
      purpose: LEAD_BROKER_INTRO_PURPOSE,
      variables,
      requestedBy: input.brokerId,
      idempotencyKey: `lead-broker-intro:${input.leadId}:${input.brokerId}`,
    });
    if (!outbound.duplicate) await processMetaOutboundBatch(1, input.tenantId, outbound.id).catch(() => undefined);
    return "queued";
  } catch (error) {
    console.error("[lead-broker-intro] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return "failed";
  }
}
