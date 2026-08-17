"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { transitionConversationState } from "./conversation-state-machine";

const conversationIdSchema = z.string().trim().min(1).max(120);

type ConversationActionResult = { success: true } | { success: false; error: string };

async function authorizeConversation(conversationId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [conversation] = await db
    .select({
      id: schema.aiConversations.id,
      leadId: schema.aiConversations.leadId,
      assignedUserId: schema.aiConversations.assignedUserId,
      leadOwnerId: schema.leads.corretorId,
      leadBranchId: schema.leads.branchId,
    })
    .from(schema.aiConversations)
    .leftJoin(schema.leads, and(eq(schema.aiConversations.leadId, schema.leads.id), eq(schema.leads.tenantId, context.tenantId)))
    .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, context.tenantId)))
    .limit(1);

  if (!conversation) throw new Error("Conversa não encontrada.");
  if (context.role === "manager" && (!context.branchId || conversation.leadBranchId !== context.branchId)) {
    throw new Error("Esta conversa não pertence à sua filial.");
  }
  if (context.role === "broker" && conversation.assignedUserId !== context.userId && conversation.leadOwnerId !== context.userId) {
    throw new Error("Você só pode gerenciar conversas atribuídas a você.");
  }
  return { context, db, conversation };
}

async function auditConversationAction(input: { userId: string; conversationId: string; action: string }) {
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: input.userId,
    entidade: "ai_conversation",
    entidadeId: input.conversationId,
    acao: input.action,
  });
}

function parseConversationId(conversationId: string) {
  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) throw new Error("Conversa inválida.");
  return parsed.data;
}

export async function takeoverConversationAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const { context, conversation } = await authorizeConversation(parseConversationId(conversationId));
    await transitionConversationState({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      newStatus: "HUMAN_ACTIVE",
      reason: "Automação pausada manualmente; continuidade ocorre fora do CRM",
      assignedUserId: context.userId,
      pausedByUserId: context.userId,
    });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.automation_paused" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível assumir a conversa." };
  }
}

export async function returnConversationToAiAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const { context, conversation } = await authorizeConversation(parseConversationId(conversationId));
    if (context.role !== "director" && context.role !== "manager") return { success: false, error: "Apenas Diretor ou Gestor podem retomar a automação." };
    await transitionConversationState({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_CUSTOMER",
      reason: "Automação retomada por gestor autorizado",
      assignedUserId: null,
      pausedByUserId: null,
    });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.automation_resumed" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível devolver a conversa à IA." };
  }
}

export async function closeConversationAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const { context, conversation } = await authorizeConversation(parseConversationId(conversationId));
    await transitionConversationState({ tenantId: context.tenantId, conversationId: conversation.id, newStatus: "CLOSED", reason: "Atendimento finalizado manualmente" });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.closed" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível encerrar a conversa." };
  }
}

export async function resetAiConversationAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const { context, db, conversation } = await authorizeConversation(parseConversationId(conversationId));
    await db.transaction(async (tx) => {
      await tx.update(schema.whatsappMessages).set({ conversationId: null })
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.conversationId, conversation.id)));
      await tx.update(schema.aiConversations).set({
        status: "NEW",
        memory: null,
        lastProcessedMessageId: null,
        transferReason: null,
        qualificationSummary: null,
        assignedUserId: null,
        pausedByUserId: null,
        transferredAt: null,
        closedAt: null,
        automationState: "AI_ACTIVE",
        quickReplyLastTemplate: null,
        quickReplyLastSentAt: null,
        quickReplyWaitWindowStartedAt: null,
        quickReplyWaitResponseCount: 0,
        optOutAt: null,
        wrongNumberAt: null,
        updatedAt: new Date(),
      }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, context.tenantId)));
    });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.reset" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível reiniciar a conversa." };
  }
}

export async function resumeAiQualificationAction(leadId: string): Promise<ConversationActionResult> {
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db
      .select({ id: schema.leads.id, telefone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { success: false, error: "Lead não encontrado." };
    if (!lead.telefone) return { success: false, error: "Este lead não possui um número de telefone cadastrado." };

    const { getOrCreateAiConversation, transitionConversationState, processInboundAiResponse } = await import("@/features/ai-agent/conversation-state-machine");
    const conversation = await getOrCreateAiConversation({ tenantId: context.tenantId, leadId: lead.id });

    // Reactivate AI state
    await transitionConversationState({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_CUSTOMER",
      reason: "Atendimento de qualificação retomado manualmente",
      assignedUserId: null,
    });

    await db
      .update(schema.leads)
      .set({ qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: new Date() })
      .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));

    const last8Digits = lead.telefone.replace(/\D/g, "").slice(-8);

    // 1. Fetch latest incoming message from lead (checking leadId, conversationId, or last 8 digits of phone)
    const [latestIncoming] = await db
      .select({
        body: schema.whatsappMessages.body,
        messageId: schema.whatsappMessages.messageId,
        communicationChannelId: schema.whatsappMessages.communicationChannelId,
        provider: schema.whatsappMessages.provider,
        sentAt: schema.whatsappMessages.sentAt,
      })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.tenantId, context.tenantId),
          or(
            eq(schema.whatsappMessages.leadId, lead.id),
            eq(schema.whatsappMessages.conversationId, conversation.id),
            sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${last8Digits}`
          ),
          or(
            eq(schema.whatsappMessages.direction, "incoming"),
            eq(schema.whatsappMessages.direction, "inbound")
          )
        )
      )
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(1);

    // 2. Fetch latest outbound assistant message
    const [latestOutbound] = await db
      .select({ sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.tenantId, context.tenantId),
          or(
            eq(schema.whatsappMessages.leadId, lead.id),
            eq(schema.whatsappMessages.conversationId, conversation.id),
            sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${last8Digits}`
          ),
          or(
            eq(schema.whatsappMessages.senderRole, "assistant"),
            eq(schema.whatsappMessages.senderRole, "system"),
            eq(schema.whatsappMessages.senderRole, "agent"),
            eq(schema.whatsappMessages.direction, "outbound"),
            eq(schema.whatsappMessages.direction, "outgoing")
          )
        )
      )
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(1);

    const hasUnansweredIncoming = latestIncoming?.sentAt && latestOutbound?.sentAt
      ? latestIncoming.sentAt.getTime() > latestOutbound.sentAt.getTime()
      : Boolean(latestIncoming?.sentAt && !latestOutbound?.sentAt);

    if (hasUnansweredIncoming && latestIncoming?.body) {
      // Process the unanswered incoming customer message immediately
      await processInboundAiResponse({
        tenantId: context.tenantId,
        leadId: lead.id,
        phone: lead.telefone,
        userMessageBody: latestIncoming.body,
        communicationChannelId: latestIncoming.communicationChannelId,
        providerMessageId: latestIncoming.messageId,
        transport: (latestIncoming.provider as any) ?? "meta",
        skipDebounce: true,
      }).catch((err) => console.error("[resumeAiQualificationAction] processInboundAiResponse error:", err));
    } else if (!latestIncoming && !latestOutbound) {
      // Brand new lead with zero messages ever — start first contact
      const { startQualificationConversationForLead } = await import("@/features/ai-agent/conversation-state-machine");
      await startQualificationConversationForLead({ tenantId: context.tenantId, leadId: lead.id, actorUserId: context.userId }, false);
    }

    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.resumed_by_user" });

    revalidatePath("/conversas");
    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível retomar o atendimento da IA." };
  }
}

export async function syncSingleLeadConversationAction(leadId: string): Promise<{ success: boolean; messagesCount?: number; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({ id: schema.leads.id, phone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { success: false, error: "Lead não encontrado." };

    const digits = lead.phone ? lead.phone.replace(/\D/g, "") : "";
    if (digits) {
      const last8 = digits.slice(-8);
      if (last8.length >= 8) {
        await db
          .update(schema.whatsappMessages)
          .set({ leadId: lead.id })
          .where(and(
            eq(schema.whatsappMessages.tenantId, context.tenantId),
            isNull(schema.whatsappMessages.leadId),
            sql`REPLACE(${schema.whatsappMessages.phone}, '+', '') LIKE ${`%${last8}`}`
          ))
          .catch(() => undefined);
      }
    }

    const messages = await db
      .select({ id: schema.whatsappMessages.id })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, leadId)));

    if (messages.length === 0) {
      const { startAiQualificationForLead } = await import("@/features/ai-qualification/service");
      await startAiQualificationForLead({ tenantId: context.tenantId, leadId: lead.id, actorUserId: context.userId, force: true }).catch(() => undefined);
    }

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_conversation",
      entidadeId: leadId,
      acao: "lead_conversation.synced",
    });

    revalidatePath("/conversas");
    revalidatePath(`/leads/${leadId}`);
    return { success: true, messagesCount: messages.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao sincronizar histórico do chat." };
  }
}
