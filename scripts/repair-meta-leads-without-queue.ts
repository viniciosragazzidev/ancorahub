/**
 * Reassocia leads Meta sem fila à fila ativa configurada na campanha.
 *
 * Seguro por padrão: só lê e apresenta uma prévia. A aplicação exige --apply
 * e um tenant explícito ou uma campanha CRM. Leads sem atribuição inequívoca ou
 * sem fila ativa são listados como ignorados. A única alteração em cada lead é
 * queueId; corretor, unidade, status, SLA e atendimento ficam intocados.
 *
 * Uso:
 *   npx tsx scripts/repair-meta-leads-without-queue.ts --campaign <crm-campaign-id>
 *   npx tsx scripts/repair-meta-leads-without-queue.ts --campaign <crm-campaign-id> --apply
 *   npx tsx scripts/repair-meta-leads-without-queue.ts --tenant <tenant-id> [--apply]
 */
import { loadEnvConfig } from "@next/env";
import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

type Route = {
  enabled: boolean;
  queueId: string | null;
  queueStatus: string | null;
};

type Candidate = {
  id: string;
  queueId: string | null;
  metaCampaignId: string | null;
  metaAdId: string | null;
  metaFormId: string | null;
  sourceForm: string | null;
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tenantIndex = args.indexOf("--tenant");
const campaignIndex = args.indexOf("--campaign");
let tenantId = tenantIndex >= 0 ? args[tenantIndex + 1] : undefined;
const campaignIdArg = campaignIndex >= 0 ? args[campaignIndex + 1] : undefined;
if ((!tenantId || tenantId.startsWith("--")) && (!campaignIdArg || campaignIdArg.startsWith("--"))) {
  console.error("Informe --campaign <crm-campaign-id> ou --tenant <tenant-id>.");
  process.exit(2);
}

const db = getDatabase();

async function resolveActorId(): Promise<string> {
  const [member] = await db
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId!), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.tenantMemberships.createdAt))
    .limit(1);
  if (!member?.userId) throw new Error(`Não existe membro ativo para auditar operações no tenant ${tenantId}.`);
  return member.userId;
}

function canonicalCampaignId(
  value: string | null | undefined,
  campaignById: Map<string, string>,
): string | null {
  if (!value) return null;
  return campaignById.get(value) ?? value;
}

async function main() {
  if (campaignIdArg && !campaignIdArg.startsWith("--")) {
    const [campaign] = await db
      .select({ tenantId: schema.metaCampaigns.tenantId })
      .from(schema.metaCampaigns)
      .where(eq(schema.metaCampaigns.id, campaignIdArg))
      .limit(1);
    if (!campaign) throw new Error(`Campanha CRM não encontrada: ${campaignIdArg}`);
    if (tenantId && tenantId !== campaign.tenantId) throw new Error("A campanha não pertence ao tenant informado.");
    tenantId = campaign.tenantId;
  }

  const campaigns = await db
    .select({ id: schema.metaCampaigns.id, externalId: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name })
    .from(schema.metaCampaigns)
    .where(eq(schema.metaCampaigns.tenantId, tenantId!));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign.externalId]));

  const routeRows = await db
    .select({
      campaignId: schema.metaCampaignQueueRoutes.campaignId,
      queueId: schema.metaCampaignQueueRoutes.queueId,
      enabled: schema.metaCampaignQueueRoutes.enabled,
      queueStatus: schema.leadQueues.status,
    })
    .from(schema.metaCampaignQueueRoutes)
    .leftJoin(schema.leadQueues, and(
      eq(schema.leadQueues.id, schema.metaCampaignQueueRoutes.queueId),
      eq(schema.leadQueues.tenantId, schema.metaCampaignQueueRoutes.tenantId),
    ))
    .where(eq(schema.metaCampaignQueueRoutes.tenantId, tenantId!));
  const routes = new Map<string, Route>();
  for (const route of routeRows) {
    routes.set(route.campaignId, {
      enabled: route.enabled,
      queueId: route.queueId,
      queueStatus: route.queueStatus,
    });
  }

  const adRows = await db
    .select({ adId: schema.metaAds.adId, campaignId: schema.metaAdSets.campaignId })
    .from(schema.metaAds)
    .innerJoin(schema.metaAdSets, and(
      eq(schema.metaAdSets.tenantId, schema.metaAds.tenantId),
      eq(schema.metaAdSets.adSetId, schema.metaAds.adSetId),
    ))
    .where(eq(schema.metaAds.tenantId, tenantId!));
  const campaignByAd = new Map(adRows.map((row) => [row.adId, canonicalCampaignId(row.campaignId, campaignById)]));

  // Um formulário só pode ser usado como chave secundária se o histórico o
  // relacionar a uma única campanha neste tenant. Formulários compartilhados
  // permanecem ambíguos e não são adivinhados.
  const attributedLeads = await db
    .select({ formId: schema.leads.metaFormId, campaignId: schema.leads.metaCampaignId })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, tenantId!),
      isNull(schema.leads.deletedAt),
      isNotNull(schema.leads.metaFormId),
      isNotNull(schema.leads.metaCampaignId),
    ));
  const campaignsByForm = new Map<string, Set<string>>();
  for (const row of attributedLeads) {
    if (!row.formId || !row.campaignId) continue;
    const values = campaignsByForm.get(row.formId) ?? new Set<string>();
    values.add(canonicalCampaignId(row.campaignId, campaignById)!);
    campaignsByForm.set(row.formId, values);
  }

  const candidates = await db
    .select({
      id: schema.leads.id,
      queueId: schema.leads.queueId,
      metaCampaignId: schema.leads.metaCampaignId,
      metaAdId: schema.leads.metaAdId,
      metaFormId: schema.leads.metaFormId,
      sourceForm: schema.leads.sourceForm,
    })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, tenantId!),
      isNull(schema.leads.queueId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      or(
        eq(schema.leads.sourceChannel, "meta_lead_ads"),
        isNotNull(schema.leads.metaCampaignId),
        isNotNull(schema.leads.metaAdId),
        isNotNull(schema.leads.metaFormId),
      ),
    )) as Candidate[];

  const planned: Array<{ lead: Candidate; campaignId: string; queueId: string; resolvedBy: string }> = [];
  const skipped = new Map<string, number>();
  const skippedByCampaign = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

  for (const lead of candidates) {
    let campaignId = canonicalCampaignId(lead.metaCampaignId, campaignById);
    let resolvedBy = "campanha";
    if (!campaignId && lead.metaAdId) {
      campaignId = campaignByAd.get(lead.metaAdId) ?? null;
      resolvedBy = "anúncio";
    }
    if (!campaignId) {
      const formId = lead.metaFormId ?? lead.sourceForm;
      const formCampaigns = formId ? campaignsByForm.get(formId) : undefined;
      if (formCampaigns?.size === 1) {
        campaignId = [...formCampaigns][0];
        resolvedBy = "formulário";
      } else if (formCampaigns && formCampaigns.size > 1) {
        skip("formulário compartilhado por campanhas diferentes (ambíguo)");
        skippedByCampaign.set(`formulário ambíguo · ${lead.metaFormId ?? lead.sourceForm}`, (skippedByCampaign.get(`formulário ambíguo · ${lead.metaFormId ?? lead.sourceForm}`) ?? 0) + 1);
        continue;
      }
    }
    if (!campaignId) {
      skip("sem campanha/anúncio/formulário que identifique uma campanha");
      skippedByCampaign.set("campanha não identificada", (skippedByCampaign.get("campanha não identificada") ?? 0) + 1);
      continue;
    }

    // External Meta ID wins; internal CRM UUID is supported for legacy routes.
    const internalId = campaigns.find((campaign) => campaign.externalId === campaignId)?.id;
    const route = routes.get(campaignId) ?? (internalId ? routes.get(internalId) : undefined);
    if (!route?.enabled || !route.queueId || route.queueStatus !== "active") {
      skip("campanha sem fila ativa configurada");
      const campaignName = campaigns.find((campaign) => campaign.externalId === campaignId)?.name ?? campaignId;
      skippedByCampaign.set(campaignName, (skippedByCampaign.get(campaignName) ?? 0) + 1);
      continue;
    }
    planned.push({ lead, campaignId, queueId: route.queueId, resolvedBy });
  }

  console.log(`Tenant: ${tenantId}`);
  console.log(`Leads Meta sem fila analisados: ${candidates.length}`);
  console.log(`Leads que receberiam apenas o vínculo da fila: ${planned.length}`);
  for (const [reason, total] of skipped) console.log(`  ignorados — ${reason}: ${total}`);
  if (skippedByCampaign.size) {
    console.log("Campanhas/formulários pendentes para definir destino:");
    for (const [name, total] of skippedByCampaign) console.log(`  ${name}: ${total}`);
  }
  if (!apply) {
    console.log("\nPrévia concluída sem gravar alterações. Para aplicar, repita com --apply.");
    return;
  }
  if (!planned.length) {
    console.log("\nNenhum lead elegível para alteração.");
    return;
  }

  const actorId = await resolveActorId();
  const now = new Date();
  let updatedCount = 0;
  await db.transaction(async (tx) => {
    for (const item of planned) {
      const lead = item.lead;
      const update = await tx
        .update(schema.leads)
        .set({ queueId: item.queueId })
        .where(and(
          eq(schema.leads.id, lead.id),
          eq(schema.leads.tenantId, tenantId!),
          isNull(schema.leads.queueId),
        ))
        .returning({ id: schema.leads.id });
      if (!update.length) continue;

      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: tenantId!,
        leadId: lead.id,
        fromQueueId: null,
        toQueueId: item.queueId,
        action: "meta_campaign_queue_repaired",
        source: "meta_campaign_routing_repair",
        strategy: "campaign_queue",
        reason: `Fila restaurada a partir da rota ativa da campanha Meta (resolvida por ${item.resolvedBy}).`,
        actorId,
        metadata: { campaignId: item.campaignId, resolvedBy: item.resolvedBy },
        createdAt: now,
      });

      updatedCount += 1;
    }

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorId,
      entidade: "lead_distribution",
      entidadeId: tenantId!,
      acao: "lead.meta_campaign_queue_repair",
    });
  });

  console.log(`\nReparo concluído: ${updatedCount}/${planned.length} lead(s) atualizados.`);
  console.log("Somente queueId foi atualizado; nenhum lead foi redistribuído nem teve corretor, status, unidade ou SLA alterados.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao reparar leads Meta sem fila:", error);
    process.exit(1);
  });
