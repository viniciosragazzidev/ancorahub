import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { parseGraphAdCreative, type AdCreativeContent } from "./ad-creative-parse";
import { MetaGraphClient } from "./meta-graph-client";
import { isMetaObjectId } from "./meta-id-validation";
import { decryptMetaToken } from "./meta-oauth";

/** As URLs de imagem da Meta expiram: depois disso a Graph é lida de novo. */
export const AD_CREATIVE_TTL_MS = 24 * 60 * 60 * 1000;
/** Anúncio apagado ou sem permissão: no máximo 3 tentativas, uma por dia. */
const MAX_FETCH_ATTEMPTS = 3;
const FAILURE_PAUSE_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedAdCreative = AdCreativeContent & { fetchedAt: Date | null; fetchAttempts: number; source: string };

export async function readAdCreative(tenantId: string, adId: string): Promise<CachedAdCreative | null> {
  const [row] = await getDatabase()
    .select({
      title: schema.metaAdCreatives.title,
      body: schema.metaAdCreatives.body,
      mediaType: schema.metaAdCreatives.mediaType,
      imageUrl: schema.metaAdCreatives.imageUrl,
      fetchedAt: schema.metaAdCreatives.fetchedAt,
      fetchAttempts: schema.metaAdCreatives.fetchAttempts,
      source: schema.metaAdCreatives.source,
    })
    .from(schema.metaAdCreatives)
    .where(and(eq(schema.metaAdCreatives.tenantId, tenantId), eq(schema.metaAdCreatives.adId, adId)))
    .limit(1);
  if (!row) return null;
  const mediaType = row.mediaType === "image" || row.mediaType === "video" || row.mediaType === "carousel" ? row.mediaType : null;
  return { ...row, mediaType };
}

/** Precisa ler a Graph? Nunca lido, imagem velha ou falhas ainda dentro do limite. */
export function shouldRefreshAdCreative(cached: Pick<CachedAdCreative, "fetchedAt" | "fetchAttempts" | "source"> | null, now = new Date()) {
  if (!cached) return true;
  // O referral do WhatsApp nunca passou pela Graph: a primeira leitura completa a imagem e o texto.
  if (!cached.fetchedAt) return cached.fetchAttempts < MAX_FETCH_ATTEMPTS;
  const age = now.getTime() - cached.fetchedAt.getTime();
  if (cached.fetchAttempts >= MAX_FETCH_ATTEMPTS) return age > FAILURE_PAUSE_MS;
  return age > AD_CREATIVE_TTL_MS;
}

/** O referral do clique chega antes da Graph: guarda o que veio, sem apagar o que já existe. */
export async function saveReferralAdCreative(tenantId: string, adId: string, content: AdCreativeContent) {
  if (!isMetaObjectId(adId)) return;
  const db = getDatabase();
  const existing = await readAdCreative(tenantId, adId);
  const now = new Date();
  if (!existing) {
    await db.insert(schema.metaAdCreatives).values({
      id: randomUUID(), tenantId, adId, source: "referral",
      title: content.title, body: content.body, mediaType: content.mediaType, imageUrl: content.imageUrl,
      createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    return;
  }
  const fill = {
    title: existing.title ?? content.title,
    body: existing.body ?? content.body,
    mediaType: existing.mediaType ?? content.mediaType,
    imageUrl: existing.imageUrl ?? content.imageUrl,
  };
  if (fill.title === existing.title && fill.body === existing.body && fill.mediaType === existing.mediaType && fill.imageUrl === existing.imageUrl) return;
  await db.update(schema.metaAdCreatives).set({ ...fill, updatedAt: now })
    .where(and(eq(schema.metaAdCreatives.tenantId, tenantId), eq(schema.metaAdCreatives.adId, adId)));
}

async function connectionToken(tenantId: string) {
  const [connection] = await getDatabase()
    .select({ accessTokenCiphertext: schema.metaConnections.accessTokenCiphertext })
    .from(schema.metaConnections)
    .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
    .orderBy(desc(schema.metaConnections.updatedAt))
    .limit(1);
  return connection?.accessTokenCiphertext ? decryptMetaToken(connection.accessTokenCiphertext) : null;
}

/** Lê o criativo na Graph e grava. Falha não lança: o cartão mostra o que houver. */
export async function refreshAdCreative(tenantId: string, adId: string, now = new Date()) {
  if (!isMetaObjectId(adId)) return null;
  const cached = await readAdCreative(tenantId, adId);
  if (!shouldRefreshAdCreative(cached, now)) return cached;

  const db = getDatabase();
  const where = and(eq(schema.metaAdCreatives.tenantId, tenantId), eq(schema.metaAdCreatives.adId, adId));
  let content: AdCreativeContent | null = null;
  let error: string | null = null;
  try {
    const token = await connectionToken(tenantId);
    if (!token) error = "sem_conexao_meta";
    else {
      const creative = await new MetaGraphClient(token).fetchAdCreative(adId);
      content = creative ? parseGraphAdCreative(creative) : null;
      if (!content) error = "sem_criativo";
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message.slice(0, 300) : "erro_meta";
  }

  if (content) {
    // A Graph manda no que tem; o referral fica onde a Graph não trouxe nada.
    const values = {
      title: content.title ?? cached?.title ?? null,
      body: content.body ?? cached?.body ?? null,
      mediaType: content.mediaType ?? cached?.mediaType ?? null,
      imageUrl: content.imageUrl ?? cached?.imageUrl ?? null,
      source: "graph", fetchedAt: now, fetchError: null, fetchAttempts: 0, updatedAt: now,
    };
    if (cached) await db.update(schema.metaAdCreatives).set(values).where(where);
    else await db.insert(schema.metaAdCreatives).values({ id: randomUUID(), tenantId, adId, createdAt: now, ...values }).onConflictDoUpdate({ target: [schema.metaAdCreatives.tenantId, schema.metaAdCreatives.adId], set: values });
    return readAdCreative(tenantId, adId);
  }

  const attempts = (cached?.fetchAttempts ?? 0) + 1;
  if (cached) await db.update(schema.metaAdCreatives).set({ fetchedAt: now, fetchError: error, fetchAttempts: attempts, updatedAt: now }).where(where);
  else await db.insert(schema.metaAdCreatives).values({ id: randomUUID(), tenantId, adId, source: "graph", fetchedAt: now, fetchError: error, fetchAttempts: attempts, createdAt: now, updatedAt: now }).onConflictDoNothing();
  console.warn("[meta-ad-creative] fetch.failed", { tenantId, adId, attempts, error });
  return cached;
}

const inflight = new Set<string>();

/** Em segundo plano: nunca atrasa a entrada do lead nem a tela do corretor. */
export function scheduleAdCreativeRefresh(tenantId: string, adId: string | null | undefined) {
  if (!adId || !isMetaObjectId(adId)) return;
  const key = `${tenantId}:${adId}`;
  if (inflight.has(key)) return;
  inflight.add(key);
  void refreshAdCreative(tenantId, adId)
    .catch((error) => console.warn("[meta-ad-creative] refresh.crashed", { tenantId, adId, error: error instanceof Error ? error.message : String(error) }))
    .finally(() => inflight.delete(key));
}
