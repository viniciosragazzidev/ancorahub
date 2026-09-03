import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import {
  getWhatsAppTestFailureMessage,
  normalizeWhatsAppDestination,
} from "./whatsapp-diagnostic-copy";

export type WhatsAppConnectionDiagnostic = {
  channelConnected: boolean;
  officialNumber: string | null;
  displayName: string | null;
  tenantId: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  webhookStatus: "active" | "degraded" | "unavailable" | "unconfigured";
  tokenStatus: "valid" | "expiring_soon" | "invalid" | "unconfigured";
  tokenExpirationDays: number | null;
  lastMessageReceivedAt: Date | null;
  lastMessageSentAt: Date | null;
  lastError: string | null;
  averageLatencyMs: number;
  configVersion: number;
  overallHealth:
    | "connected"
    | "unstable"
    | "invalid_token"
    | "webhook_unavailable"
    | "incomplete_config"
    | "disabled";
};

export const sendWhatsAppTestMessageSchema = z.object({
  destinationNumber: z.string().trim().min(8).max(20),
  messageType: z.enum(["free_text", "approved_template", "internal_test"]),
  messageText: z.string().trim().min(1).max(2000),
  templateId: z.string().optional(),
});

export type SendWhatsAppTestMessageInput = z.infer<typeof sendWhatsAppTestMessageSchema>;

export type SendWhatsAppTestMessageResult = {
  acceptedByMeta: boolean;
  messageId: string;
  timestamp: Date;
  initialStatus: "sent" | "delivered" | "read" | "failed";
  delivered: boolean;
  read: boolean;
  errorReason: string | null;
  estimatedCostBrl: number;
  messageCategory: string;
  templateUsed: string | null;
  tenantId: string;
  maskedDestination: string;
};

import { maskPhone } from "@/shared/utils/phone";
/** Mask phone numbers for non-privileged log views */
export const maskPhoneNumber = maskPhone;

export async function getWhatsAppDiagnosticStatus(
  tenantId: string,
): Promise<WhatsAppConnectionDiagnostic> {
  const db = getDatabase();

  // 1. Busca canal oficial Meta Cloud API
  const [metaChannel] = await db
    .select()
    .from(schema.communicationChannels)
    .where(
      and(
        eq(schema.communicationChannels.tenantId, tenantId),
        inArray(schema.communicationChannels.provider, [
          "meta_cloud_whatsapp",
          "meta_cloud_api",
          "meta_cloud",
        ]),
      ),
    )
    .orderBy(
      desc(schema.communicationChannels.isDefault),
      desc(schema.communicationChannels.createdAt),
    )
    .limit(1);

  // 2. Busca conexão WhatsApp WAHA/OpenWA
  const [wahaConn] = await db
    .select()
    .from(schema.whatsappConnections)
    .where(eq(schema.whatsappConnections.tenantId, tenantId))
    .orderBy(desc(schema.whatsappConnections.updatedAt))
    .limit(1);

  // 3. Busca últimas mensagens recebidas e enviadas
  const [lastInbound] = await db
    .select()
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, tenantId),
        eq(schema.whatsappMessages.direction, "inbound"),
      ),
    )
    .orderBy(desc(schema.whatsappMessages.createdAt))
    .limit(1);

  const [lastOutbound] = await db
    .select()
    .from(schema.whatsappOutboundMessages)
    .where(eq(schema.whatsappOutboundMessages.tenantId, tenantId))
    .orderBy(desc(schema.whatsappOutboundMessages.createdAt))
    .limit(1);

  const isMetaConnected = Boolean(
    metaChannel &&
    (metaChannel.status === "active" || metaChannel.status === "connected") &&
    metaChannel.phoneNumberId,
  );
  const isWahaConnected = Boolean(
    wahaConn &&
    (wahaConn.status === "ready" ||
      wahaConn.status === "active" ||
      wahaConn.status === "connected"),
  );

  const channelConnected = isMetaConnected || isWahaConnected;

  let officialNumber: string | null = null;
  let displayName: string | null = null;
  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;
  let tokenStatus: WhatsAppConnectionDiagnostic["tokenStatus"] = "unconfigured";
  let tokenExpirationDays: number | null = null;

  if (metaChannel) {
    officialNumber = metaChannel.displayPhoneNumber || metaChannel.phoneNumberId || null;
    displayName = metaChannel.verifiedName || "WhatsApp Oficial (Meta Cloud)";
    wabaId = metaChannel.wabaId ?? null;
    phoneNumberId = metaChannel.phoneNumberId ?? null;
    tokenStatus = metaChannel.status === "active" ? "valid" : "invalid";
    if (metaChannel.tokenExpiresAt) {
      const diffMs = metaChannel.tokenExpiresAt.getTime() - Date.now();
      tokenExpirationDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else {
      tokenExpirationDays = 60;
    }
  } else if (wahaConn) {
    officialNumber =
      wahaConn.sessionName || (wahaConn.sessionId ? `Sessão ${wahaConn.sessionId}` : null);
    displayName = wahaConn.sessionName ? `WhatsApp (${wahaConn.sessionName})` : "Sessão WhatsApp";
    wabaId = wahaConn.sessionId ? `WAHA_${wahaConn.sessionId.slice(-6)}` : null;
    phoneNumberId = wahaConn.sessionId ?? null;
    tokenStatus = isWahaConnected ? "valid" : "unconfigured";
    tokenExpirationDays = null;
  }

  const webhookStatus: WhatsAppConnectionDiagnostic["webhookStatus"] = channelConnected
    ? "active"
    : "unconfigured";

  let overallHealth: WhatsAppConnectionDiagnostic["overallHealth"] = "disabled";
  if (!metaChannel && !wahaConn) {
    overallHealth = "incomplete_config";
  } else if (!channelConnected) {
    overallHealth = "unstable";
  } else {
    overallHealth = "connected";
  }

  // Calcula a latência média real dos logs de IA
  const [latencyRow] = await db
    .select({
      avgLatency: sql<number>`coalesce(avg(${schema.aiAttendanceLogs.latencyMs}), 240)::int`,
    })
    .from(schema.aiAttendanceLogs)
    .where(eq(schema.aiAttendanceLogs.tenantId, tenantId));

  return {
    channelConnected,
    officialNumber,
    displayName,
    tenantId,
    wabaId,
    phoneNumberId,
    webhookStatus,
    tokenStatus,
    tokenExpirationDays,
    lastMessageReceivedAt: lastInbound?.createdAt ?? null,
    lastMessageSentAt: lastOutbound?.createdAt ?? null,
    lastError: lastOutbound?.providerErrorMessage ?? null,
    averageLatencyMs: latencyRow?.avgLatency ?? 240,
    configVersion: 1,
    overallHealth,
  };
}

import {
  getPreferredMetaCloudChannel,
  sendMetaCloudChannelText,
} from "@/features/communication-channels/service";
import { sendMetaCloudTemplateTest } from "@/features/communication-channels/meta-graph-templates-client";
import { decryptChannelSecret, resolveTokenEncryptionKey } from "@/features/communication-channels/secret-crypto";
import { getOpenWaSessionStatus, sendOpenWaText } from "@/lib/integrations/openwa";

export async function sendWhatsAppTestMessage(
  tenantId: string,
  actorUserId: string,
  input: SendWhatsAppTestMessageInput,
): Promise<SendWhatsAppTestMessageResult> {
  const data = sendWhatsAppTestMessageSchema.parse(input);
  const db = getDatabase();

  const normalizedNumber = normalizeWhatsAppDestination(data.destinationNumber);
  if (normalizedNumber.length < 12) {
    throw new Error(
      "Número de destino inválido. Informe o código de país e DDD (ex: 5571999999999).",
    );
  }

  const maskedDestination = maskPhoneNumber(normalizedNumber);
  const now = new Date();

  let messageId = `wamid.test_${randomUUID().slice(0, 12)}`;
  let acceptedByMeta = false;
  let initialStatus: "sent" | "delivered" | "read" | "failed" = "failed";
  let delivered = false;
  let errorReason: string | null = null;
  let templateUsed: string | null = null;

  // 1. Tenta envio pelo canal oficial Meta Cloud API
  try {
    const officialChannel = await getPreferredMetaCloudChannel({ tenantId, userId: actorUserId });
    if (officialChannel && officialChannel.phoneNumberId && officialChannel.accessTokenCiphertext) {
      const accessToken = decryptChannelSecret(officialChannel.accessTokenCiphertext, resolveTokenEncryptionKey());

      if (data.messageType === "approved_template") {
        const [firstTemplate] = await db
          .select({ name: schema.metaWhatsAppTemplates.name, language: schema.metaWhatsAppTemplates.language })
          .from(schema.metaWhatsAppTemplates)
          .where(and(eq(schema.metaWhatsAppTemplates.tenantId, tenantId), eq(schema.metaWhatsAppTemplates.status, "APPROVED")))
          .limit(1);

        const templateName = data.templateId || firstTemplate?.name || "hello_world";
        const language = firstTemplate?.language || "pt_BR";
        templateUsed = templateName;

        const sent = await sendMetaCloudTemplateTest(
          officialChannel.phoneNumberId,
          accessToken,
          normalizedNumber,
          templateName,
          language,
        );
        messageId = sent.messages?.[0]?.id || messageId;
        acceptedByMeta = true;
        initialStatus = "sent";
        delivered = true;
      } else {
        try {
          const sent = await sendMetaCloudChannelText({
            channel: officialChannel,
            to: normalizedNumber,
            body: data.messageText,
          });
          messageId = sent.messageId || messageId;
          acceptedByMeta = true;
          initialStatus = "sent";
          delivered = true;
        } catch (textErr) {
          const providerCode =
            textErr && typeof textErr === "object" && "code" in textErr && typeof textErr.code === "number"
              ? textErr.code
              : undefined;

          // Se a Meta recusar texto livre por estar fora da janela de 24h (código 131047), tenta enviar o template oficial
          if (providerCode === 131047 || (textErr instanceof Error && textErr.message.includes("24 hour"))) {
            const [firstTemplate] = await db
              .select({ name: schema.metaWhatsAppTemplates.name, language: schema.metaWhatsAppTemplates.language })
              .from(schema.metaWhatsAppTemplates)
              .where(and(eq(schema.metaWhatsAppTemplates.tenantId, tenantId), eq(schema.metaWhatsAppTemplates.status, "APPROVED")))
              .limit(1);

            const templateName = data.templateId || firstTemplate?.name || "hello_world";
            const language = firstTemplate?.language || "pt_BR";
            templateUsed = templateName;

            const sent = await sendMetaCloudTemplateTest(
              officialChannel.phoneNumberId,
              accessToken,
              normalizedNumber,
              templateName,
              language,
            );
            messageId = sent.messages?.[0]?.id || messageId;
            acceptedByMeta = true;
            initialStatus = "sent";
            delivered = true;
          } else {
            throw textErr;
          }
        }
      }
    } else {
      // 2. Se não houver Meta Cloud API, tenta conexão WAHA/OpenWA
      const [connection] = await db
        .select({
          sessionId: schema.whatsappConnections.sessionId,
          status: schema.whatsappConnections.status,
          active: schema.whatsappConnections.chatInternoAtivo,
        })
        .from(schema.whatsappConnections)
        .where(eq(schema.whatsappConnections.tenantId, tenantId))
        .limit(1);

      if (
        connection?.sessionId &&
        (connection.status === "ready" || connection.status === "active")
      ) {
        const sent = await sendOpenWaText(connection.sessionId, normalizedNumber, data.messageText);
        messageId = sent.messageId || messageId;
        acceptedByMeta = true;
        initialStatus = "sent";
        delivered = true;
      } else {
        errorReason =
          "Nenhum canal ativo de WhatsApp (Meta Cloud API ou Sessão WhatsApp) foi encontrado ou está pronto para envio neste tenant. Configure a conexão no painel de WhatsApp.";
      }
    }
  } catch (err) {
    const providerCode =
      err && typeof err === "object" && "code" in err && typeof err.code === "number"
        ? err.code
        : undefined;
    console.warn("[whatsapp-diagnostic] test_message.rejected", { providerCode, message: err instanceof Error ? err.message : String(err) });
    errorReason = getWhatsAppTestFailureMessage(err);
  }

  // Registrar log de auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "whatsapp_test_message",
    entidadeId: messageId,
    acao: `whatsapp.test_sent:${maskedDestination}:${acceptedByMeta ? "success" : "failed"}`,
  });

  return {
    acceptedByMeta,
    messageId,
    timestamp: now,
    initialStatus,
    delivered,
    read: false,
    errorReason,
    estimatedCostBrl: data.messageType === "approved_template" ? 0.08 : 0.03,
    messageCategory: data.messageType === "approved_template" ? "UTILITY" : "SERVICE",
    templateUsed: data.templateId ?? null,
    tenantId,
    maskedDestination,
  };
}
