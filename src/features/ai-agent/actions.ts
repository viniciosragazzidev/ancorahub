"use server";

import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { transitionConversationState, type ConversationStatus } from "./conversation-state-machine";

export async function takeoverConversationAction({
  tenantId,
  conversationId,
  userId,
}: {
  tenantId: string;
  conversationId: string;
  userId: string;
}) {
  try {
    const db = getDatabase();
    const [conv] = await db.select({ leadId: schema.aiConversations.leadId })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, tenantId)))
      .limit(1);

    await transitionConversationState({
      tenantId,
      conversationId,
      newStatus: "HUMAN_ACTIVE",
      reason: "Atendimento assumido manualmente por corretor/humano",
      assignedUserId: userId,
      pausedByUserId: userId,
    });

    if (conv?.leadId) {
      await db.update(schema.leads)
        .set({
          corretorId: userId,
          status: "in_contact",
          updatedAt: new Date(),
        })
        .where(and(eq(schema.leads.id, conv.leadId), eq(schema.leads.tenantId, tenantId)));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function returnConversationToAiAction({
  tenantId,
  conversationId,
}: {
  tenantId: string;
  conversationId: string;
}) {
  try {
    const db = getDatabase();
    const [conv] = await db.select({ leadId: schema.aiConversations.leadId })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, tenantId)))
      .limit(1);

    await transitionConversationState({
      tenantId,
      conversationId,
      newStatus: "AI_ACTIVE",
      reason: "Atendimento devolvido para IA",
      assignedUserId: null,
      pausedByUserId: null,
    });

    if (conv?.leadId) {
      await db.update(schema.leads)
        .set({
          corretorId: null,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.leads.id, conv.leadId), eq(schema.leads.tenantId, tenantId)));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function closeConversationAction({
  tenantId,
  conversationId,
}: {
  tenantId: string;
  conversationId: string;
}) {
  try {
    await transitionConversationState({
      tenantId,
      conversationId,
      newStatus: "CLOSED",
      reason: "Atendimento finalizado",
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function resetAiConversationAction({
  tenantId,
  conversationId,
}: {
  tenantId: string;
  conversationId: string;
}) {
  try {
    const db = getDatabase();
    const [conv] = await db.select({ leadId: schema.aiConversations.leadId })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, tenantId)))
      .limit(1);

    await db.update(schema.aiConversations)
      .set({
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
      })
      .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, tenantId)));

    if (conv?.leadId) {
      await db.update(schema.leads)
        .set({
          corretorId: null,
          status: "new",
          updatedAt: new Date(),
        })
        .where(and(eq(schema.leads.id, conv.leadId), eq(schema.leads.tenantId, tenantId)));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
