import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { WAHA_CONNECTIONS_FEATURE } from "./connection-service";
import { ingestWahaWebhook } from "./inbound";
import { normalizeWahaWebhookPayload, wahaWebhookSchema } from "./contract";
import { getWahaChats, getWahaMessageHistory } from "./relay-client";
import { phoneSubscriberSuffix } from "./phone-matching";

const MAX_CONNECTIONS_PER_RUN = 20;
const MAX_LEADS_PER_CONNECTION = 50;

function providerMessageId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const id = value as Record<string, unknown>;
  const serialized = id._serialized ?? id.id;
  return typeof serialized === "string" && serialized.trim() ? serialized.trim() : null;
}

function providerChatId(value: unknown): string | null {
  if (typeof value === "string" && value.includes("@")) return value;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = row.id ?? row.chatId;
  if (typeof id === "string" && id.includes("@")) return id;
  if (id && typeof id === "object") {
    const serialized = (id as Record<string, unknown>)._serialized;
    if (typeof serialized === "string" && serialized.includes("@")) return serialized;
  }
  return null;
}

/**
 * Recupera uma janela curta do histórico de cada sessão de corretor e passa
 * tudo pelo mesmo ingestWahaWebhook usado pelo webhook ao vivo. Isso cobre
 * eventos móveis que o WAHA não entregou sem criar um segundo caminho de
 * persistência ou de autorização.
 */
export async function syncBrokerWahaMessages(input: { limit?: number } = {}) {
  if ((await getSystemSetting(WAHA_CONNECTIONS_FEATURE)) === "false") {
    console.info("[waha/sync] skipped", { reason: "feature_disabled" });
    return { sessions: 0, events: 0, processed: 0, ignored: 0, skipped: "feature_disabled" as const };
  }

  const db = getDatabase();
  const connections = await db
    .select({ tenantId: schema.whatsappConnections.tenantId, userId: schema.whatsappConnections.userId, sessionName: schema.whatsappConnections.sessionName })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.status, "ready"), isNotNull(schema.whatsappConnections.userId), isNotNull(schema.whatsappConnections.sessionName)))
    .limit(MAX_CONNECTIONS_PER_RUN);

  let sessions = 0;
  let events = 0;
  let processed = 0;
  let ignored = 0;

  for (const connection of connections) {
    if (!connection.tenantId || !connection.userId || !connection.sessionName) continue;
    const leads = await db
      .select({ id: schema.leads.id, phone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, connection.tenantId), eq(schema.leads.corretorId, connection.userId), isNull(schema.leads.deletedAt)))
      .limit(MAX_LEADS_PER_CONNECTION);
    const leadSuffixes = new Set(leads.map((lead) => phoneSubscriberSuffix(lead.phone)).filter(Boolean));
    let chatIds = [...new Set(leads.map((lead) => lead.phone.replace(/\D/g, "")).filter((phone) => /^\d{10,15}$/.test(phone)).map((phone) => `${phone}@c.us`))];
    // O cadastro pode ter DDD antigo. Quando possível, liste os chats do
    // WAHA e selecione pelo número móvel (últimos 9 dígitos), preservando o
    // fallback pelo telefone cadastrado para instalações sem esse endpoint.
    try {
      const providerChats = await getWahaChats({ sessionName: connection.sessionName, limit: 500 });
      const resolvedChatIds = providerChats.map(providerChatId).filter((chatId): chatId is string => {
        const digits = chatId.split("@")[0].replace(/\D/g, "");
        return leadSuffixes.has(phoneSubscriberSuffix(digits));
      });
      if (resolvedChatIds.length) chatIds = [...new Set(resolvedChatIds)];
    } catch (error) {
      console.warn("[waha/sync] chats_list_failed", { session: connection.sessionName, errorCode: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
    }
    if (!chatIds.length) continue;

    sessions += 1;
    let chats: Array<{ chatId: string; messages: unknown[] }>;
    try {
      chats = await getWahaMessageHistory({ sessionName: connection.sessionName, chatIds, limit: input.limit ?? 100 });
    } catch (error) {
      console.warn("[waha/sync] history_failed", { session: connection.sessionName, errorCode: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
      continue;
    }

    for (const chat of chats) {
      for (const message of chat.messages) {
        const raw = message && typeof message === "object" ? message as Record<string, unknown> : null;
        const id = providerMessageId(raw?.id);
        if (!id) continue;
        const payload = { event: "message.any", session: connection.sessionName, id: `sync:${connection.sessionName}:${id}`, payload: message };
        try {
          const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload(payload));
          const result = await ingestWahaWebhook(event, JSON.stringify(payload));
          events += 1;
          if (result.processed) processed += result.processed;
          if (result.ignored) ignored += 1;
        } catch (error) {
          console.warn("[waha/sync] message_rejected", { session: connection.sessionName, reason: error instanceof Error ? error.message.slice(0, 80) : "invalid_payload" });
        }
      }
    }
  }

  console.info("[waha/sync] completed", { sessions, events, processed, ignored });
  return { sessions, events, processed, ignored };
}
