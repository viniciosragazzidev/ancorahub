import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getQualificationTenantSettings } from "./tenant-settings-service";

export type QualificationClosingStateRecord = {
  sessionId: string;
  tenantId: string;
  leadId: string | null;
  qualificationCompletedAt: Date | null;
  closingMessageQueuedAt: Date | null;
  closingMessageSentAt: Date | null;
  closingMessageId: string | null;
  closingMessageStatus: string;
  distributionExecutedAt: Date | null;
  handoffCreatedAt: Date | null;
  postClosingNoticeSentAt: Date | null;
};

export async function getQualificationClosingState(
  tenantId: string,
  sessionId: string
): Promise<QualificationClosingStateRecord | null> {
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(schema.aiQualificationClosingStates)
    .where(
      and(
        eq(schema.aiQualificationClosingStates.tenantId, tenantId),
        eq(schema.aiQualificationClosingStates.sessionId, sessionId)
      )
    )
    .limit(1);

  if (!existing) return null;

  return {
    sessionId: existing.sessionId,
    tenantId: existing.tenantId,
    leadId: existing.leadId,
    qualificationCompletedAt: existing.qualificationCompletedAt,
    closingMessageQueuedAt: existing.closingMessageQueuedAt,
    closingMessageSentAt: existing.closingMessageSentAt,
    closingMessageId: existing.closingMessageId,
    closingMessageStatus: existing.closingMessageStatus,
    distributionExecutedAt: existing.distributionExecutedAt,
    handoffCreatedAt: existing.handoffCreatedAt,
    postClosingNoticeSentAt: existing.postClosingNoticeSentAt,
  };
}

/**
  Executes deterministic closing for a qualification session.
  Idempotency Key: qualification-closing:{tenantId}:{sessionId}:v1
 */
export async function executeDeterministicClosing(
  tenantId: string,
  sessionId: string,
  leadId?: string,
  leadName?: string
): Promise<{ closingMessage: string; messageId: string; alreadyExecuted: boolean }> {
  const db = getDatabase();
  const existing = await getQualificationClosingState(tenantId, sessionId);

  if (existing?.closingMessageSentAt) {
    return {
      closingMessage: "Qualificação já encerrada anteriormente.",
      messageId: existing.closingMessageId ?? "existing_msg_id",
      alreadyExecuted: true,
    };
  }

  const settings = await getQualificationTenantSettings(tenantId);
  const firstName = leadName ? leadName.split(" ")[0] : "Cliente";

  const closingMessage = (settings?.finalMessage ?? "Obrigado pelas informações, {{firstName}}! Sua qualificação foi concluída e um de nossos corretores entrará em contato em instantes.")
    .replace("{{firstName}}", firstName);

  const now = new Date();
  const messageId = `wamid.close_${randomUUID().slice(0, 12)}`;

  await db
    .insert(schema.aiQualificationClosingStates)
    .values({
      id: randomUUID(),
      tenantId,
      sessionId,
      leadId: leadId ?? null,
      qualificationCompletedAt: now,
      closingMessageQueuedAt: now,
      closingMessageSentAt: now,
      closingMessageId: messageId,
      closingMessageStatus: "sent",
      distributionExecutedAt: now,
      handoffCreatedAt: now,
      postClosingNoticeSentAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.aiQualificationClosingStates.tenantId,
        schema.aiQualificationClosingStates.sessionId,
      ],
      set: {
        closingMessageSentAt: now,
        closingMessageId: messageId,
        closingMessageStatus: "sent",
        distributionExecutedAt: now,
        handoffCreatedAt: now,
        updatedAt: now,
      },
    });

  return {
    closingMessage,
    messageId,
    alreadyExecuted: false,
  };
}

/**
  Handles inbound messages when session is in `completed_waiting_broker` state.
  Returns whether a notice was sent or if message should simply be stored.
  NO OPENROUTER / AI CALL OCCURS HERE.
 */
export async function handlePostClosingInboundMessage(
  tenantId: string,
  sessionId: string
): Promise<{ noticeSent: boolean; messageText: string | null }> {
  const db = getDatabase();
  const state = await getQualificationClosingState(tenantId, sessionId);

  if (!state?.postClosingNoticeSentAt) {
    const now = new Date();
    const noticeText = "Seu atendimento já foi encaminhado. Um corretor entrará em contato assim que estiver disponível.";

    await db
      .update(schema.aiQualificationClosingStates)
      .set({
        postClosingNoticeSentAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.aiQualificationClosingStates.tenantId, tenantId),
          eq(schema.aiQualificationClosingStates.sessionId, sessionId)
        )
      );

    return { noticeSent: true, messageText: noticeText };
  }

  // Already sent post-closing notice once. Simply store message and notify queue.
  return { noticeSent: false, messageText: null };
}
