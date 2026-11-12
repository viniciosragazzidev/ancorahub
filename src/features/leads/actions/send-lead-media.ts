"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { scheduleLeadConversationAnalysis } from "@/features/conversation-intelligence/trigger";

import { and, eq } from "drizzle-orm";

import {
  CONVERSATION_MEDIA_KINDS,
  isConversationMediaEnabled,
  storeConversationMedia,
  uploadMetaMediaObject,
  validateOutboundMedia,
  type ConversationMediaKind,
} from "@/features/communication-channels/conversation-media";
import {
  getPreferredMetaCloudChannel,
} from "@/features/communication-channels/service";
import { sendMetaCloudMediaMessage } from "@/features/communication-channels/meta-media-send";
import { publishConversationInvalidation } from "@/features/notifications/realtime-sync";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type SendLeadMediaResult = {
  success: boolean;
  error?: string;
  message?: {
    id: string;
    body: string;
    direction: string;
    sentAt: Date;
    media: {
      kind: ConversationMediaKind;
      mimeType: string;
      filename: string | null;
      sizeBytes: number;
      url: string;
    };
  };
};


/**
 * Sends one media file from management to a lead through the tenant's official
 * Meta Cloud channel. The binary is validated at this boundary (MIME + size),
 * persisted in the private R2 bucket under the tenant prefix and referenced by
 * the conversation ledger. Brokers are denied by DEC-091: their personal
 * connection is read-only and they answer in the WhatsApp app.
 */
export async function sendLeadMediaAction(
  leadId: string,
  formData: FormData,
): Promise<SendLeadMediaResult> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "broker") {
      return {
        success: false,
        error:
          "A conexão do seu WhatsApp é somente para sincronização. Responda pelo WhatsApp no seu aparelho.",
      };
    }
    if (!(await isConversationMediaEnabled())) {
      return {
        success: false,
        error: "O envio de mídia está temporariamente desativado pela plataforma.",
      };
    }

    const kindInput = String(formData.get("kind") ?? "");
    const captionInput = String(formData.get("caption") ?? "").trim();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Selecione um arquivo antes de enviar." };
    }

    const validation = validateOutboundMedia({
      kind: kindInput,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!validation.ok) return { success: false, error: validation.error };
    if (captionInput.length > 1_000) {
      return { success: false, error: "A legenda deve ter no máximo 1.000 caracteres." };
    }

    const db = getDatabase();
    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        corretorId: schema.leads.corretorId,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { success: false, error: "Lead não encontrado." };
    const isManagement = context.role === "director" || context.role === "manager";
    if (lead.corretorId && lead.corretorId !== context.userId && !isManagement) {
      return {
        success: false,
        error:
          "Este atendimento está sob responsabilidade de outro corretor. Para responder, assuma o atendimento primeiro.",
      };
    }

    const channel = await getPreferredMetaCloudChannel({
      tenantId: context.tenantId,
      userId: context.userId,
      leadId: lead.id,
      customerPhone: lead.telefone,
    });
    if (channel && "blocked" in channel) {
      return { success: false, error: channel.message };
    }
    if (!channel) {
      return { success: false, error: "Nenhum canal oficial da Meta está ativo para envio de mídia." };
    }

    const body = Buffer.from(await file.arrayBuffer());
    const providerMediaId = await uploadMetaMediaObject({
      channel,
      body,
      mimeType: file.type,
      kind: validation.kind,
    });

    // Persist first (ledger authority), then attempt provider delivery.
    const id = randomUUID();
    const stored = await storeConversationMedia({
      tenantId: context.tenantId,
      messageId: id,
      kind: validation.kind,
      mimeType: file.type,
      filename: file.name || null,
      body,
    });

    const sent = await sendMetaCloudMediaMessage({
      channel,
      to: lead.telefone,
      kind: validation.kind,
      providerMediaId,
      caption: captionInput || undefined,
      filename: validation.kind === "document" ? stored.filename ?? undefined : undefined,
    });

    const sentAt = new Date();
    await db.insert(schema.whatsappMessages).values({
      id,
      tenantId: context.tenantId,
      leadId: lead.id,
      communicationChannelId: channel.id,
      provider: "meta_cloud",
      providerStatus: "sent",
      messageId: sent.messageId,
      phone: lead.telefone,
      direction: "outgoing",
      body: captionInput || `[${validation.kind}]`,
      sentAt,
      mediaKind: stored.kind,
      mediaMimeType: stored.mimeType,
      mediaFilename: stored.filename,
      mediaSizeBytes: stored.sizeBytes,
      mediaStorageKey: stored.storageKey,
      mediaProviderId: providerMediaId,
      mediaSha256: stored.sha256,
    });

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "whatsapp_message",
      entidadeId: id,
      acao: `midia_enviada:${validation.kind}`,
    });

    revalidatePath("/conversas");
    scheduleLeadConversationAnalysis(lead.id, context.tenantId);
    void publishConversationInvalidation({ tenantId: context.tenantId, participantUserIds: [context.userId] }).catch(
      () => undefined,
    );

    return {
      success: true,
      message: {
        id,
        body: captionInput || `[${validation.kind}]`,
        direction: "outgoing",
        sentAt,
        media: {
          kind: stored.kind,
          mimeType: stored.mimeType,
          filename: stored.filename,
          sizeBytes: stored.sizeBytes,
          url: `/api/conversations/media/${id}`,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a mídia agora. Tente novamente.",
    };
  }
}
