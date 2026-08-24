"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  getPreferredMetaCloudChannel,
  sendMetaCloudChannelText,
} from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { startServiceOnFirstMessage } from "@/features/leads/start-service-on-message";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { publishConversationInvalidation } from "@/features/notifications/realtime-sync";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type SendLeadMessageResult = {
  success: boolean;
  error?: string;
  message?: { id: string; body: string; direction: string; sentAt: Date };
};

/** Send from the authenticated broker's WAHA session to a tenant-owned WAHA number. */
export async function sendTenantOfficialNumberMessageAction(
  numberId: string,
  body: string,
): Promise<SendLeadMessageResult> {
  const text = body.trim();
  if (!text || text.length > 4_000)
    return { success: false, error: "A mensagem deve ter entre 1 e 4.000 caracteres." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker")
      return { success: false, error: "Apenas o corretor pode usar esta conversa." };
    const db = getDatabase();
    const [number] = await db
      .select({ id: schema.wahaNumbers.id, phone: schema.wahaNumbers.displayPhoneNumber })
      .from(schema.wahaNumbers)
      .where(
        and(eq(schema.wahaNumbers.id, numberId), eq(schema.wahaNumbers.tenantId, context.tenantId)),
      )
      .limit(1);
    if (!number) return { success: false, error: "Número oficial não encontrado neste tenant." };
    const [connection] = await db
      .select({
        sessionName: schema.whatsappConnections.sessionName,
        status: schema.whatsappConnections.status,
        active: schema.whatsappConnections.chatInternoAtivo,
      })
      .from(schema.whatsappConnections)
      .where(
        and(
          eq(schema.whatsappConnections.tenantId, context.tenantId),
          eq(schema.whatsappConnections.userId, context.userId),
        ),
      )
      .limit(1);
    if (!connection?.sessionName || connection.status !== "ready" || !connection.active)
      return { success: false, error: "Conecte e ative seu WhatsApp antes de responder." };
    const base = process.env.VPS_API_URL?.trim().replace(/\/$/, "");
    const token = process.env.WHATSAPP_API_INTERNAL_TOKEN?.trim();
    const phone = number.phone.replace(/\D/g, "");
    if (!base || !token || !/^\d{10,15}$/.test(phone))
      return { success: false, error: "Serviço de envio não configurado." };
    const response = await fetch(`${base}/internal/waha/messages/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-corretop-internal-token": token },
      body: JSON.stringify({
        sessionName: connection.sessionName,
        chatId: phone,
        text,
        idempotencyKey: `tenant-number:${context.tenantId}:${numberId}:${randomUUID()}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      messageId?: string;
    } | null;
    if (!response.ok || !result?.ok || !result.messageId)
      return { success: false, error: "Não foi possível enviar a mensagem." };
    const sentAt = new Date();
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.whatsappMessages)
        .values({
          id,
          tenantId: context.tenantId,
          provider: "waha",
          providerStatus: "sent",
          messageId: result.messageId!,
          phone,
          direction: "outgoing",
          body: text,
          sentAt,
        })
        .onConflictDoNothing({
          target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId],
        });
      await tx
        .insert(schema.auditLogs)
        .values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "waha_number",
          entidadeId: number.id,
          acao: "waha_tenant_number.message_sent",
          createdAt: sentAt,
        });
    });
    return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
  } catch {
    return { success: false, error: "Não foi possível enviar a mensagem." };
  }
}

/** Send from the authenticated broker's WhatsApp session to the tenant's active official channel. */
export async function sendTenantOfficialChannelMessageAction(
  channelId: string,
  body: string,
): Promise<SendLeadMessageResult> {
  const text = body.trim();
  if (!text || text.length > 4_000)
    return { success: false, error: "A mensagem deve ter entre 1 e 4.000 caracteres." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker")
      return { success: false, error: "Apenas o corretor pode usar esta conversa." };
    const db = getDatabase();
    const [channel] = await db
      .select({
        id: schema.communicationChannels.id,
        phone: schema.communicationChannels.displayPhoneNumber,
      })
      .from(schema.communicationChannels)
      .where(
        and(
          eq(schema.communicationChannels.id, channelId),
          eq(schema.communicationChannels.tenantId, context.tenantId),
          eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
          eq(schema.communicationChannels.status, "active"),
        ),
      )
      .limit(1);
    if (!channel?.phone)
      return { success: false, error: "Número oficial não encontrado neste tenant." };
    const [connection] = await db
      .select({
        sessionName: schema.whatsappConnections.sessionName,
        status: schema.whatsappConnections.status,
        active: schema.whatsappConnections.chatInternoAtivo,
      })
      .from(schema.whatsappConnections)
      .where(
        and(
          eq(schema.whatsappConnections.tenantId, context.tenantId),
          eq(schema.whatsappConnections.userId, context.userId),
        ),
      )
      .limit(1);
    if (!connection?.sessionName || connection.status !== "ready" || !connection.active)
      return { success: false, error: "Conecte e ative seu WhatsApp antes de responder." };
    const base = process.env.VPS_API_URL?.trim().replace(/\/$/, "");
    const token = process.env.WHATSAPP_API_INTERNAL_TOKEN?.trim();
    const phone = channel.phone.replace(/\D/g, "");
    if (!base || !token || !/^\d{10,15}$/.test(phone))
      return { success: false, error: "Serviço de envio não configurado." };
    const response = await fetch(`${base}/internal/waha/messages/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-corretop-internal-token": token },
      body: JSON.stringify({
        sessionName: connection.sessionName,
        chatId: phone,
        text,
        idempotencyKey: `tenant-channel:${context.tenantId}:${channelId}:${randomUUID()}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      messageId?: string;
    } | null;
    if (!response.ok || !result?.ok || !result.messageId)
      return { success: false, error: "Não foi possível enviar a mensagem." };
    const sentAt = new Date();
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.whatsappMessages)
        .values({
          id,
          tenantId: context.tenantId,
          communicationChannelId: channel.id,
          provider: "waha",
          providerStatus: "sent",
          messageId: result.messageId!,
          phone,
          direction: "outgoing",
          body: text,
          sentAt,
        })
        .onConflictDoNothing({
          target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId],
        });
      await tx
        .insert(schema.auditLogs)
        .values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "communication_channel",
          entidadeId: channel.id,
          acao: "tenant_official_channel.message_sent",
          createdAt: sentAt,
        });
    });
    return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
  } catch {
    return { success: false, error: "Não foi possível enviar a mensagem." };
  }
}

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
export async function sendLeadMessageAction(
  leadId: string,
  body: string,
  clientMessageId?: string,
): Promise<SendLeadMessageResult> {
  const text = body.trim();
  if (!text) return { success: false, error: "Digite uma mensagem antes de enviar." };
  if (text.length > 4000)
    return { success: false, error: "A mensagem deve ter no máximo 4.000 caracteres." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        corretorId: schema.leads.corretorId,
        branchId: schema.leads.branchId,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { success: false, error: "Lead não encontrado." };
    const isManagement = context.role === "director" || context.role === "manager";
    if (lead.status === "distributed" && context.role === "broker" && lead.corretorId === context.userId) {
      // DEC-027: a primeira mensagem do corretor dono também é forma válida de
      // iniciar o atendimento. A transição é condicional (status/corretorId) e
      // idempotente; falhas aqui não impedem o envio da mensagem.
      const started = await startServiceOnFirstMessage({
        tenantId: context.tenantId,
        leadId: lead.id,
        brokerId: context.userId,
        branchId: lead.branchId,
      });
      if (started) {
        lead.status = "in_contact";
        void notifyServiceStarted(context, lead).catch(() => { /* non-blocking */ });
      }
    }
    if (lead.corretorId && lead.corretorId !== context.userId && !isManagement)
      return {
        success: false,
        error:
          "Este atendimento está sob responsabilidade de outro corretor. Para responder, assuma o atendimento primeiro.",
      };

    // ── Opt-out guard ──────────────────────────────────────────────────────
    const phoneHash = createPhoneHash(lead.telefone);
    const [suppression] = await db
      .select({ id: schema.wahaSuppressions.id })
      .from(schema.wahaSuppressions)
      .where(eq(schema.wahaSuppressions.phoneHash, phoneHash))
      .limit(1);
    if (suppression)
      return { success: false, error: "Este contato não pode receber novas mensagens." };

    // Corretores no modo Lite atendem pelo próprio WhatsApp conectado. O canal
    // oficial continua sendo exclusivo das conversas do tenant e da gestão.
    const brokerUsesLite =
      context.role === "broker" && (await getExperienceMode(context)) === "LIGHT";

    // ── 1. Try Meta Cloud channel for the tenant workspace ────────────────
    const officialChannel = brokerUsesLite
      ? null
      : await getPreferredMetaCloudChannel({
          tenantId: context.tenantId,
          branchId: lead.branchId,
          userId: context.userId,
        });
    if (officialChannel) {
      const sent = await sendMetaCloudChannelText({
        channel: officialChannel,
        to: lead.telefone,
        body: text,
      });
      const sentAt = new Date();
      const id = randomUUID();
      await db
        .insert(schema.whatsappMessages)
        .values({
          id,
          tenantId: context.tenantId,
          leadId: lead.id,
          communicationChannelId: officialChannel.id,
          provider: "meta_cloud",
          providerStatus: "sent",
          messageId: sent.messageId,
          phone: lead.telefone,
          direction: "outgoing",
          body: text,
          sentAt,
        });
      synchronizeConversationWorkspace(context.tenantId, [context.userId]);
      return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
    }

    // ── 2. Try WAHA broker connection ──────────────────────────────────────
    const [connection] = await db
      .select({
        id: schema.whatsappConnections.id,
        sessionName: schema.whatsappConnections.sessionName,
        status: schema.whatsappConnections.status,
        active: schema.whatsappConnections.chatInternoAtivo,
      })
      .from(schema.whatsappConnections)
      .where(
        and(
          eq(schema.whatsappConnections.tenantId, context.tenantId),
          eq(schema.whatsappConnections.userId, context.userId),
        ),
      )
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
    const idempotencyKey =
      clientMessageId ??
      `outbound:${context.tenantId}:${leadId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
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

    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      messageId?: string;
      error?: string;
    } | null;

    if (!response.ok || !result?.ok || !result?.messageId) {
      const errorCode = result?.error ?? `HTTP_${response.status}`;
      // Map error codes to user-friendly messages
      if (errorCode.includes("SESSION_")) {
        return {
          success: false,
          error: "Sessão WhatsApp não está conectada. Reconecte para enviar.",
        };
      }
      return { success: false, error: "Não foi possível enviar a mensagem. Tente novamente." };
    }

    // ── 3. Persist message ─────────────────────────────────────────────────
    const sentAt = new Date();
    const id = randomUUID();
    await db
      .insert(schema.whatsappMessages)
      .values({
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
      })
      .onConflictDoNothing({
        target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId],
      });

    synchronizeConversationWorkspace(context.tenantId, [context.userId]);
    return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
    };
  }
}

function synchronizeConversationWorkspace(tenantId: string, participantUserIds: string[]) {
  revalidatePath("/conversas");
  revalidatePath("/conversas/broker");
  void publishConversationInvalidation({ tenantId, participantUserIds }).catch(() => undefined);
}

export async function getLeadMessagesAction(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db
    .select({ id: schema.leads.id, corretorId: schema.leads.corretorId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);
  if (!lead) return { success: false as const, error: "Lead não encontrado." };
  if (context.role === "broker" && lead.corretorId !== context.userId)
    return { success: false as const, error: "Acesso negado." };
  const messages = await db
    .select({
      id: schema.whatsappMessages.id,
      body: schema.whatsappMessages.body,
      direction: schema.whatsappMessages.direction,
      sentAt: schema.whatsappMessages.sentAt,
      provider: schema.whatsappMessages.provider,
      providerStatus: schema.whatsappMessages.providerStatus,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, context.tenantId),
        eq(schema.whatsappMessages.leadId, leadId),
      ),
    )
    .orderBy(schema.whatsappMessages.sentAt);
  console.info(
    "[Chat] mensagens carregadas",
    JSON.stringify({
      leadId,
      tenantId: context.tenantId,
      total: messages.length,
      lastMessageId: messages.at(-1)?.id ?? null,
    }),
  );
  return { success: true as const, messages };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function notifyServiceStarted(
  context: { tenantId: string; userId: string },
  lead: { id: string; nome: string },
) {
  await publishNotification({
    capability: "lead_service_started",
    tenantId: context.tenantId,
    recipientUserId: context.userId,
    leadId: lead.id,
    type: "lead_service_started",
    title: "Atendimento ativo",
    message: `Você iniciou o atendimento de ${lead.nome} ao enviar a primeira mensagem.`,
    pushTitle: "Atendimento Ativo! ✅",
    pushBody: `Você iniciou o atendimento de ${lead.nome}.`,
    url: `/leads/${lead.id}`,
    tag: `lead-${lead.id}`,
  }).catch(() => { /* non-blocking */ });
}

function createPhoneHash(phone: string): string {
  const normalized = phone.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
