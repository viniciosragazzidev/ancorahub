import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, isNull, max } from "drizzle-orm";

import type { NetworkData, QuoteResult } from "@/features/global-catalog/pilot/contracts";
import { fold, simulate } from "@/features/global-catalog/pilot/engine";
import { loadPilotForTenant, loadPilotIndex, loadPlanShard } from "@/features/global-catalog/pilot/server";
import { getDatabase, schema } from "@/shared/db";
import { uploadR2Object } from "@/shared/storage/r2-storage";

import type { AutoSaleMode, DealFacts, OfferSnapshot, Promotion } from "./contracts";
import { quoteInputFromFacts } from "./facts";
import { allPages, CHEAPER_RELAXATIONS, pickCheaper, recommendationReason, relaxInput, selectOptions, toOfferPlan } from "./offer-strategy";
import { renderQuotePdf, type NetworkHighlight } from "./pdf";
import { renderPlanImage } from "./plan-image";
import { createPublicToken, publicLinkExpiresAt, publicQuoteUrl } from "./public-link";
import { entityFacets, resolveEntity } from "./entity-match";

export class QuoteUnavailableError extends Error {
  constructor(public readonly code: "catalog_unavailable" | "missing_facts" | "no_options" | "no_cheaper" | "entity_options" | "entity_unknown", public readonly options: string[] = []) {
    super(code);
  }
}

export function catalogToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Rede do plano perto do cliente, só do shard do catálogo (fonte). null quando não há rede. */
async function networkNear(config: NonNullable<Awaited<ReturnType<typeof loadPilotForTenant>>>, planId: string, facts: DealFacts): Promise<NetworkHighlight | null> {
  try {
    const raw = await loadPlanShard(config, "network", planId) as NetworkData;
    const city = fold(facts.city ?? "");
    const neighborhood = fold(facts.neighborhood ?? "");
    const units = (raw.unidades ?? []).filter((unit) => !city || fold(unit.cidade ?? "") === city);
    const near = neighborhood ? units.filter((unit) => fold(unit.bairro ?? "").includes(neighborhood)) : [];
    const pickFrom = (near.length ? near : units).filter((unit) => /hospital|laborat|pronto/i.test(unit.tipo ?? "") || !unit.tipo);
    const chosen = pickFrom.slice(0, 8).map((unit) => ({ name: String(unit.nome ?? "Unidade"), type: unit.tipo ?? null, neighborhood: unit.bairro ?? null }));
    return chosen.length ? { planId, units: chosen } : null;
  } catch {
    return null;
  }
}

type DealForQuote = { id: string; tenantId: string; leadId: string; mode: AutoSaleMode; facts: DealFacts };

/**
 * Cota com o catálogo real, sem sessão, grava o snapshot imutável, gera PDF e imagens e guarda no R2.
 * "cheaper" roda o `simulate` de novo relaxando um filtro por vez até achar algo mais em conta.
 */
export async function createOfferForDeal(input: {
  deal: DealForQuote;
  kind: "new" | "cheaper";
  previous: OfferSnapshot | null;
  customerName: string;
  brokerage: { name: string; phone: string | null; units: string[] };
  promotions: Promotion[];
}): Promise<{ snapshot: OfferSnapshot; pdf: { key: string; filename: string } ; images: { key: string; planId: string }[]; networkSourced: boolean; publicUrl: string; resolvedEntity: string | null }> {
  const config = await loadPilotForTenant(input.deal.tenantId);
  if (!config) throw new QuoteUnavailableError("catalog_unavailable");
  const parsedInput = quoteInputFromFacts(input.deal.facts);
  if (!parsedInput) throw new QuoteUnavailableError("missing_facts");
  const index = await loadPilotIndex(config);
  // Adesão: a profissão ou sigla dita pelo cliente vira a entidade exata do catálogo; na dúvida, pergunta.
  let quoteInput = parsedInput;
  let resolvedEntity: string | null = null;
  if (parsedInput.modality.startsWith("ADESAO")) {
    const resolution = resolveEntity(parsedInput.entity, entityFacets(index.plans, parsedInput.modality), index.options.professions ?? []);
    if ("options" in resolution) throw new QuoteUnavailableError("entity_options", resolution.options);
    if ("unknown" in resolution) throw new QuoteUnavailableError("entity_unknown");
    resolvedEntity = resolution.entity;
    quoteInput = { ...parsedInput, entity: resolution.entity };
  }
  const date = catalogToday();
  const reviewed = new Set(config.reviewedPlanIds), hidden = new Set(config.hiddenPlanIds);
  // Todas as páginas (o simulate pagina de 24 em 24, do mais barato): o plano conferido pode estar além da 1ª.
  const run = (value: typeof quoteInput) => allPages((page) => simulate(index.plans, { ...value, page }, date, reviewed, hidden, config.release));

  let plans: QuoteResult[] = [];
  let usedInput = quoteInput;
  let relaxed: OfferSnapshot["relaxed"] = null;
  let recommendedId: string | null = null;
  let reason: string | null = null;
  if (input.kind === "new") {
    const results = run(quoteInput);
    const selection = selectOptions(results, input.deal.facts, input.deal.mode);
    if (!selection.plans.length) throw new QuoteUnavailableError("no_options");
    const byId = new Map(results.map((result) => [result.id, result]));
    plans = selection.plans.map((plan) => byId.get(plan.id)!).filter(Boolean);
    recommendedId = selection.recommendedPlanId;
    reason = selection.recommendationReason;
  } else {
    const previousCheapest = input.previous?.plans[0]?.totalCents;
    if (previousCheapest == null) throw new QuoteUnavailableError("no_cheaper");
    const sameFilters = pickCheaper(run({ ...quoteInput, budgetCents: null }), previousCheapest, input.deal.mode);
    if (sameFilters.length) plans = sameFilters;
    else {
      for (const relaxation of CHEAPER_RELAXATIONS) {
        const candidateInput = relaxInput(quoteInput, relaxation.filter);
        const found = pickCheaper(run(candidateInput), previousCheapest, input.deal.mode);
        if (found.length) { plans = found; usedInput = candidateInput; relaxed = { filter: relaxation.filter, label: relaxation.label }; break; }
      }
    }
    if (!plans.length) throw new QuoteUnavailableError("no_cheaper");
    recommendedId = plans[0].id;
    reason = recommendationReason(plans[0], plans.map(toOfferPlan), input.deal.facts);
  }

  const db = getDatabase();
  const offerId = randomUUID();
  const offerPlans = plans.map(toOfferPlan);
  let version = 1;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [current] = await db.select({ version: max(schema.autoSaleOffers.version) }).from(schema.autoSaleOffers).where(eq(schema.autoSaleOffers.dealId, input.deal.id));
    version = (current?.version ?? 0) + 1;
    const inserted = await db.insert(schema.autoSaleOffers).values({
      id: offerId, tenantId: input.deal.tenantId, dealId: input.deal.id, version, input: usedInput, plans: offerPlans,
      recommendedPlanId: recommendedId, recommendationReason: reason, relaxed, previousOfferId: input.previous?.id ?? null,
      release: config.release, catalogDate: date,
    }).onConflictDoNothing().returning({ id: schema.autoSaleOffers.id });
    if (inserted[0]) break;
    if (attempt === 2) throw new Error("Não foi possível gravar a oferta.");
  }

  const snapshot: OfferSnapshot = {
    id: offerId, version, input: usedInput, plans: offerPlans, recommendedPlanId: recommendedId, recommendationReason: reason, relaxed,
    previousOfferId: input.previous?.id ?? null, previousTotalCents: input.previous?.plans[0]?.totalCents ?? null, release: config.release, catalogDate: date,
  };
  const network = recommendedId ? await networkNear(config, recommendedId, input.deal.facts) : null;
  const pdfBuffer = await renderQuotePdf({ offer: snapshot, facts: input.deal.facts, customerName: input.customerName, brokerage: input.brokerage, promotions: input.promotions, network, generatedAt: new Date() });
  const sha256 = createHash("sha256").update(pdfBuffer).digest("hex");
  const pdfKey = `auto-sale/${input.deal.tenantId}/${input.deal.id}/${offerId}.pdf`;
  await uploadR2Object(pdfKey, pdfBuffer, "application/pdf");
  const images: { key: string; planId: string }[] = [];
  for (const [position, plan] of offerPlans.entries()) {
    const png = await renderPlanImage(plan, { index: position, recommended: plan.id === recommendedId, brokerageName: input.brokerage.name });
    const key = `auto-sale/${input.deal.tenantId}/${input.deal.id}/${offerId}-${position + 1}.png`;
    await uploadR2Object(key, png, "image/png");
    images.push({ key, planId: plan.id });
  }
  // Link público (página da cotação): só o hash fica no banco; vale até a validade da cotação.
  const publicToken = createPublicToken();
  await db.update(schema.autoSaleOffers).set({ pdfKey, pdfSha256: sha256, imageKeys: images, network, publicTokenHash: publicToken.hash, publicExpiresAt: publicLinkExpiresAt(snapshot) })
    .where(and(eq(schema.autoSaleOffers.id, offerId), eq(schema.autoSaleOffers.tenantId, input.deal.tenantId), isNull(schema.autoSaleOffers.pdfKey)));
  const filename = `cotacao-${input.brokerage.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${version}.pdf`;
  return { snapshot, pdf: { key: pdfKey, filename }, images, networkSourced: Boolean(network), publicUrl: publicQuoteUrl(publicToken.token), resolvedEntity };
}
