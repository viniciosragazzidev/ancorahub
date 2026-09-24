"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { handleLeadOfferWebhookResponse } from "@/features/lead-distribution/offers";
import { resolveLeadAcceptOutcome } from "./accept-offer-outcome";

const leadId = z.string().uuid();

export type AcceptLeadOfferState = { success: boolean; error?: string };

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
      .select({ corretorId: schema.leads.corretorId, assignmentSource: schema.leads.assignmentSource })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    const outcome = resolveLeadAcceptOutcome(response, lead ?? null, context.userId);
    revalidatePath("/minha-fila");
    return outcome.ok ? { success: true } : { success: false, error: outcome.error };
  } catch {
    return { success: false, error: "Não foi possível aceitar o lead agora." };
  }
}
