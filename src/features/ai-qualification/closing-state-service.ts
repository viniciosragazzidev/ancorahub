import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { withBrokerReturnPhrase } from "@/features/qualification-engine/broker-window";
import { getDatabase, schema } from "@/shared/db";
import { getQualificationTenantSettings } from "./tenant-settings-service";

/** Closing during working hours. "{{firstName}}" goes away when the lead has no name. */
export const CLOSING_DEFAULT_TEXT = "Obrigado pelas informações, {{firstName}}! Está tudo anotado. Um corretor vai falar com você por aqui em instantes.";
/** Closing outside working hours: "{{quando}}" is filled with the next broker's return (broker-window.ts). */
export const CLOSING_AFTER_HOURS_TEXT = "Obrigado pelas informações, {{firstName}}! Está tudo anotado. Um corretor fala com você por aqui {{quando}}.";
/** Text sent to a customer who writes again after the closing, once. */
export const POST_CLOSING_NOTICE_TEXT = "Recebi sua mensagem, obrigado! Seu atendimento já está com um corretor, que te responde por aqui {{quando}}.";

/**
 * Former default closings. The schema default ("Obrigado! Um corretor continuará...") and the
 * first closing wording are kept by tenants that never edited them: they give way to the current default.
 */
const RETIRED_FINAL_MESSAGES = new Set([
  "Obrigado! Um corretor continuará seu atendimento em seguida.",
  "Obrigado pelas informações, {{firstName}}! Sua qualificação foi concluída e um de nossos corretores entrará em contato em instantes.",
]);

export function effectiveFinalMessage(configured: string | null | undefined) {
  const text = configured?.trim();
  return text && !RETIRED_FINAL_MESSAGES.has(text) ? text : CLOSING_DEFAULT_TEXT;
}

function fillFirstName(text: string, firstName: string | null) {
  return firstName ? text.replace("{{firstName}}", firstName) : text.replace(", {{firstName}}", "");
}

/**
 * Extension point: the closing message is the last thing the customer reads before the handoff.
 * Other parts can add a line here (for example, the optional invitation about who the plan is for).
 */
function withClosingExtension(message: string) {
  return message;
}

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
  leadName?: string,
  providerMessageId?: string | null,
): Promise<{ closingMessage: string; messageId: string; alreadyExecuted: boolean }> {
  if (!providerMessageId?.trim()) {
    throw new Error("A mensagem final precisa de confirmação do provedor antes do encerramento.");
  }
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
  const firstName = leadName ? leadName.split(" ")[0] ?? null : null;

  // Outside the brokers' working hours (Sunday, national holidays, 19h to 9h) the closing says when the next one answers.
  const { isAfterHoursInSaoPaulo } = await import("@/features/qualification-engine/reply-composer");
  const template = isAfterHoursInSaoPaulo() ? CLOSING_AFTER_HOURS_TEXT : effectiveFinalMessage(settings?.finalMessage);
  const closingMessage = withClosingExtension(withBrokerReturnPhrase(fillFirstName(template, firstName)));

  const now = new Date();
  const messageId = providerMessageId;

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

  if (!state) {
    return { noticeSent: false, messageText: null };
  }

  if (!state.postClosingNoticeSentAt) {
    const now = new Date();
    const noticeText = withBrokerReturnPhrase(POST_CLOSING_NOTICE_TEXT);

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

