"use server";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BROKER_OFFER_MAX, cleanBrokerOffer } from "@/features/leads/broker-ad-context";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { canEditCampaignBrokerOffer } from "./broker-brief-policy";

const inputSchema = z.object({
  campaignId: z.string().trim().min(1).max(64),
  offer: z.string().max(BROKER_OFFER_MAX * 2),
});

/**
 * O plano que a campanha anuncia, mostrado ao corretor no cartão "De onde veio"
 * (10/11/2026). Texto vazio apaga. Tenant sempre do contexto autenticado.
 */
export async function saveCampaignBrokerOfferAction(input: { campaignId: string; offer: string }): Promise<{ success: true; offer: string | null } | { success: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Texto inválido." };
  const context = await getRequiredTenantContext();
  if (!canEditCampaignBrokerOffer(context)) return { success: false, error: "Seu perfil não pode alterar esta campanha." };
  try {
    await requireCapability(context, "acessar_campanhas_meta");
  } catch {
    return { success: false, error: "Seu perfil não pode alterar esta campanha." };
  }

  const db = getDatabase();
  const [campaign] = await db
    .select({ campaignId: schema.metaCampaigns.campaignId })
    .from(schema.metaCampaigns)
    .where(and(
      eq(schema.metaCampaigns.tenantId, context.tenantId),
      or(eq(schema.metaCampaigns.id, parsed.data.campaignId), eq(schema.metaCampaigns.campaignId, parsed.data.campaignId)),
    ))
    .limit(1);
  if (!campaign) return { success: false, error: "Campanha Meta não encontrada." };

  const offer = cleanBrokerOffer(parsed.data.offer);
  const now = new Date();
  const where = and(eq(schema.metaCampaignBrokerBriefs.tenantId, context.tenantId), eq(schema.metaCampaignBrokerBriefs.campaignId, campaign.campaignId));
  if (offer) {
    await db.insert(schema.metaCampaignBrokerBriefs)
      .values({ id: randomUUID(), tenantId: context.tenantId, campaignId: campaign.campaignId, offer, updatedBy: context.userId, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.metaCampaignBrokerBriefs.tenantId, schema.metaCampaignBrokerBriefs.campaignId],
        set: { offer, updatedBy: context.userId, updatedAt: now },
      });
  } else {
    await db.delete(schema.metaCampaignBrokerBriefs).where(where);
  }
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "meta_campaign", entidadeId: campaign.campaignId,
    acao: offer ? "meta_campaign.broker_offer_saved" : "meta_campaign.broker_offer_cleared", createdAt: now,
  });
  revalidatePath(`/marketing/campanhas/${parsed.data.campaignId}`);
  return { success: true, offer };
}
