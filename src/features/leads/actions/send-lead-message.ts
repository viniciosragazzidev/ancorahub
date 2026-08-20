"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type SendLeadMessageResult = { success: boolean; error?: string; message?: { id: string; body: string; direction: string; sentAt: Date } };

/**
 * Send a text message from the broker to a lead via the best available provider.
 *
 * Provider priority:
 * 1. Meta Cloud (official channel) — if tenant has an active channel
 * 2. WAHA (broker connection) — if broker has a connected session
 *
 * All messages are persisted in `whatsapp_messages` with dedup by (tenantId, messageId).
 * The browser never contacts WAHA directly.
 */
export async function sendLeadMessageAction(leadId: string, body: string, clientMessageId?: string): Promise<SendLeadMessageResult> {
  const text = body.trim();
  if (!text) return { success: false, error: "Digite uma mensagem antes de enviar." };
  if (text.length > 4000) return { success: false, error: "A mensagem deve ter no máximo 4.000 caracteres." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db.select({ id: schema.leads.id, telefone: schema.leads.telefone, status: schema.leads.status, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { success: false, error: "Lead não encontrado." };
    const isManagement = context.role === "director" || context.role === "manager";
    if (lead.status === "distributed" && context.role === "broker") return { success: false, error: "Inicie o atendimento antes de enviar mensagens." };
    if (lead.corretorId && lead.corretorId !== context.userId && !isManagement) return { success: false, error: "Este atendimento está sob responsabilidade de outro corretor. Para responder, assuma o atendimento primeiro." };

    // ── Opt-out guard ──────────────────────────────────────────────────────
    const phoneHash = createPhoneHash(lead.telefone);
    const [suppression] = await db.select({ id: schema.wahaSuppressions.id })
      .from(schema.wahaSuppressions)
      .where(eq(schema.wahaSuppressions.phoneHash, phoneHash))
      .limit(1);
    if (suppression) return { success: false, error: "Este contato não pode receber novas mensagens." };

    // ── 1. Try Meta Cloud channel ──────────────────────────────────────────
    const officialChannel = await getPreferredMetaCloudChannel({ tenantId: context.tenantId, branchId: lead.branchId, userId: context.userId });
    if (officialChannel) {
      const sent = await sendMetaCloudChannelText({ channel: officialChannel, to: lead.telefone, body: text });
      const sentAt = new Date();
      const id = randomUUID();
      await db.insert(schema.whatsappMessages).values({ id, tenantId: context.tenantId, leadId: lead.id, communicationChannelId: officialChannel.id, provider: "meta_cloud", providerStatus: "sent", messageId: sent.messageId, phone: lead.telefone, direction: "outgoing", body: text, sentAt });
      return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
    }

    // ── 2. Try WAHA broker connection ──────────────────────────────────────
    const [connection] = await db.select({
      id: schema.whatsappConnections.id,
      sessionName: schema.whatsappConnections.sessionName,
      status: schema.whatsappConnections.status,
      active: schema.whatsappConnections.chatInternoAtivo,
    })
      .from(schema.whatsappConnections)
      .where(and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ))
      .limit(1);

    if (!connection?.sessionName || connection.status !== "ready") {
      return { success: false, error: "Conecte o WhatsApp e aguarde o status Conectado." };
    }
    if (!connection.active) {
      return { success: false, error: "O chat interno está desativado nas integrações." };
    }

    // Resolve the VPS API URL
    const vpsApiUrl = process.env.VPS_API_URL?.trim().replace(/\/$/, "");
    const vpsInternalToken = process.env.WHATSAPP_API_INTERNAL_TOKEN?.trim();
    if (!vpsApiUrl || !vpsInternalToken) {
      return { success: false, error: "Serviço de envio não configurado." };
    }

    // Call Fastify to send via WAHA
    const idempotencyKey = clientMessageId ?? `outbound:${context.tenantId}:${leadId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
    const phoneDigits = lead.telefone.replace(/\D/g, "");

    const response = await fetch(`${vpsApiUrl}/internal/waha/messages/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-corretop-internal-token": vpsInternalToken,
      },
      body: JSON.stringify({
        sessionName: connection.sessionName,
        chatId: phoneDigits,
        text,
        idempotencyKey,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const result = await response.json().catch(() => null) as { ok?: boolean; messageId?: string; error?: string } | null;

    if (!response.ok || !result?.ok || !result?.messageId) {
      const errorCode = result?.error ?? `HTTP_${response.status}`;
      // Map error codes to user-friendly messages
      if (errorCode.includes("SESSION_")) {
        return { success: false, error: "Sessão WhatsApp não está conectada. Reconecte para enviar." };
      }
      return { success: false, error: "Não foi possível enviar a mensagem. Tente novamente." };
    }

    // ── 3. Persist message ─────────────────────────────────────────────────
    const sentAt = new Date();
    const id = randomUUID();
    await db.insert(schema.whatsappMessages).values({
      id,
      tenantId: context.tenantId,
      leadId: lead.id,
      provider: "waha",
      providerStatus: "sent",
      messageId: result.messageId,
      phone: lead.telefone,
      direction: "outgoing",
      body: text,
      sentAt,
    }).onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] });

    return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível enviar a mensagem." };
  }
}

export async function getLeadMessagesAction(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, corretorId: schema.leads.corretorId }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { success: false as const, error: "Lead não encontrado." };
  if (context.role === "broker" && lead.corretorId !== context.userId) return { success: false as const, error: "Acesso negado." };
  const messages = await db.select({ id: schema.whatsappMessages.id, body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, sentAt: schema.whatsappMessages.sentAt, provider: schema.whatsappMessages.provider, providerStatus: schema.whatsappMessages.providerStatus }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, leadId))).orderBy(schema.whatsappMessages.sentAt);
  console.info("[Chat] mensagens carregadas", JSON.stringify({ leadId, tenantId: context.tenantId, total: messages.length, lastMessageId: messages.at(-1)?.id ?? null }));
  return { success: true as const, messages };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function createPhoneHash(phone: string): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const normalized = phone.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
