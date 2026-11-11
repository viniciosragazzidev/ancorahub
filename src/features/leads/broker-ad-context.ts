import { AD_TITLE_MAX, cleanAdText, safeImageUrl, type AdCreativeContent } from "@/features/meta-ads/ad-creative-parse";
import { isMetaObjectId } from "@/features/meta-ads/meta-id-validation";

/**
 * O que o corretor vê do anúncio que trouxe o lead (10/11/2026, Vinicios: "o
 * corretor tem que saber o conteúdo da campanha, plano etc para evitar oferecer
 * um plano mais caro quando a campanha é de um plano custo e benefício").
 *
 * Exceção estreita à regra de 16/10 (a origem fica oculta ao corretor): só o
 * conteúdo público do anúncio e o plano anunciado escrito pela gestão. Nome de
 * campanha, conjunto e anúncio, IDs, datas, verba e gasto nunca entram aqui.
 */
export type BrokerAdContext = {
  /** Formulário do anúncio ou WhatsApp do anúncio. */
  entry: "form" | "whatsapp";
  /** O plano que a campanha anuncia, escrito pela gestão. */
  offer: string | null;
  title: string | null;
  body: string | null;
  mediaType: "image" | "video" | "carousel" | null;
  imageUrl: string | null;
};

/** As únicas chaves que saem para o navegador do corretor. */
export const BROKER_AD_CONTEXT_KEYS = ["entry", "offer", "title", "body", "mediaType", "imageUrl"] as const;

export const BROKER_OFFER_MAX = 280;

type LeadOrigin = {
  sourceChannel: string | null;
  sourceAd?: string | null;
  sourceCampaign?: string | null;
  metaAdId: string | null;
  metaCampaignId: string | null;
  sourceMetadata: unknown;
};

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Só leads de anúncio da Meta (formulário ou WhatsApp). CSV, site e manual ficam sem cartão. */
export function brokerAdEntry(lead: Pick<LeadOrigin, "sourceChannel" | "sourceMetadata">): BrokerAdContext["entry"] | null {
  if (lead.sourceChannel !== "meta_lead_ads") return null;
  return metadataOf(lead.sourceMetadata).entry === "whatsapp" ? "whatsapp" : "form";
}

/** O anúncio e a campanha do lead, para buscar o criativo e o plano anunciado (nunca vão ao navegador). */
export function brokerAdKeys(lead: LeadOrigin) {
  if (!brokerAdEntry(lead)) return { adId: null, campaignId: null };
  const adId = [lead.metaAdId, lead.sourceAd].find((value): value is string => isMetaObjectId(value)) ?? null;
  const campaignId = [lead.metaCampaignId, lead.sourceCampaign].find((value): value is string => isMetaObjectId(value)) ?? null;
  return { adId, campaignId };
}

export function cleanBrokerOffer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, BROKER_OFFER_MAX) : null;
}

export function buildBrokerAdContext(input: {
  lead: LeadOrigin;
  creative: Pick<AdCreativeContent, "title" | "body" | "mediaType" | "imageUrl"> | null;
  offer: string | null;
}): BrokerAdContext | null {
  const entry = brokerAdEntry(input.lead);
  if (!entry) return null;
  // O WhatsApp do anúncio já grava o título no lead: vale enquanto a Graph não responde.
  const savedHeadline = cleanAdText(metadataOf(input.lead.sourceMetadata).adHeadline, AD_TITLE_MAX);
  const mediaType = input.creative?.mediaType;
  const context: BrokerAdContext = {
    entry,
    offer: cleanBrokerOffer(input.offer),
    title: cleanAdText(input.creative?.title, AD_TITLE_MAX) ?? savedHeadline,
    body: cleanAdText(input.creative?.body, 1000),
    mediaType: mediaType === "image" || mediaType === "video" || mediaType === "carousel" ? mediaType : null,
    imageUrl: safeImageUrl(input.creative?.imageUrl),
  };
  // Sem nada para mostrar, não há cartão (não aparece "Sem anúncio").
  if (!context.offer && !context.title && !context.body && !context.imageUrl) return null;
  return context;
}
