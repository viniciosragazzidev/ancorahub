"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const leadId = z.string().uuid();

/**
 * Records that the owning broker clicked through to WhatsApp for this lead —
 * feeds the "Histórico de Atribuições" timeline and the "abriu o WhatsApp"
 * status shown to the director. Silently no-ops on any mismatch (wrong lead,
 * not the current owner) instead of surfacing an error, since this fires
 * alongside an external-link click the broker should never see blocked.
 */
export async function recordWhatsAppOpenedAction(inputLeadId: string) {
  const parsed = leadId.safeParse(inputLeadId);
  if (!parsed.success) return { success: false as const };
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db
      .select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead || lead.corretorId !== context.userId) return { success: false as const };

    await db.insert(schema.leadDistributionEvents).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      leadId: lead.id,
      fromBranchId: lead.branchId,
      toBranchId: lead.branchId,
      previousOwnerId: lead.corretorId,
      newOwnerId: lead.corretorId,
      action: "whatsapp_opened",
      source: "broker",
      strategy: "manual",
      actorId: context.userId,
      createdAt: new Date(),
    });
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}
