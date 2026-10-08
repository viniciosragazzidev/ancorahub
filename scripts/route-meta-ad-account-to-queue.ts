/**
 * Configures a Meta ad account's default lead queue and aligns its current
 * campaigns and active leads. Dry-run by default; only queue routing fields
 * change. Owner, unit, lead status, SLA, and service history are preserved.
 *
 * Usage:
 *   npx tsx scripts/route-meta-ad-account-to-queue.ts --tenant <id> --account <act_id> --queue <queue-id>
 *   npx tsx scripts/route-meta-ad-account-to-queue.ts --tenant <id> --account <act_id> --queue <queue-id> --apply
 */
import { loadEnvConfig } from "@next/env";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
function arg(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const tenantId = arg("--tenant");
const adAccountId = arg("--account");
const queueId = arg("--queue");
const apply = args.includes("--apply");
if (!tenantId || !adAccountId || !queueId) {
  console.error("Informe --tenant, --account e --queue.");
  process.exit(2);
}

const db = getDatabase();

async function main() {
  const [account] = await db.select({ id: schema.metaAdAccounts.id, name: schema.metaAdAccounts.name })
    .from(schema.metaAdAccounts)
    .where(and(eq(schema.metaAdAccounts.tenantId, tenantId!), eq(schema.metaAdAccounts.adAccountId, adAccountId!)))
    .limit(1);
  const [queue] = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, status: schema.leadQueues.status })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId!), eq(schema.leadQueues.id, queueId!)))
    .limit(1);
  if (!account) throw new Error(`Conta Meta não encontrada neste tenant: ${adAccountId}`);
  if (!queue || queue.status !== "active") throw new Error("A fila destino não existe neste tenant ou não está ativa.");

  const campaigns = await db.select({ id: schema.metaCampaigns.id, campaignId: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name })
    .from(schema.metaCampaigns)
    .where(and(eq(schema.metaCampaigns.tenantId, tenantId!), eq(schema.metaCampaigns.adAccountId, adAccountId!)));
  const campaignKeys = campaigns.flatMap((campaign) => [campaign.campaignId, campaign.id]);
  const routes = campaignKeys.length
    ? await db.select({ campaignId: schema.metaCampaignQueueRoutes.campaignId, enabled: schema.metaCampaignQueueRoutes.enabled, queueId: schema.metaCampaignQueueRoutes.queueId })
      .from(schema.metaCampaignQueueRoutes)
      .where(and(eq(schema.metaCampaignQueueRoutes.tenantId, tenantId!), inArray(schema.metaCampaignQueueRoutes.campaignId, campaignKeys)))
    : [];
  const routesByCampaign = new Map(routes.map((route) => [route.campaignId, route]));

  const adSets = campaignKeys.length
    ? await db.select({ id: schema.metaAdSets.adSetId })
      .from(schema.metaAdSets)
      .where(and(eq(schema.metaAdSets.tenantId, tenantId!), inArray(schema.metaAdSets.campaignId, campaignKeys)))
    : [];
  const ads = adSets.length
    ? await db.select({ id: schema.metaAds.adId })
      .from(schema.metaAds)
      .where(and(eq(schema.metaAds.tenantId, tenantId!), inArray(schema.metaAds.adSetId, adSets.map((set) => set.id))))
    : [];
  const campaignLeadCondition = campaignKeys.length ? inArray(schema.leads.metaCampaignId, campaignKeys) : undefined;
  const adLeadCondition = ads.length ? inArray(schema.leads.metaAdId, ads.map((ad) => ad.id)) : undefined;
  const leadAttribution = campaignLeadCondition && adLeadCondition
    ? or(campaignLeadCondition, adLeadCondition)
    : campaignLeadCondition ?? adLeadCondition;
  const leads = leadAttribution
    ? await db.select({ id: schema.leads.id, queueId: schema.leads.queueId, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, tenantId!),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
        leadAttribution,
      ))
    : [];

  const queueNames = new Map<string, string>();
  const usedQueueIds = [...new Set(leads.map((lead) => lead.queueId).filter((id): id is string => Boolean(id)))];
  if (usedQueueIds.length) {
    const currentQueues = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, tenantId!), inArray(schema.leadQueues.id, usedQueueIds)));
    for (const current of currentQueues) queueNames.set(current.id, current.name);
  }
  // Leads already attached to another queue may have a deliberate manual or
  // post-sale destination. The account policy routes new intake; retroactive
  // repair only fills missing queue links.
  const leadsToMove = leads.filter((lead) => lead.queueId === null);
  const byCurrentQueue = new Map<string, number>();
  for (const lead of leadsToMove) {
    const name = lead.queueId ? queueNames.get(lead.queueId) ?? lead.queueId : "sem fila";
    byCurrentQueue.set(name, (byCurrentQueue.get(name) ?? 0) + 1);
  }

  console.log(`Tenant: ${tenantId}`);
  console.log(`Conta Meta: ${account.name} (${adAccountId})`);
  console.log(`Fila destino: ${queue.name}`);
  console.log(`Campanhas sincronizadas: ${campaigns.length}`);
  console.log(`Leads ativos sem fila que receberiam o queueId: ${leadsToMove.length}`);
  console.log(`Leads que já estão em outra fila e permanecem nela: ${leads.length - leadsToMove.length}`);
  for (const [name, total] of byCurrentQueue) console.log(`  origem ${name}: ${total}`);
  if (!apply) {
    console.log("Prévia concluída sem gravação. Para aplicar, acrescente --apply.");
    return;
  }

  const [actor] = await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId!), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.tenantMemberships.createdAt))
    .limit(1);
  if (!actor?.userId) throw new Error("Não há membro ativo para registrar auditoria no tenant.");

  const now = new Date();
  let changedLeads = 0;
  await db.transaction(async (tx) => {
    await tx.update(schema.metaAdAccounts)
      .set({ defaultQueueId: queueId!, updatedAt: now })
      .where(and(eq(schema.metaAdAccounts.tenantId, tenantId!), eq(schema.metaAdAccounts.adAccountId, adAccountId!)));

    for (const campaign of campaigns) {
      const current = routesByCampaign.get(campaign.campaignId) ?? routesByCampaign.get(campaign.id);
      await tx.insert(schema.metaCampaignQueueRoutes).values({
        id: randomUUID(),
        tenantId: tenantId!,
        campaignId: campaign.campaignId,
        queueId: queueId!,
        enabled: current?.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [schema.metaCampaignQueueRoutes.tenantId, schema.metaCampaignQueueRoutes.campaignId],
        set: { queueId: queueId!, updatedAt: now },
      });
    }

    for (const lead of leadsToMove) {
      const update = await tx.update(schema.leads).set({ queueId: queueId! })
        .where(and(
          eq(schema.leads.tenantId, tenantId!),
          eq(schema.leads.id, lead.id),
          lead.queueId ? eq(schema.leads.queueId, lead.queueId) : isNull(schema.leads.queueId),
        ))
        .returning({ id: schema.leads.id });
      if (!update.length) continue;
      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: tenantId!,
        leadId: lead.id,
        fromQueueId: lead.queueId,
        toQueueId: queueId!,
        previousOwnerId: lead.corretorId,
        newOwnerId: lead.corretorId,
        action: "meta_ad_account_queue_repaired",
        source: "meta_ad_account_default_queue",
        strategy: "account_default",
        reason: `Fila atualizada para o destino padrão da conta Meta ${account.name}.`,
        actorId: actor.userId,
        metadata: { adAccountId, queueId },
        createdAt: now,
      });
      changedLeads += 1;
    }

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actor.userId,
      entidade: "meta_ad_account_queue_route",
      entidadeId: account.id,
      acao: "meta_ad_account.default_queue_updated",
    });
  });

  console.log(`Aplicado: destino padrão salvo, ${campaigns.length} campanha(s) alinhada(s) e ${changedLeads} lead(s) com fila ajustada.`);
  console.log("Corretor, unidade, status, SLA e atendimento foram preservados.");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("Falha ao configurar rota padrão da conta Meta:", error);
  process.exit(1);
});
