import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { brokerGreeting, greetingFactsFromQualification } from "./broker-greeting";

/** The broker's first WhatsApp message for this lead, with the broker's and the brokerage's names. */
export async function loadBrokerGreeting(input: { tenantId: string; leadId: string; brokerUserId: string }) {
  const db = getDatabase();
  const [[lead], [broker], [tenant]] = await Promise.all([
    db.select({ nome: schema.leads.nome, tipo: schema.leads.tipo, qualificationDetails: schema.leads.qualificationDetails, planName: schema.carrierPlans.name })
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
    ...greetingFactsFromQualification(lead?.qualificationDetails),
  });
}
