import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { brokerGreeting, greetingFactsFromLead } from "./broker-greeting";

/**
 * Same as loadBrokerGreeting, but never throws (30/10): it runs after the accept is recorded, so a
 * failure here falls back to the simple greeting instead of reporting a failed accept.
 */
export async function loadBrokerGreetingSafe(input: { tenantId: string; leadId: string; brokerUserId: string; leadName: string | null }) {
  try {
    return await loadBrokerGreeting(input);
  } catch (error) {
    console.error("[broker-greeting] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return brokerGreeting(input.leadName);
  }
}

/** The broker's first WhatsApp message for this lead, with the broker's and the brokerage's names. */
export async function loadBrokerGreeting(input: { tenantId: string; leadId: string; brokerUserId: string }) {
  const db = getDatabase();
  const [[lead], [broker], [tenant]] = await Promise.all([
    db.select({
      nome: schema.leads.nome, tipo: schema.leads.tipo, qualificationDetails: schema.leads.qualificationDetails, planName: schema.carrierPlans.name,
      formData: schema.leads.formData, sourceChannel: schema.leads.sourceChannel, sourceMetadata: schema.leads.sourceMetadata,
    })
      .from(schema.leads)
      .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1),
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, input.brokerUserId)).limit(1),
    db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1),
  ]);
  return brokerGreeting({
    leadName: lead?.nome,
    brokerName: broker?.name,
    companyName: tenant?.name,
    tipo: lead?.tipo,
    planName: lead?.planName,
    ...(lead ? greetingFactsFromLead(lead) : {}),
  });
}
