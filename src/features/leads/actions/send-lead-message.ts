"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getOpenWaSessionStatus, sendOpenWaText } from "@/lib/integrations/openwa";
import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type SendLeadMessageResult = { success: boolean; error?: string; message?: { id: string; body: string; direction: string; sentAt: Date } };

export async function sendLeadMessageAction(leadId: string, body: string): Promise<SendLeadMessageResult> {
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
    if (lead.status === "distributed") return { success: false, error: "Inicie o atendimento antes de enviar mensagens." };
    if (lead.corretorId !== context.userId) return { success: false, error: "Este atendimento está sob responsabilidade de outro corretor. Para responder, assuma o atendimento primeiro." };

    const officialChannel = await getPreferredMetaCloudChannel({ tenantId: context.tenantId, branchId: lead.branchId, userId: context.userId });
    if (officialChannel) {
      const sent = await sendMetaCloudChannelText({ channel: officialChannel, to: lead.telefone, body: text });
      const sentAt = new Date();
      const id = randomUUID();
      await db.insert(schema.whatsappMessages).values({ id, tenantId: context.tenantId, leadId: lead.id, communicationChannelId: officialChannel.id, provider: "meta_cloud", providerStatus: "sent", messageId: sent.messageId, phone: lead.telefone, direction: "outgoing", body: text, sentAt });
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/conversas");
      return { success: true, message: { id, body: text, direction: "outgoing", sentAt } };
    }

    const [connection] = await db.select({ sessionId: schema.whatsappConnections.sessionId, status: schema.whatsappConnections.status, active: schema.whatsappConnections.chatInternoAtivo })
      .from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1);
    if (!connection?.sessionId || connection.status !== "ready") return { success: false, error: "Conecte o WhatsApp e aguarde o status Conectado." };
    if (!connection.active) return { success: false, error: "O chat interno está desativado nas integrações." };
    const liveStatus = await getOpenWaSessionStatus(connection.sessionId);
    if (liveStatus.status !== "ready") return { success: false, error: `WhatsApp não está pronto para enviar. Status atual: ${liveStatus.status ?? "desconhecido"}. Leia o QR Code novamente.` };

    const sent = await sendOpenWaText(connection.sessionId, lead.telefone, text);
    const sentAt = new Date();
    const id = randomUUID();
    await db.insert(schema.whatsappMessages).values({ id, tenantId: context.tenantId, leadId: lead.id, provider: "openwa_legacy", providerStatus: "sent", messageId: sent.messageId ?? id, phone: lead.telefone, direction: "outgoing", body: text, sentAt });
    revalidatePath(`/leads/${leadId}`);
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
  const messages = await db.select({ id: schema.whatsappMessages.id, body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, sentAt: schema.whatsappMessages.sentAt }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, leadId))).orderBy(schema.whatsappMessages.sentAt);
  console.info("[Chat] mensagens carregadas", JSON.stringify({ leadId, tenantId: context.tenantId, total: messages.length, lastMessageId: messages.at(-1)?.id ?? null }));
  return { success: true as const, messages };
}
