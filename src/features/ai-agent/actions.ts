"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
      reason: "Atendimento assumido manualmente por corretor",
      assignedUserId: context.userId,
      pausedByUserId: context.userId,
    });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.taken_over" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível assumir a conversa." };
  }
}

export async function returnConversationToAiAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const { context, conversation } = await authorizeConversation(parseConversationId(conversationId));
    await transitionConversationState({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_CUSTOMER",
      reason: "Atendimento devolvido para IA",
      assignedUserId: null,
      pausedByUserId: null,
    });
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.returned_to_ai" });
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
    await db.update(schema.aiConversations).set({
      status: "NEW",
      memory: null,
      lastProcessedMessageId: null,
      transferReason: null,
      qualificationSummary: null,
      assignedUserId: null,
      pausedByUserId: null,
      transferredAt: null,
      closedAt: null,
      updatedAt: new Date(),
    }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, context.tenantId)));
    await auditConversationAction({ userId: context.userId, conversationId: conversation.id, action: "ai_conversation.reset" });
    revalidatePath("/conversas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível reiniciar a conversa." };
  }
}
