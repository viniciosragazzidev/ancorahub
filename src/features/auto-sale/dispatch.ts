import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, count, eq, gte, inArray, lte, or, isNull } from "drizzle-orm";

import { uploadMetaMediaObject } from "@/features/communication-channels/conversation-media";
import { sendMetaCloudMediaMessage } from "@/features/communication-channels/meta-media-send";
import { brokerMetaWindowOpen, enqueueMetaTextMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getPreferredMetaCloudChannel } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

import { OPEN_DEAL_STATUSES } from "./contracts";
import { readAutoSaleFlags } from "./flag";
import { canSpeakNow, nextSendWindowStart, withinRateLimits } from "./guardrails";
import { callManager } from "./service";

type OutboxRow = typeof schema.autoSaleOutbox.$inferSelect;

export const HOLD_REASONS = {
  window: "Fora da janela de 24 h da Meta: precisa de template aprovado.",
  wahaMedia: "O WAHA não envia PDF nem imagem: baixe o PDF e envie, ou use a Meta com a janela aberta.",
  rate: "Limite de mensagens por hora ou por dia atingido.",
  channel: "Canal indisponível.",
  pdfLimit: "Limite de PDFs desta negociação atingido.",
} as const;

async function hold(row: OutboxRow, reason: string) {
  await getDatabase().update(schema.autoSaleOutbox).set({ status: "held", holdReason: reason, updatedAt: new Date() }).where(eq(schema.autoSaleOutbox.id, row.id));
}

async function sentTimes(dealId: string) {
  const rows = await getDatabase().select({ sentAt: schema.autoSaleOutbox.sentAt }).from(schema.autoSaleOutbox)
    .where(and(eq(schema.autoSaleOutbox.dealId, dealId), eq(schema.autoSaleOutbox.status, "sent"), gte(schema.autoSaleOutbox.sentAt, new Date(Date.now() - 86_400_000))));
  return rows.map((row) => row.sentAt!).filter(Boolean);
}

/** Texto pelo número WAHA da negociação, no outbox protegido (mesma rota do pós-venda), sem fallback. */
async function enqueueWahaText(row: OutboxRow, deal: { leadId: string; wahaNumberId: string | null; chosenBy: string }, phone: string) {
  const db = getDatabase();
  const [number] = await db.select({ id: schema.wahaNumbers.id, status: schema.wahaNumbers.status, pausedUntil: schema.wahaNumbers.pausedUntil })
    .from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.id, deal.wahaNumberId ?? ""), eq(schema.wahaNumbers.tenantId, row.tenantId))).limit(1);
  if (!number || !["active", "ready"].includes(number.status) || (number.pausedUntil && number.pausedUntil > new Date())) return null;
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: row.tenantId, channelId: null, deliveryRoute: "waha_direct", wahaNumberId: number.id, recipientType: "lead", recipientId: deal.leadId,
    destinationPhone: phone, purpose: "autoSale", messageType: "text", templateName: "__text__", templateLanguage: "pt_BR", variables: [row.body ?? ""],
    renderedBody: row.body ?? "", status: "queued", idempotencyKey: row.idempotencyKey, queuedAt: now, requestedBy: deal.chosenBy, createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  return id;
}

/**
 * Texto sai na hora (12/11, caso Alex): antes ficava na fila da Meta esperando o robô do WhatsApp e não entrava na
 * conversa do CRM. Agora processa a linha já, grava na conversa (como a qualificação faz) e falha de verdade vira erro.
 * Ainda na fila (nova tentativa da Meta): segue pelo robô do WhatsApp.
 */
async function deliverTextNow(row: OutboxRow, deal: { tenantId: string; leadId: string }, phone: string, outboundId: string) {
  const db = getDatabase();
  await processMetaOutboundBatch(1, deal.tenantId, outboundId).catch((error) => console.warn("[auto-sale] text_delivery_deferred", { outboundId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  const [delivery] = await db.select({
    status: schema.whatsappOutboundMessages.status, providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
    channelId: schema.whatsappOutboundMessages.channelId, deliveryRoute: schema.whatsappOutboundMessages.deliveryRoute,
    wahaNumberId: schema.whatsappOutboundMessages.wahaNumberId, error: schema.whatsappOutboundMessages.providerErrorMessage,
  }).from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.id, outboundId), eq(schema.whatsappOutboundMessages.tenantId, deal.tenantId))).limit(1);
  if (!delivery) return outboundId;
  if (["failed", "cancelled", "skipped"].includes(delivery.status)) throw new Error(delivery.error ?? `Envio ${delivery.status}.`);
  if (!["sent", "delivered", "read"].includes(delivery.status)) return outboundId;
  const viaWaha = delivery.deliveryRoute === "waha_direct";
  await db.insert(schema.whatsappMessages).values({
    id: randomUUID(), tenantId: deal.tenantId, leadId: deal.leadId, communicationChannelId: viaWaha ? null : delivery.channelId,
    wahaNumberId: viaWaha ? delivery.wahaNumberId : null, senderRole: "assistant", provider: viaWaha ? "waha" : META_CLOUD_PROVIDER, providerStatus: "sent",
    messageId: delivery.providerMessageId ?? undefined, phone, direction: "outbound", body: row.body ?? "", sentAt: new Date(),
  }).onConflictDoNothing();
  return delivery.providerMessageId ?? outboundId;
}

async function sendMedia(row: OutboxRow, deal: { tenantId: string; leadId: string; chosenBy: string }, phone: string) {
  const channel = await getPreferredMetaCloudChannel({ tenantId: deal.tenantId, userId: deal.chosenBy, leadId: deal.leadId, customerPhone: phone });
  if (!channel || "blocked" in channel) return null;
  const body = Buffer.from(await (await downloadR2Object(row.mediaKey!)).arrayBuffer());
  const kind = row.kind === "document" ? "document" : "image";
  const mime = row.mediaMime ?? (kind === "document" ? "application/pdf" : "image/png");
  const mediaId = await uploadMetaMediaObject({ channel, body, mimeType: mime, kind });
  const sent = await sendMetaCloudMediaMessage({ channel, to: phone, kind, providerMediaId: mediaId, caption: row.body ?? undefined, filename: row.mediaFilename ?? undefined });
  await getDatabase().insert(schema.whatsappMessages).values({
    id: randomUUID(), tenantId: deal.tenantId, leadId: deal.leadId, communicationChannelId: channel.id, provider: "meta_cloud", providerStatus: "sent",
    messageId: sent.messageId, phone, direction: "outgoing", body: row.body || `[${kind}]`, sentAt: new Date(),
    mediaKind: kind, mediaMimeType: mime, mediaFilename: row.mediaFilename, mediaSizeBytes: body.byteLength, mediaStorageKey: row.mediaKey, mediaProviderId: mediaId,
  });
  return sent.messageId;
}

/**
 * Despacha o outbox aprovado (§9): horário de envio, limites por hora e dia, janela de 24 h da Meta
 * conferida por canal na hora do envio, número WAHA conectado. O que não pode sair fica `held` com o motivo.
 */
export async function dispatchAutoSaleOutbox(now = new Date(), limit = 20, onlyDealId?: string) {
  const db = getDatabase();
  const candidates = await db.select({ row: schema.autoSaleOutbox, deal: schema.autoSaleDeals, phone: schema.leads.telefone })
    .from(schema.autoSaleOutbox)
    .innerJoin(schema.autoSaleDeals, eq(schema.autoSaleDeals.id, schema.autoSaleOutbox.dealId))
    .innerJoin(schema.leads, eq(schema.leads.id, schema.autoSaleDeals.leadId))
    .where(and(eq(schema.autoSaleOutbox.status, "approved"), or(isNull(schema.autoSaleOutbox.scheduledAt), lte(schema.autoSaleOutbox.scheduledAt, now)), inArray(schema.autoSaleDeals.status, [...OPEN_DEAL_STATUSES]), onlyDealId ? eq(schema.autoSaleDeals.id, onlyDealId) : undefined))
    .orderBy(asc(schema.autoSaleOutbox.createdAt)).limit(limit);
  const result = { sent: 0, held: 0, failed: 0, deferred: 0 };
  const flagCache = new Map<string, Awaited<ReturnType<typeof readAutoSaleFlags>>>();
  for (const { row, deal, phone } of candidates) {
    const flags = flagCache.get(deal.tenantId) ?? await readAutoSaleFlags(deal.tenantId);
    flagCache.set(deal.tenantId, flags);
    if (!flags.enabled || !flags.global) continue;
    const claimed = await db.update(schema.autoSaleOutbox).set({ status: "sending", attempts: row.attempts + 1, updatedAt: now })
      .where(and(eq(schema.autoSaleOutbox.id, row.id), eq(schema.autoSaleOutbox.status, "approved"))).returning({ id: schema.autoSaleOutbox.id });
    if (!claimed.length) continue;
    try {
      if (!canSpeakNow(now, flags.settings, deal.lastCustomerMessageAt)) {
        await db.update(schema.autoSaleOutbox).set({ status: "approved", scheduledAt: nextSendWindowStart(now, flags.settings), updatedAt: now }).where(eq(schema.autoSaleOutbox.id, row.id));
        result.deferred += 1;
        continue;
      }
      if (!withinRateLimits(await sentTimes(deal.id), now, 1, flags.settings)) { await hold(row, HOLD_REASONS.rate); result.held += 1; continue; }
      const metaWindow = await brokerMetaWindowOpen(deal.tenantId, phone);
      let providerId: string | null = null;
      if (row.kind === "text") {
        if (deal.channel === "waha") {
          const outboundId = await enqueueWahaText(row, deal, phone);
          if (!outboundId) { await hold(row, HOLD_REASONS.channel); await callManager(deal, "channel_unavailable"); result.held += 1; continue; }
          providerId = await deliverTextNow(row, deal, phone, outboundId);
        } else {
          if (!metaWindow) { await hold(row, HOLD_REASONS.window); result.held += 1; continue; }
          const queued = await enqueueMetaTextMessage({ tenantId: deal.tenantId, recipientType: "lead", recipientId: deal.leadId, destinationPhone: phone, body: row.body ?? "", idempotencyKey: row.idempotencyKey, purpose: "autoSale", requestedBy: row.approvedBy ?? deal.chosenBy });
          providerId = await deliverTextNow(row, deal, phone, queued.id);
        }
      } else {
        if (!metaWindow) { await hold(row, deal.channel === "waha" ? HOLD_REASONS.wahaMedia : HOLD_REASONS.window); result.held += 1; continue; }
        providerId = await sendMedia(row, deal, phone);
        if (!providerId) { await hold(row, HOLD_REASONS.channel); result.held += 1; continue; }
      }
      await db.update(schema.autoSaleOutbox).set({ status: "sent", sentAt: now, providerMessageId: providerId, error: null, updatedAt: now }).where(eq(schema.autoSaleOutbox.id, row.id));
      await db.update(schema.autoSaleDeals).set({ lastAgentMessageAt: now, updatedAt: now }).where(eq(schema.autoSaleDeals.id, deal.id));
      result.sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 300) : "unknown";
      const blocked = /131049/.test(detail) || (error as { metaCode?: number }).metaCode === 131049;
      const final = blocked || row.attempts + 1 >= 3;
      await db.update(schema.autoSaleOutbox).set({ status: final ? "failed" : "approved", error: detail, scheduledAt: new Date(now.getTime() + 60_000), updatedAt: now }).where(eq(schema.autoSaleOutbox.id, row.id));
      if (final) await callManager(deal, "channel_unavailable");
      result.failed += 1;
    }
  }
  return result;
}

/** PDFs já enviados (ou a caminho) nesta negociação. */
export async function pdfCount(dealId: string) {
  const [row] = await getDatabase().select({ total: count() }).from(schema.autoSaleOutbox)
    .where(and(eq(schema.autoSaleOutbox.dealId, dealId), eq(schema.autoSaleOutbox.kind, "document"), inArray(schema.autoSaleOutbox.status, ["approved", "sending", "sent", "draft"])));
  return Number(row?.total ?? 0);
}
