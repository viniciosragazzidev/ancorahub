"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { handleLeadOfferWebhookResponse } from "@/features/lead-distribution/offers";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { resolveLeadAcceptOutcome } from "./accept-offer-outcome";
import { loadBrokerGreetingSafe } from "./broker-greeting-server";

const leadId = z.string().uuid();

/** whatsappUrl: the client's WhatsApp (Web link with the greeting) once the lead is the broker's, so the same tap opens it. */
export type AcceptLeadOfferState = { success: boolean; error?: string; whatsappUrl?: string };

/**
 * "Aceitar lead" in the CRM (Lite). Uses the same atomic acceptance as the
 * WhatsApp button, so the lead is confirmed for the broker and protected from
 * any automatic redistribution before they even open it.
 */
export async function acceptLeadOfferAction(inputLeadId: string): Promise<AcceptLeadOfferState> {
  const parsed = leadId.safeParse(inputLeadId);
  if (!parsed.success) return { success: false, error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return { success: false, error: "Somente o corretor pode aceitar o lead." };

    const response = await handleLeadOfferWebhookResponse({
      tenantId: context.tenantId,
      brokerId: context.userId,
      leadId: parsed.data,
      buttonText: "aceitar",
    });

    const [lead] = await getDatabase()
      .select({ corretorId: schema.leads.corretorId, assignmentSource: schema.leads.assignmentSource, nome: schema.leads.nome, telefone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    const outcome = resolveLeadAcceptOutcome(response, lead ?? null, context.userId);
    revalidatePath("/minha-fila");
    if (!outcome.ok) return { success: false, error: outcome.error };
    // Accepting already started the service (offer_accepted): the phone is the broker's now.
    const whatsappUrl = lead?.corretorId === context.userId ? buildWhatsAppUrl(lead.telefone, await loadBrokerGreetingSafe({ tenantId: context.tenantId, leadId: parsed.data, brokerUserId: context.userId, leadName: lead.nome })) : null;
    return whatsappUrl ? { success: true, whatsappUrl } : { success: true };
  } catch {
    return { success: false, error: "Não foi possível aceitar o lead agora." };
  }
}
