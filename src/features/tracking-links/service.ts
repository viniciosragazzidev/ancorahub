import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { postgresErrorCode } from "@/shared/db/postgres-errors";

import {
  generateLinkCode,
  normalizeLinkCode,
  saoPauloDay,
  validateLinkInput,
  type RedirectLink,
  type TrackingLinkDestination,
  type TrackingLinkInput,
  type TrackingLinkStatus,
} from "./core";

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

/** A migration 0245 está aplicada? Sem as tabelas, a tela mostra "ainda não ligado" e /r/ vai para o formulário público. */
export async function trackingLinksReady(now = Date.now()): Promise<boolean> {
  if (readyCache?.value && now - readyCache.at < READY_TTL_MS) return true;
  if (readyCache && !readyCache.value && now - readyCache.at < READY_TTL_MS) return false;
  const value = await getDatabase()
    .execute(sql`select to_regclass('public.tracking_links') is not null and to_regclass('public.tracking_link_clicks') is not null as ready`)
    .then((result) => Boolean(rowsOf<{ ready?: boolean }>(result)[0]?.ready))
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

export type TrackingLinkRow = {
  id: string;
  code: string;
  name: string;
  destination: TrackingLinkDestination;
  whatsappPhone: string | null;
  whatsappMessage: string | null;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
  status: TrackingLinkStatus;
  createdAt: string;
  clicks: number;
  leads: number;
  sales: number;
};

export type TrackingLinksPage =
  | { ready: false }
  | { ready: true; links: TrackingLinkRow[]; numbers: { phone: string; label: string }[] };

/** Links da empresa com cliques, leads e vendas (lead convertido) de cada um. */
export async function listTrackingLinks(tenantId: string): Promise<TrackingLinksPage> {
  if (!(await trackingLinksReady())) return { ready: false };
  const db = getDatabase();
  const [links, numbers] = await Promise.all([
    db.execute(sql`
      select l.id, l.code, l.name, l.destination, l.whatsapp_phone, l.whatsapp_message, l.utm_source, l.utm_medium,
        l.utm_campaign, l.status, l.created_at,
        coalesce((select sum(c.clicks) from tracking_link_clicks c where c.link_id = l.id), 0)::int as clicks,
        coalesce(a.leads, 0)::int as leads, coalesce(a.sales, 0)::int as sales
      from tracking_links l
      left join lateral (
        select count(*) as leads, count(*) filter (where ld.status = 'converted') as sales
        from leads ld
        where ld.tenant_id = l.tenant_id and ld.source_metadata ? 'trackingLinkId' and ld.source_metadata->>'trackingLinkId' = l.id
      ) a on true
      where l.tenant_id = ${tenantId} and l.deleted_at is null
      order by l.created_at desc
      limit 500
    `),
    companyWhatsappNumbers(tenantId),
  ]);
  return {
    ready: true,
    numbers,
    links: rowsOf<Record<string, unknown>>(links).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      destination: row.destination === "whatsapp" ? "whatsapp" : "form",
      whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
      whatsappMessage: (row.whatsapp_message as string | null) ?? null,
      utmSource: String(row.utm_source),
      utmMedium: (row.utm_medium as string | null) ?? null,
      utmCampaign: (row.utm_campaign as string | null) ?? null,
      status: row.status === "paused" ? "paused" : "active",
      createdAt: new Date(row.created_at as string).toISOString(),
      clicks: Number(row.clicks ?? 0),
      leads: Number(row.leads ?? 0),
      sales: Number(row.sales ?? 0),
    })),
  };
}

/** Números de WhatsApp da empresa (WAHA da empresa e canais compartilhados ativos), sem os pessoais dos corretores. */
export async function companyWhatsappNumbers(tenantId: string): Promise<{ phone: string; label: string }[]> {
  const db = getDatabase();
  const [waha, channels] = await Promise.all([
    db.select({ phone: schema.wahaNumbers.displayPhoneNumber, label: schema.wahaNumbers.label })
      .from(schema.wahaNumbers)
      .where(eq(schema.wahaNumbers.tenantId, tenantId))
      .catch(() => []),
    db.select({ phone: schema.communicationChannels.displayPhoneNumber, label: schema.communicationChannels.verifiedName })
      .from(schema.communicationChannels)
      .where(and(eq(schema.communicationChannels.tenantId, tenantId), eq(schema.communicationChannels.status, "active"), isNull(schema.communicationChannels.ownerUserId)))
      .catch(() => []),
  ]);
  const seen = new Set<string>();
  const out: { phone: string; label: string }[] = [];
  for (const entry of [...waha, ...channels]) {
    const digits = (entry.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10 || seen.has(digits)) continue;
    seen.add(digits);
    out.push({ phone: digits, label: entry.label?.trim() || "WhatsApp da empresa" });
  }
  return out;
}

/** Cliques por dia dos últimos `days` dias (só os dias com clique). */
export async function trackingLinkDailyClicks(tenantId: string, linkId: string, days = 30): Promise<{ day: string; clicks: number }[]> {
  if (!(await trackingLinksReady())) return [];
  const db = getDatabase();
  const since = saoPauloDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await db.select({ day: schema.trackingLinkClicks.day, clicks: schema.trackingLinkClicks.clicks })
    .from(schema.trackingLinkClicks)
    .innerJoin(schema.trackingLinks, eq(schema.trackingLinks.id, schema.trackingLinkClicks.linkId))
    .where(and(eq(schema.trackingLinks.tenantId, tenantId), eq(schema.trackingLinkClicks.linkId, linkId), gte(schema.trackingLinkClicks.day, since)))
    .orderBy(desc(schema.trackingLinkClicks.day));
  return rows.map((row) => ({ day: String(row.day), clicks: Number(row.clicks) }));
}

export class TrackingLinkError extends Error {}

const NOT_READY = "Os links rastreáveis ainda não estão ligados nesta empresa.";

export async function createTrackingLink(context: { tenantId: string; userId: string }, input: TrackingLinkInput) {
  if (!(await trackingLinksReady())) throw new TrackingLinkError(NOT_READY);
  const valid = validateLinkInput(input);
  if (!valid.ok) throw new TrackingLinkError(valid.error);
  const db = getDatabase();
  // Colisão de código é rara (31^7); tenta de novo algumas vezes.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomUUID();
    const code = generateLinkCode((size) => randomBytes(size));
    try {
      await db.insert(schema.trackingLinks).values({ id, tenantId: context.tenantId, code, createdBy: context.userId, ...valid.data });
      return { id, code };
    } catch (error) {
      if (postgresErrorCode(error) === "23505") continue;
      throw error;
    }
  }
  throw new TrackingLinkError("Não consegui gerar um código livre. Tente de novo.");
}

export async function setTrackingLinkStatus(tenantId: string, linkId: string, status: TrackingLinkStatus) {
  if (!(await trackingLinksReady())) throw new TrackingLinkError(NOT_READY);
  const updated = await getDatabase().update(schema.trackingLinks)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.trackingLinks.id, linkId), eq(schema.trackingLinks.tenantId, tenantId), isNull(schema.trackingLinks.deletedAt)))
    .returning({ id: schema.trackingLinks.id });
  if (!updated.length) throw new TrackingLinkError("Esse link não existe mais.");
}

/** Excluir tira o link da lista e desliga /r/<code>; os leads que vieram por ele continuam com a origem. */
export async function deleteTrackingLink(tenantId: string, linkId: string) {
  if (!(await trackingLinksReady())) throw new TrackingLinkError(NOT_READY);
  const now = new Date();
  const updated = await getDatabase().update(schema.trackingLinks)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(schema.trackingLinks.id, linkId), eq(schema.trackingLinks.tenantId, tenantId), isNull(schema.trackingLinks.deletedAt)))
    .returning({ id: schema.trackingLinks.id });
  if (!updated.length) throw new TrackingLinkError("Esse link não existe mais.");
}

/** Link ativo pelo código, para o redirecionamento público. Só o que o redirecionamento usa. */
export async function findActiveLinkByCode(rawCode: string): Promise<(RedirectLink & { id: string }) | null> {
  const code = normalizeLinkCode(rawCode);
  if (!code || !(await trackingLinksReady())) return null;
  const [row] = await getDatabase().select({
    id: schema.trackingLinks.id,
    code: schema.trackingLinks.code,
    destination: schema.trackingLinks.destination,
    whatsappPhone: schema.trackingLinks.whatsappPhone,
    whatsappMessage: schema.trackingLinks.whatsappMessage,
    utmSource: schema.trackingLinks.utmSource,
    utmMedium: schema.trackingLinks.utmMedium,
    utmCampaign: schema.trackingLinks.utmCampaign,
  })
    .from(schema.trackingLinks)
    .where(and(eq(schema.trackingLinks.code, code), eq(schema.trackingLinks.status, "active"), isNull(schema.trackingLinks.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Soma um clique no dia. Um único upsert, sem ler antes: cliques simultâneos não se perdem nem travam. */
export async function recordTrackingLinkClick(linkId: string, now = new Date()) {
  await getDatabase().insert(schema.trackingLinkClicks)
    .values({ linkId, day: saoPauloDay(now), clicks: 1 })
    .onConflictDoUpdate({
      target: [schema.trackingLinkClicks.linkId, schema.trackingLinkClicks.day],
      set: { clicks: sql`${schema.trackingLinkClicks.clicks} + 1` },
    });
}

/**
 * O link para atribuir um lead: só da mesma empresa. Pausado ainda atribui (quem clicou antes de pausar), excluído não.
 * Qualquer falha devolve null: a atribuição nunca segura a entrada do lead.
 */
export async function findLinkForAttribution(tenantId: string, rawCode: string | null | undefined) {
  const code = normalizeLinkCode(rawCode);
  if (!code) return null;
  try {
    if (!(await trackingLinksReady())) return null;
    const [row] = await getDatabase().select({
      id: schema.trackingLinks.id,
      code: schema.trackingLinks.code,
      name: schema.trackingLinks.name,
      utmSource: schema.trackingLinks.utmSource,
      utmMedium: schema.trackingLinks.utmMedium,
      utmCampaign: schema.trackingLinks.utmCampaign,
    })
      .from(schema.trackingLinks)
      .where(and(eq(schema.trackingLinks.tenantId, tenantId), eq(schema.trackingLinks.code, code), isNull(schema.trackingLinks.deletedAt)))
      .limit(1);
    return row ?? null;
  } catch (error) {
    console.warn("[tracking-links] attribution_lookup_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return null;
  }
}

/** Só para os testes. */
export function resetTrackingLinksReadyCache() {
  readyCache = null;
}

