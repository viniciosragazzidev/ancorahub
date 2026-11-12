import "server-only";

import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";

import type { DealFacts } from "./contracts";
import { readAutoSaleFlags } from "./flag";
import type { NetworkHighlight } from "./pdf";
import { hashPublicToken, isPublicLinkUsable, isPublicTokenShape } from "./public-link";
import { buildPublicQuoteView, type PublicQuoteView } from "./public-quote-view";
import { toOfferSnapshot } from "./repository";
import { activePromotions, brokerageInfo, recordTurn } from "./service";

async function findOffer(token: string) {
  if (!isPublicTokenShape(token)) return null;
  try {
    const [row] = await getDatabase().select({ offer: schema.autoSaleOffers, deal: schema.autoSaleDeals })
      .from(schema.autoSaleOffers).innerJoin(schema.autoSaleDeals, eq(schema.autoSaleDeals.id, schema.autoSaleOffers.dealId))
      .where(eq(schema.autoSaleOffers.publicTokenHash, hashPublicToken(token))).limit(1);
    if (!row || !isPublicLinkUsable({ expiresAt: row.offer.publicExpiresAt, revokedAt: row.offer.publicRevokedAt, now: new Date() })) return null;
    // Empresa com a Venda Automatizada desligada (ou kill switch): o link para de abrir.
    const flags = await readAutoSaleFlags(row.offer.tenantId);
    if (!flags.enabled || !flags.global) return null;
    return row;
  } catch (error) {
    if (isUndefinedTableError(error)) return null;
    throw error;
  }
}

/** Número de WhatsApp da corretora para o botão: o WAHA da negociação ou o canal oficial. */
async function brokerageWhatsapp(tenantId: string, channel: string, wahaNumberId: string | null) {
  const db = getDatabase();
  if (channel === "waha" && wahaNumberId) {
    const [number] = await db.select({ phone: schema.wahaNumbers.displayPhoneNumber }).from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.id, wahaNumberId), eq(schema.wahaNumbers.tenantId, tenantId))).limit(1);
    if (number?.phone) return number.phone;
  }
  const [meta] = await db.select({ phone: schema.communicationChannels.displayPhoneNumber }).from(schema.communicationChannels)
    .where(and(eq(schema.communicationChannels.tenantId, tenantId), isNotNull(schema.communicationChannels.displayPhoneNumber))).limit(1);
  return meta?.phone ?? null;
}

/**
 * A cotação pública pelo token (sem login). Conta a visita (no máximo uma a cada 10 min) e, na primeira,
 * registra "Cliente abriu a cotação" na negociação, que o gestor vê no painel.
 */
export async function loadPublicQuote(token: string): Promise<PublicQuoteView | null> {
  const row = await findOffer(token);
  if (!row) return null;
  const db = getDatabase();
  const now = new Date();
  const counted = await db.update(schema.autoSaleOffers).set({ publicViewCount: sql`${schema.autoSaleOffers.publicViewCount} + 1`, publicLastViewedAt: now })
    .where(and(eq(schema.autoSaleOffers.id, row.offer.id), or(isNull(schema.autoSaleOffers.publicLastViewedAt), lt(schema.autoSaleOffers.publicLastViewedAt, new Date(now.getTime() - 10 * 60_000)))))
    .returning({ views: schema.autoSaleOffers.publicViewCount });
  if (counted[0]?.views === 1) {
    await recordTurn(row.deal, { direction: "system", kind: "link_viewed", body: `Cliente abriu a cotação ${row.offer.version}`, decision: { offerId: row.offer.id } }).catch(() => undefined);
  }
  const [brokerage, promotions, phone] = await Promise.all([
    brokerageInfo(row.offer.tenantId),
    activePromotions(row.offer.tenantId, new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now)),
    brokerageWhatsapp(row.offer.tenantId, row.deal.channel, row.deal.wahaNumberId),
  ]);
  const [previous] = row.offer.previousOfferId
    ? await db.select({ plans: schema.autoSaleOffers.plans }).from(schema.autoSaleOffers).where(and(eq(schema.autoSaleOffers.id, row.offer.previousOfferId), eq(schema.autoSaleOffers.tenantId, row.offer.tenantId))).limit(1)
    : [];
  const previousTotal = (previous?.plans as { totalCents: number }[] | undefined)?.[0]?.totalCents ?? null;
  return buildPublicQuoteView({
    offer: toOfferSnapshot(row.offer, previousTotal),
    facts: row.deal.facts as DealFacts,
    brokerage: { name: brokerage.name, units: brokerage.units, whatsappPhone: phone },
    promotions,
    network: (row.offer.network as NetworkHighlight | null) ?? null,
  });
}

/** Chave do PDF da oferta pelo token (mesmas regras do link). */
export async function loadPublicQuotePdf(token: string) {
  const row = await findOffer(token);
  return row?.offer.pdfKey ? { key: row.offer.pdfKey, version: row.offer.version } : null;
}
