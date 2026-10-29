import { randomUUID } from "crypto";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { generateAiResponse, detectLanguage, detectHumanTransferRequest } from "./service";
import { loadTenantAiAgentConfig } from "./tenant-config";
import {
  extractFieldsFromMessage,
  buildMemoryContext,
  COLLECTIBLE_FIELDS,
  createEmptyMemory,
  extractUnansweredMessages,
  pendingQuestionOf,
  pendingQuestionsOf,
  type ConversationMemory,
} from "./memory";
import { createSafeFallbackResponse } from "./ai-response-schema";
import { captureBeneficiaryRelations, parseAgeValues } from "./beneficiary-relations";
import {
  createDefaultGuardrailPipeline,
  runGuardrailPipeline,
} from "./guardrails";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { initialMessageFailureLeadDisposition, initialMessageFailureNote } from "@/features/communication-channels/meta-delivery-failure";
import { resolveCanonicalWhatsAppDestination } from "@/features/communication-channels/phone-resolution";
import { sendOpenWaText } from "@/lib/integrations/openwa";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { detectLateralSituation, quickReplyTuning } from "@/features/attendance-situations/catalog";
import { loadTenantSituations } from "@/features/attendance-situations/service";
import { recordLearningEvent } from "@/features/situation-learning/service";
import { loadQuickReplyTemplates, parseExplicitStop, parseOptOut, parseSoftDecline, resolveQuickReply, shouldContinueQualificationAfterMedia, type ConversationAutomationState, type QuickReplyMessageKind } from "./quick-reply";
import { AFTER_HOURS_HUMAN_REQUEST_TEXT, AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, composeGreeting, DEFAULT_HUMAN_REQUEST_TEXT, DEFAULT_QUALIFIED_HANDOFF_TEXT, effectiveHandoffText, isAfterHoursInSaoPaulo, priceConcernLine, renderConversationVariables, shouldAddPriceConcern, shouldUsePeriodGreeting, summarizeQualification, type QualificationFieldKey } from "@/features/qualification-engine/reply-composer";
import { isAutomatedInboundMessage } from "./automated-inbound";
import { afterHoursText } from "@/features/qualification-engine/broker-window";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolvePublishedAgentBehavior } from "@/features/agent-training/runtime";
import { evaluateQualification, persistQualificationEvaluation, getNextQualificationQuestion, replaceHandoffTextPreservingExtension, resolveDeterministicQualificationTurn, type DeterministicQualificationTurn } from "@/features/qualification-engine/service";
import { terminalReplyLeadDisposition } from "./quick-reply";
import { enqueueAndProcessLeadDistribution } from "@/features/lead-distribution/jobs";
import { enqueueWahaAiReply } from "@/features/waha-cadence/service";
import { handlePostClosingInboundMessage } from "@/features/ai-qualification/closing-state-service";
import { isConfirmedClosingDelivery } from "@/features/ai-qualification/closing-contract";
import { buildHumanHandoffLeadUpdate } from "./human-handoff-state";
import { applyAiMemoryUpdates, buildQualificationFallbackPrompt, shouldUseQualificationFallback } from "./qualification-fallback";
import { interpretQualificationTurn, shouldVerifyExtraction, VERIFIABLE_FIELDS, verifyExtractedFacts, type InterpreterResult, type VerifiableField } from "./qualification-interpreter";
import { applyQualificationCorrectionsToMemory, describeQualificationCorrections, detectQualificationCorrections } from "./qualification-corrections";
import { generateLateralAnswer, isCustomerQuestion } from "./lateral-answer";
import { canResumeDistributedQualification, distributedHandoffText } from "./distributed-resume";


export type ConversationStatus =
  | "NEW"
  | "AI_ACTIVE"
  | "WAITING_CUSTOMER"
  | "WAITING_HUMAN"
  | "HUMAN_ACTIVE"
  | "PAUSED"
  | "CLOSED"
  | "FAILED";

type AiTransport = "meta" | "openwa" | "waha";

type AiMessage = { role: "user" | "assistant"; content: string };

/**
 * Decisão pura do reset de memória por mensagem.
 *
 * Quando o modo é "before_each_message", o agente responde do zero:
 * a memória base é zerada (createEmptyMemory) e o contexto enviado à IA
 * contém apenas a mensagem atual (sem histórico).
 *
 * Em qualquer outro modo (before_each_session, never, manual), preserva-se
 * a memória armazenada e o histórico formatado.
 */
export function resolveMemoryResetContext(input: {
  resetMode: string | undefined;
  storedMemory: ConversationMemory | null;
  formattedHistory: AiMessage[];
  currentMessage: string;
  historyAlreadyContainsCurrentMessage: boolean;
}): { resetMemoryEachMessage: boolean; baseMemory: ConversationMemory; aiMessages: AiMessage[] } {
  const resetMemoryEachMessage = (input.resetMode ?? "before_each_session") === "before_each_message";
  const baseMemory: ConversationMemory = resetMemoryEachMessage
    ? createEmptyMemory()
    : input.storedMemory ?? createEmptyMemory();
  const aiMessages: AiMessage[] = resetMemoryEachMessage
    ? [{ role: "user", content: input.currentMessage }]
    : input.historyAlreadyContainsCurrentMessage
      ? input.formattedHistory
      : [...input.formattedHistory, { role: "user", content: input.currentMessage }];
  return { resetMemoryEachMessage, baseMemory, aiMessages };
}

export async function handleInitialMessageFailure({
  tenantId,
  leadId,
  conversationId,
  reason = "initial_message_failed",
  failureCode,
}: {
  tenantId: string;
  leadId: string;
  conversationId?: string | null;
  reason?: string;
  /** Meta's error code, when known, to tell the team why the message did not arrive. */
  failureCode?: string | null;
}) {
  try {
    const db = getDatabase();
    const now = new Date();
    const systemUserId = await resolveSystemUserId(tenantId);

    if (conversationId) {
      await db
        .update(schema.aiConversations)
        .set({
          status: "CLOSED",
          automationState: "CLOSED",
          transferReason: reason,
          updatedAt: now,
        })
        .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, tenantId)));
    } else {
      const [conv] = await db
        .select({ id: schema.aiConversations.id })
        .from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.leadId, leadId), eq(schema.aiConversations.tenantId, tenantId)))
        .limit(1);

      if (conv) {
        await db
          .update(schema.aiConversations)
          .set({
            status: "CLOSED",
            automationState: "CLOSED",
            transferReason: reason,
            updatedAt: now,
          })
          .where(and(eq(schema.aiConversations.id, conv.id), eq(schema.aiConversations.tenantId, tenantId)));
      }
    }

    await db
      .update(schema.leads)
      .set({
        ...initialMessageFailureLeadDisposition(failureCode),
        updatedAt: now,
      })
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));

    // No WhatsApp on this number (Meta 131026): a broker calls it from the CALLEX queue (23/10).
    if (initialMessageFailureLeadDisposition(failureCode).qualificationStatus === "no_whatsapp_contact") {
      const { routeLeadToCallex } = await import("@/features/lead-distribution/callex");
      await routeLeadToCallex({ tenantId, leadId, actorId: systemUserId }).catch((error) => {
        console.error("[handleInitialMessageFailure] callex_route_failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      });
    }

    await db.insert(schema.leadDistributionEvents).values({
      id: randomUUID(),
      tenantId,
      leadId,
      action: "initial_message_failed_manual_hold",
      source: "ai_qualification",
      strategy: "manual",
      reason: "A primeira mensagem de qualificação não foi entregue; o lead aguarda ação manual.",
      actorId: systemUserId,
      createdAt: now,
    });

    await db
      .insert(schema.leadInteractions)
      .values({
        id: randomUUID(),
        leadId,
        userId: systemUserId,
        tipo: "note",
        conteudo: initialMessageFailureNote(failureCode),
        createdAt: now,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.auditLogs)
      .values({
        id: randomUUID(),
        userId: systemUserId,
        entidade: "lead",
        entidadeId: leadId,
        acao: `lead.initial_message_failed_manual_hold:${reason}`,
        createdAt: now,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn("[handleInitialMessageFailure] DB operation skipped or warning:", err);
  }
}

export async function sendAiOutbound(input: {
  tenantId: string;
  leadId?: string;
  clientId?: string;
  phone: string;
  body: string;
  transport?: AiTransport;
  openWaSessionId?: string | null;
  wahaRunId?: string | null;
  currentMessageId?: string;
}) {
  const transport = input.transport ?? "meta";
  const db = getDatabase();
  const deliveryPhone = await resolveCanonicalWhatsAppDestination({
    tenantId: input.tenantId,
    phone: input.phone,
  });
  const last9Digits = input.phone.replace(/\D/g, "").slice(-9);
  const [lastOutbound] = await db
    .select({ sentAt: schema.whatsappMessages.sentAt })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, input.tenantId),
        or(
          eq(schema.whatsappMessages.phone, input.phone),
          sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 9) = ${last9Digits}`
        ),
        or(
          eq(schema.whatsappMessages.senderRole, "assistant"),
          eq(schema.whatsappMessages.senderRole, "system"),
          eq(schema.whatsappMessages.senderRole, "agent"),
          eq(schema.whatsappMessages.direction, "outbound"),
          eq(schema.whatsappMessages.direction, "outgoing")
        ),
        input.currentMessageId ? ne(schema.whatsappMessages.id, input.currentMessageId) : undefined
      )
    )
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(1);

  if (lastOutbound?.sentAt) {
    const { getSystemSetting } = await import("@/features/system-settings/queries");
    const debounceSetting = await getSystemSetting("ai_debounce_delay_seconds").catch(() => null);
    const debounceSeconds = debounceSetting !== null && debounceSetting !== undefined ? parseInt(debounceSetting, 10) : 0;
    if (debounceSeconds > 0) {
      const elapsedMs = Date.now() - new Date(lastOutbound.sentAt).getTime();
      if (elapsedMs < 1_000) {
        await new Promise((resolve) => setTimeout(resolve, 1_000 - elapsedMs));
      }
    }
  }

  if (input.transport === "openwa" && input.openWaSessionId) {
    try {
      const sent = await sendOpenWaText(input.openWaSessionId, deliveryPhone ?? input.phone, input.body);
      if (sent.messageId) return { status: "sent" as const, messageId: sent.messageId };
    } catch (err) {
      console.warn("[sendAiOutbound] openwa primary failed", err);
    }
  }

  if (input.transport === "waha" && input.wahaRunId) {
    try {
      const messageId = await enqueueWahaAiReply({ tenantId: input.tenantId, runId: input.wahaRunId, body: input.body });
      if (messageId) return { status: "sent" as const, messageId };
    } catch (err) {
      console.warn("[sendAiOutbound] waha primary failed", err);
    }
  }

  const channel = await getPreferredMetaCloudChannel({
    tenantId: input.tenantId,
    leadId: input.leadId,
    clientId: input.clientId,
    customerPhone: input.phone,
  });
  if (channel && "blocked" in channel) {
    console.warn("[sendAiOutbound] source channel unavailable; skipping alternate sender", {
      reason: channel.reason,
    });
    return { status: "blocked_source_channel" as const, messageId: null, reason: channel.reason, channelLabel: channel.channelLabel };
  }
  if (channel) {
    try {
      const sent = await sendMetaCloudChannelText({ channel, to: deliveryPhone ?? input.phone, body: input.body });
      if (sent.messageId) return { status: "sent" as const, messageId: sent.messageId };
    } catch (err) {
      console.warn("[sendAiOutbound] meta cloud failed", err);
    }
  }

  // Fallback para sessão conectada no OpenWA legado se houver
  const [openWaConn] = await db
    .select({ sessionId: schema.whatsappConnections.sessionId })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.tenantId, input.tenantId), eq(schema.whatsappConnections.status, "ready")))
    .limit(1);
  if (openWaConn?.sessionId) {
    try {
      const sent = await sendOpenWaText(openWaConn.sessionId, deliveryPhone ?? input.phone, input.body);
      if (sent.messageId) return { status: "sent" as const, messageId: sent.messageId };
    } catch (err) {
      console.warn("[sendAiOutbound] openwa fallback failed", err);
    }
  }

  return { status: "skipped_no_channel" as const, messageId: null };
}

let tablesEnsured = true;
// Promise de lock para evitar execuções paralelas durante o build
let ensuringPromise: Promise<void> | null = null;

export async function ensureAiTablesExist() {
  if (tablesEnsured) return;
  if (ensuringPromise) return ensuringPromise;
  ensuringPromise = _runEnsure();
  await ensuringPromise;
}

async function _runEnsure() {
  const db = getDatabase();
  try {
    await db.execute(sql`SET client_min_messages TO WARNING;`);
  } catch {
    // Ignora se a conexão/driver não suportar SET client_min_messages
  }
  const stmts = [
    sql`CREATE TABLE IF NOT EXISTS ai_conversations (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      lead_id text,
      client_id text,
      communication_channel_id text,
      assigned_user_id text,
      status text NOT NULL DEFAULT 'NEW',
      ai_model text DEFAULT 'openrouter/auto',
      qualification_summary text,
      transfer_reason text,
      paused_by_user_id text,
      language text NOT NULL DEFAULT 'pt-BR',
      last_processed_message_id text,
      memory jsonb,
      lock_version integer NOT NULL DEFAULT 1,
      started_at timestamp WITH TIME ZONE DEFAULT now(),
      last_activity_at timestamp WITH TIME ZONE DEFAULT now(),
      transferred_at timestamp WITH TIME ZONE,
      closed_at timestamp WITH TIME ZONE,
      automation_state text NOT NULL DEFAULT 'AI_ACTIVE',
      quick_reply_last_template text,
      quick_reply_last_sent_at timestamp WITH TIME ZONE,
      quick_reply_wait_window_started_at timestamp WITH TIME ZONE,
      quick_reply_wait_response_count integer NOT NULL DEFAULT 0,
      opt_out_at timestamp WITH TIME ZONE,
      wrong_number_at timestamp WITH TIME ZONE,
      created_at timestamp WITH TIME ZONE DEFAULT now(),
      updated_at timestamp WITH TIME ZONE DEFAULT now()
    )`,
    sql`CREATE TABLE IF NOT EXISTS ai_attendance_logs (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      conversation_id text,
      lead_id text,
      provider text NOT NULL DEFAULT 'openrouter',
      model_used text NOT NULL,
      prompt_tokens integer DEFAULT 0,
      completion_tokens integer DEFAULT 0,
      total_tokens integer DEFAULT 0,
      estimated_cost text DEFAULT '0',
      latency_ms integer DEFAULT 0,
      status text NOT NULL DEFAULT 'success',
      error_message text,
      source_message_id text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    sql`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS conversation_id text`,
    sql`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_role text DEFAULT 'user'`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS started_at timestamp WITH TIME ZONE DEFAULT now()`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS last_activity_at timestamp WITH TIME ZONE DEFAULT now()`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS transferred_at timestamp WITH TIME ZONE`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS closed_at timestamp WITH TIME ZONE`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS paused_by_user_id text`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS conversation_id text`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS total_tokens integer DEFAULT 0`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS estimated_cost text DEFAULT '0'`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS latency_ms integer DEFAULT 0`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS status text DEFAULT 'success'`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS error_message text`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt-BR'`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS last_processed_message_id text`,
    sql`ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS source_message_id text`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS memory jsonb`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS automation_state text NOT NULL DEFAULT 'AI_ACTIVE'`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS quick_reply_last_template text`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS quick_reply_last_sent_at timestamp WITH TIME ZONE`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS quick_reply_wait_window_started_at timestamp WITH TIME ZONE`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS quick_reply_wait_response_count integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS opt_out_at timestamp WITH TIME ZONE`,
    sql`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS wrong_number_at timestamp WITH TIME ZONE`,
    sql`CREATE TABLE IF NOT EXISTS ai_quick_reply_templates (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, rule_key text NOT NULL, template_key text NOT NULL, body text NOT NULL, active boolean NOT NULL DEFAULT true, updated_by text, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS ai_quick_reply_templates_tenant_rule_unique ON ai_quick_reply_templates (tenant_id, rule_key)`,
    sql`CREATE TABLE IF NOT EXISTS ai_quick_reply_events (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, conversation_id text, lead_id text, source_message_id text, intent text NOT NULL, rule_key text NOT NULL, template_key text, outcome text NOT NULL, estimated_tokens_saved integer NOT NULL DEFAULT 0, notified_user_id text, created_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE INDEX IF NOT EXISTS ai_quick_reply_events_tenant_created_idx ON ai_quick_reply_events (tenant_id, created_at)`,
    sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_status text NOT NULL DEFAULT 'pending'`,
    sql`ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'offline'`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_followup_rules (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, name text NOT NULL, enabled boolean NOT NULL DEFAULT true, trigger text NOT NULL, delay_minutes integer NOT NULL DEFAULT 120, max_attempts integer NOT NULL DEFAULT 3, minimum_interval_minutes integer NOT NULL DEFAULT 60, allowed_days jsonb NOT NULL DEFAULT '[1,2,3,4,5]', allowed_start_time text NOT NULL DEFAULT '08:00', allowed_end_time text NOT NULL DEFAULT '18:00', timezone text NOT NULL DEFAULT 'America/Sao_Paulo', message_mode text NOT NULL DEFAULT 'fixed', fixed_message text, template_id text, stop_conditions jsonb NOT NULL DEFAULT '["client_responded","human_taken","lead_closed","sale_completed","opt_out"]', destination_status text, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_tool_permissions (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, tool_name text NOT NULL, category text NOT NULL, permission text NOT NULL DEFAULT 'allowed', allowed_stage_transitions jsonb, max_calls_per_session integer NOT NULL DEFAULT 10, requires_human_confirmation boolean NOT NULL DEFAULT false, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_destination_rules (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, temperature_class text NOT NULL, destination_type text NOT NULL, destination_target_id text, priority text NOT NULL DEFAULT 'normal', sla_minutes integer NOT NULL DEFAULT 15, fallback_destination_type text NOT NULL DEFAULT 'manager', criteria_conditions jsonb, sort_order integer NOT NULL DEFAULT 0, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS broker_eligibility_profiles (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, user_id text NOT NULL, allowed_lead_types jsonb NOT NULL DEFAULT '["hot","warm","cold"]', specialties jsonb NOT NULL DEFAULT '["individual","familiar","empresarial","pme"]', operators jsonb NOT NULL DEFAULT '["unimed","hapvida"]', max_simultaneous_capacity integer NOT NULL DEFAULT 15, daily_limit integer NOT NULL DEFAULT 40, participates_in_duty boolean NOT NULL DEFAULT true, receives_off_hours boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, paused boolean NOT NULL DEFAULT false, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_closing_states (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, session_id text NOT NULL, lead_id text, qualification_completed_at timestamp WITH TIME ZONE, closing_message_queued_at timestamp WITH TIME ZONE, closing_message_sent_at timestamp WITH TIME ZONE, closing_message_id text, closing_message_status text NOT NULL DEFAULT 'pending', distribution_executed_at timestamp WITH TIME ZONE, handoff_created_at timestamp WITH TIME ZONE, post_closing_notice_sent_at timestamp WITH TIME ZONE, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_system_messages (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, category text NOT NULL, message_text text NOT NULL, template_id text, variables jsonb, active boolean NOT NULL DEFAULT true, created_at timestamp WITH TIME ZONE DEFAULT now(), updated_at timestamp WITH TIME ZONE DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS ai_qualification_alerts (id text PRIMARY KEY NOT NULL, tenant_id text NOT NULL, alert_type text NOT NULL, level text NOT NULL DEFAULT 'warning', status text NOT NULL DEFAULT 'active', message text NOT NULL, suggested_action text, created_at timestamp WITH TIME ZONE DEFAULT now(), resolved_at timestamp WITH TIME ZONE, resolved_by text)`,
  ];

  for (const stmt of stmts) {
    try {
      await db.execute(stmt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignora NOTICE de "já existe" e segue em frente
      if (!msg.includes("already exists")) {
        console.warn("[ai-agent] Migration step failed (non-fatal):", msg);
      }
    }
  }
  tablesEnsured = true;
}

export async function getOrCreateAiConversation({
  tenantId,
  leadId,
  clientId,
  communicationChannelId,
}: {
  tenantId: string;
  leadId?: string | null;
  clientId?: string | null;
  communicationChannelId?: string | null;
}) {
  const db = getDatabase();

  if (!leadId && !clientId) {
    throw new Error("É necessário fornecer leadId ou clientId para a conversa.");
  }

  // Tenta localizar conversa existente
  const [existing] = await db
    .select()
    .from(schema.aiConversations)
    .where(
      and(
        eq(schema.aiConversations.tenantId, tenantId),
        leadId ? eq(schema.aiConversations.leadId, leadId) : undefined,
        clientId ? eq(schema.aiConversations.clientId, clientId) : undefined,
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Cria nova conversa no estado NEW
  const id = `conv_${crypto.randomUUID()}`;
  const now = new Date();

  const behavior = await resolvePublishedAgentBehavior(tenantId);
  await db.insert(schema.aiConversations).values({
    id,
    tenantId,
    leadId: leadId ?? null,
    clientId: clientId ?? null,
    communicationChannelId: communicationChannelId ?? null,
    status: "NEW",
    aiModel: "openrouter/auto",
    language: "pt-BR",
    startedAt: now,
    lastActivityAt: now,
    lockVersion: 1,
    behaviorVersionId: behavior.versionId,
  });

  const [created] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);

  return created;
}

/**
 * Whether starting qualification resumes a conversation instead of opening a
 * new one with the greeting. A conversation is created with its start time,
 * so the start time alone never means "already talking" (it made every new
 * lead skip the greeting).
 */
export function isExistingQualificationConversation(input: { hasMessages: boolean; status: string; lastProcessedMessageId?: string | null }) {
  return input.hasMessages || input.status !== "NEW" || Boolean(input.lastProcessedMessageId);
}

export async function startQualificationConversationForLead(
  input: { tenantId: string; leadId: string; actorUserId: string },
  force: boolean = false,
  /** Started by a queue's attendance flow (DEC-126): the director chose the new engine for that queue. */
  options: { fromFlow?: boolean } = {},
) {
  if (!options.fromFlow && (await getSystemSetting("feature_qualification_engine_enabled")) === "false") return { started: false as const, reason: "disabled" as const };
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    telefone: schema.leads.telefone,
    origem: schema.leads.origem,
    sourceCampaign: schema.leads.sourceCampaign,
    tipo: schema.leads.tipo,
    branchId: schema.leads.branchId,
    nome: schema.leads.nome,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationState: schema.leads.qualificationState,
    externalId: schema.leads.externalId,
    sourceMetadata: schema.leads.sourceMetadata,
  })
    .from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead?.telefone) return { started: false as const, reason: "missing_phone" as const };
  const behavior = await resolvePublishedAgentBehavior(input.tenantId);
  const { leadMatchesQualificationEntryRules } = await import("@/features/qualification-engine/service");
  if (!leadMatchesQualificationEntryRules({ origem: lead.origem, sourceCampaign: lead.sourceCampaign, tipo: lead.tipo, branchId: lead.branchId }, behavior.policy)) return { started: false as const, reason: "not_eligible" as const };
  const conversation = await getOrCreateAiConversation({ tenantId: input.tenantId, leadId: input.leadId });

  const isAlreadyQualifiedOrInHumanState =
    ["WAITING_HUMAN", "HUMAN_ACTIVE", "CLOSED"].includes(conversation.status) ||
    lead.qualificationState === "QUALIFIED" ||
    ["waiting_human", "qualified", "hot", "warm", "cold", "disqualified", "no_whatsapp_contact", "meta_blocked"].includes(lead.qualificationStatus ?? "");

  if (isAlreadyQualifiedOrInHumanState && !force) {
    console.info("[startQualificationConversationForLead] Lead já qualificado/em atendimento humano; pulando requalificação:", {
      leadId: input.leadId,
      convStatus: conversation.status,
      qualState: lead.qualificationState,
      qualStatus: lead.qualificationStatus,
    });
    return { started: false as const, reason: "already_qualified" as const };
  }

  if (!force && !["NEW", "AI_ACTIVE"].includes(conversation.status)) return { started: false as const, reason: "already_started" as const };

  const memory = (conversation.memory as ConversationMemory | null) ?? createEmptyMemory();

  const last8Digits = lead.telefone.replace(/\D/g, "").slice(-8);

  // CHECK IF THE LEAD ALREADY HAS ANY MESSAGES IN WHATSAPP MESSAGES HISTORY OR EXISTING CONVERSATION STATE.
  // By phone alone only what the customer wrote counts (they may write before
  // the lead exists); messages sent to that phone for other purposes (team
  // notices to a broker with the same number) are not this conversation.
  const [existingMsg] = await db
    .select({ id: schema.whatsappMessages.id })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, input.tenantId),
        or(
          eq(schema.whatsappMessages.leadId, input.leadId),
          eq(schema.whatsappMessages.conversationId, conversation.id),
          and(
            sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${last8Digits}`,
            inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
          ),
        )
      )
    )
    .limit(1);

  const isExistingConversation = isExistingQualificationConversation({
    hasMessages: Boolean(existingMsg),
    status: conversation.status,
    lastProcessedMessageId: conversation.lastProcessedMessageId,
  });

  if (isExistingConversation) {
    if (isAlreadyQualifiedOrInHumanState) {
      console.info("[startQualificationConversationForLead] Conversa existente já qualificada ou com atendimento humano ativo; preservando estado:", {
        leadId: input.leadId,
        convStatus: conversation.status,
      });
      return { started: false as const, reason: "already_qualified" as const };
    }

    // Reactivate AI state without resending initial template greeting
    await db.update(schema.aiConversations).set({
      status: "WAITING_CUSTOMER",
      automationState: "AI_ACTIVE",
      behaviorVersionId: behavior.versionId,
      updatedAt: new Date(),
    }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
    await db.update(schema.leads).set({ qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: new Date() }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

    // 1. Fetch latest incoming customer message
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
          eq(schema.whatsappMessages.tenantId, input.tenantId),
          or(
            eq(schema.whatsappMessages.leadId, input.leadId),
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
      .select({
        sentAt: schema.whatsappMessages.sentAt,
      })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.tenantId, input.tenantId),
          or(
            eq(schema.whatsappMessages.leadId, input.leadId),
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
      const { processInboundAiResponse } = await import("./conversation-state-machine");
      await processInboundAiResponse({
        tenantId: input.tenantId,
        leadId: input.leadId,
        phone: lead.telefone,
        userMessageBody: latestIncoming.body,
        communicationChannelId: latestIncoming.communicationChannelId,
        providerMessageId: latestIncoming.messageId,
        transport: (latestIncoming.provider as any) ?? "meta",
        skipDebounce: true,
      }).catch((err) => console.error("[resumeAi] processInboundAiResponse error:", err));
    }

    return { started: true as const, conversationId: conversation.id, resumed: true };
  }

  // What the ad form already answered is never asked again (qualification turbo, plan 2026-10-21 §5C).
  const approachInput = {
    tipo: lead.tipo,
    origem: lead.origem,
    externalId: lead.externalId,
    sourceCampaign: lead.sourceCampaign,
    sourceMetadata: (lead.sourceMetadata as Record<string, unknown> | null) ?? null,
  };
  const { seedMemoryFromLeadForm } = await import("@/features/qualification-turbo/form-seed");
  const seededForm = seedMemoryFromLeadForm(memory, approachInput);
  const startMemory = seededForm.memory;

  const { resolveDeterministicQualificationTurn } = await import("@/features/qualification-engine/service");
  const turn = resolveDeterministicQualificationTurn({ memory: startMemory, policy: behavior.policy });

  const firstField = behavior.policy.requiredFields[0];
  const firstQuestion = COLLECTIBLE_FIELDS.find((field) => field.key === firstField)?.promptLabel ?? "nome";
  const defaultGreeting = `Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento. Para começar, qual é o seu ${firstQuestion}?`;
  const body = turn.kind === "collecting" ? turn.reply : defaultGreeting;

  // DEDUPLICATION: Check if identical message body was created in last 60s
  const [recentDup] = await db
    .select({ id: schema.whatsappMessages.id })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, input.tenantId),
        eq(schema.whatsappMessages.leadId, input.leadId),
        eq(schema.whatsappMessages.body, body),
        gt(schema.whatsappMessages.sentAt, new Date(Date.now() - 60_000))
      )
    )
    .limit(1);

  if (recentDup) {
    await db.update(schema.aiConversations).set({ status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", behaviorVersionId: behavior.versionId, memory: { ...startMemory, lastQuestionAsked: body }, updatedAt: new Date() }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
    return { started: true as const, conversationId: conversation.id, deduped: true };
  }

  // The configured FIRST_CONTACT event owns channel eligibility and fallback.
  let finalBody = body;
  let finalMessageId = `ai_msg_start_${crypto.randomUUID()}`;
  let turboChoice: Awaited<ReturnType<typeof import("@/features/qualification-turbo/service").chooseFirstContact>> | null = null;
  let sentTemplateName: string | null = null;

  try {
    const { getQualificationTenantSettings } = await import("@/features/ai-qualification/tenant-settings-service");
    const { enqueueAndProcessMetaEventMessage } = await import("@/features/communication-channels/outbound-service");
    const { chooseFirstContact } = await import("@/features/qualification-turbo/service");
    const qualificationSettings = await getQualificationTenantSettings(input.tenantId);
    const botName = qualificationSettings?.assistantName?.trim() || "Assistente Âncora Saúde";
    // Approach by ad + A/B among approved templates; null keeps the configured FIRST_CONTACT.
    turboChoice = await chooseFirstContact({
      tenantId: input.tenantId,
      leadId: input.leadId,
      leadName: lead.nome || "Cliente",
      botName,
      lead: approachInput,
      firstQuestionAnswered: Boolean(startMemory.planType?.value) && (startMemory.planType?.value !== "empresarial" || Boolean(startMemory.companyHasCnpj?.value)),
    }).catch((error) => {
      console.warn("[startQualificationConversationForLead] turbo choice failed, using the configured first contact", error);
      return null;
    });
    const sendConfigured = () => enqueueAndProcessMetaEventMessage({
      tenantId: input.tenantId,
      recipientType: "lead",
      recipientId: input.leadId,
      destinationPhone: lead.telefone,
      purpose: "leadQualification",
      // The configured template keeps its own three variables, never the turbo ones.
      variables: [lead.nome || "Cliente", botName, "Âncora Saúde"],
      requestedBy: input.actorUserId,
      idempotencyKey: `qualification-engine:${input.leadId}:start:${conversation.id}`,
    });
    let delivery: Awaited<ReturnType<typeof sendConfigured>>;
    if (turboChoice?.templateName) {
      try {
        delivery = await enqueueAndProcessMetaEventMessage({
          tenantId: input.tenantId,
          recipientType: "lead",
          recipientId: input.leadId,
          destinationPhone: lead.telefone,
          purpose: "leadQualification",
          variables: turboChoice.variables,
          requestedBy: input.actorUserId,
          idempotencyKey: `qualification-engine:${input.leadId}:start:${conversation.id}:${turboChoice.templateName}`,
          requireApprovedMetaTemplate: true,
          templateName: turboChoice.templateName,
        });
        if (!["sent", "delivered", "read"].includes(delivery.status)) {
          // Held or queued by the outbox: cancel it before sending the configured one, so the
          // lead never gets two first messages. A row already being sent is left alone.
          const cancelled = ["failed", "skipped", "cancelled"].includes(delivery.status)
            ? [{ id: delivery.id }]
            : await db.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: new Date() })
              .where(and(eq(schema.whatsappOutboundMessages.id, delivery.id), eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"])))
              .returning({ id: schema.whatsappOutboundMessages.id });
          if (cancelled.length) throw new Error(delivery.providerErrorMessage || "turbo_template_not_sent");
        }
        sentTemplateName = turboChoice.templateName;
      } catch (turboError) {
        console.warn("[startQualificationConversationForLead] turbo template failed, falling back to the configured first contact", turboError);
        turboChoice = { ...turboChoice, templateName: null, variant: null };
        delivery = await sendConfigured();
      }
    } else {
      delivery = await sendConfigured();
    }
    if (!["sent", "delivered", "read"].includes(delivery.status)) {
      throw new Error(delivery.providerErrorMessage || "A mensagem inicial não foi aceita pelo provedor.");
    }
    finalMessageId = delivery.providerMessageId || finalMessageId;
    finalBody = delivery.renderedBody ?? delivery.fallbackRenderedBody ?? body;
    await db.insert(schema.whatsappMessages).values({
      id: finalMessageId,
      tenantId: input.tenantId,
      leadId: input.leadId,
      conversationId: conversation.id,
      communicationChannelId: delivery.channelId ?? undefined,
      senderRole: "assistant",
      provider: "meta",
      phone: lead.telefone,
      direction: "outbound",
      body: finalBody,
      providerStatus: "sent",
      messageId: delivery.providerMessageId ?? undefined,
      sentAt: new Date(),
    }).onConflictDoNothing();
  } catch (templateError) {
    console.warn("[startQualificationConversationForLead] configured first contact failed:", templateError);
    await handleInitialMessageFailure({
      tenantId: input.tenantId,
      leadId: input.leadId,
      conversationId: conversation.id,
      reason: "initial_message_dispatch_failed",
    });
    return { started: false as const, reason: "initial_message_failed" as const, error: "Falha no envio da mensagem inicial. Atendimento encerrado e lead enviado para a fila de distribuição." };
  }

  await db.update(schema.leads).set({ qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: new Date() }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));
  await db.update(schema.aiConversations).set({ status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", behaviorVersionId: behavior.versionId, memory: { ...startMemory, lastQuestionAsked: finalBody }, updatedAt: new Date() }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
  await persistQualificationEvaluation({ tenantId: input.tenantId, leadId: input.leadId, conversationId: conversation.id, actorUserId: input.actorUserId, policy: behavior.policy, memory: startMemory });
  // Records the first touch: the reminder cadence and the A/B results start from it.
  try {
    const { writeTurboState } = await import("@/features/qualification-turbo/service");
    const at = new Date().toISOString();
    await writeTurboState(input.tenantId, input.leadId, {
      approach: turboChoice?.approach ?? "direta",
      variant: turboChoice?.variant ?? "padrao",
      firstContactAt: at,
      touches: [{ touch: "t0", template: sentTemplateName, at, status: "sent" }],
      ...(seededForm.seeded.length ? { seededFromForm: seededForm.seeded } : {}),
    });
  } catch (error) {
    console.warn("[startQualificationConversationForLead] turbo state not recorded", error);
  }
  return { started: true as const, conversationId: conversation.id };
}

/**
 * The broker wrote to the customer from their own WhatsApp: an AI still asking (e.g. a
 * qualification resumed after the time limit) goes quiet, as when the team answers in the CRM.
 */
export async function pauseAiAfterBrokerMessage(input: { tenantId: string; leadId: string; brokerId: string }) {
  const [conversation] = await getDatabase().select({ id: schema.aiConversations.id, status: schema.aiConversations.status })
    .from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.tenantId, input.tenantId), eq(schema.aiConversations.leadId, input.leadId)))
    .limit(1);
  if (!conversation || !["AI_ACTIVE", "WAITING_CUSTOMER"].includes(conversation.status)) return;
  await transitionConversationState({
    tenantId: input.tenantId, conversationId: conversation.id, newStatus: "HUMAN_ACTIVE",
    reason: "O corretor respondeu pelo próprio WhatsApp; a IA parou.", assignedUserId: input.brokerId, pausedByUserId: input.brokerId,
  });
}

export async function transitionConversationState({
  tenantId,
  conversationId,
  newStatus,
  reason,
  assignedUserId,
  pausedByUserId,
}: {
  tenantId: string;
  conversationId: string;
  newStatus: ConversationStatus;
  reason?: string | null;
  assignedUserId?: string | null;
  pausedByUserId?: string | null;
}) {
  const db = getDatabase();

  const now = new Date();

  const updates: Record<string, unknown> = {
    status: newStatus,
    automationState: newStatus === "HUMAN_ACTIVE" ? "HUMAN_IN_PROGRESS" : newStatus === "WAITING_HUMAN" ? "WAITING_HUMAN" : newStatus === "CLOSED" ? "CLOSED" : newStatus === "PAUSED" ? "PAUSED" : "AI_ACTIVE",
    lastActivityAt: now,
    updatedAt: now,
    lockVersion: sql`${schema.aiConversations.lockVersion} + 1`,
  };

  if (reason !== undefined) updates.transferReason = reason;
  if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId;
  if (pausedByUserId !== undefined) updates.pausedByUserId = pausedByUserId;

  if (newStatus === "WAITING_HUMAN" || newStatus === "HUMAN_ACTIVE") {
    updates.transferredAt = now;
  } else if (newStatus === "CLOSED") {
    updates.closedAt = now;
  }

  await db
    .update(schema.aiConversations)
    .set(updates as unknown as Partial<typeof schema.aiConversations.$inferInsert>)
    .where(
      and(
        eq(schema.aiConversations.id, conversationId),
        eq(schema.aiConversations.tenantId, tenantId),
      ),
    );

  const [convLead] = await db
    .select({ leadId: schema.aiConversations.leadId })
    .from(schema.aiConversations)
    .where(
      and(
        eq(schema.aiConversations.id, conversationId),
        eq(schema.aiConversations.tenantId, tenantId)
      )
    )
    .limit(1);

  if (convLead?.leadId) {
    if (newStatus === "WAITING_HUMAN" || newStatus === "HUMAN_ACTIVE") {
      await db.update(schema.leads).set({
        qualificationStatus: sql`CASE WHEN ${schema.leads.qualificationStatus} IN ('qualifying', 'pending') THEN 'waiting_human' ELSE ${schema.leads.qualificationStatus} END`,
        status: "distributed",
        qualificationState: sql`CASE WHEN ${schema.leads.qualificationState} IN ('IN_PROGRESS', 'PENDING') THEN 'QUALIFIED' ELSE ${schema.leads.qualificationState} END`,
        qualificationCompletedAt: sql`COALESCE(${schema.leads.qualificationCompletedAt}, ${now})`,
        updatedAt: now,
      }).where(and(eq(schema.leads.id, convLead.leadId), eq(schema.leads.tenantId, tenantId)));
    } else if (newStatus === "CLOSED" || newStatus === "PAUSED") {
      // Closed or paused mid-qualification, without the client saying who they are: cold and held for the
      // requalification (PARTIAL + manual_hold), never a broker (plan "situações da conversa", step 1b, 18/10).
      // A lead already decided (held cold, queued warm, with a broker, disqualified) keeps its place: this used
      // to set every lead to "distributed/unassigned", undoing the timeout hold and the broker's in_contact.
      const stillQualifying = sql`${schema.leads.qualificationStatus} IN ('qualifying', 'pending') AND ${schema.leads.corretorId} IS NULL`;
      await db.update(schema.leads).set({
        qualificationStatus: sql`CASE WHEN ${stillQualifying} THEN 'cold' ELSE ${schema.leads.qualificationStatus} END`,
        qualificationState: sql`CASE WHEN ${stillQualifying} THEN 'PARTIAL' ELSE ${schema.leads.qualificationState} END`,
        status: sql`CASE WHEN ${stillQualifying} THEN 'new' ELSE ${schema.leads.status} END`,
        distributionStatus: sql`CASE WHEN ${stillQualifying} THEN 'manual_hold' ELSE ${schema.leads.distributionStatus} END`,
        // A held cold lead stays "not completed": the Requalificar panel only lists those
        // (cold-lead-requalification-policy.ts), and the timeout hold was vanishing from it here.
        qualificationCompletedAt: sql`CASE WHEN ${stillQualifying} OR (${schema.leads.qualificationState} = 'PARTIAL' AND ${schema.leads.distributionStatus} = 'manual_hold') THEN ${schema.leads.qualificationCompletedAt} ELSE COALESCE(${schema.leads.qualificationCompletedAt}, ${now}) END`,
        updatedAt: now,
      }).where(and(eq(schema.leads.id, convLead.leadId), eq(schema.leads.tenantId, tenantId)));
    }
  }
}

export function resolveQualifiedLeadType(memory: Pick<ConversationMemory, "planType" | "companyHasCnpj">): "PJ" | "PF" | undefined {
  if (memory.planType?.value === "empresarial" || memory.companyHasCnpj?.value === "true") return "PJ";
  if (memory.planType?.value === "individual" || memory.planType?.value === "familiar") return "PF";
  return undefined;
}

async function persistLeadFieldsFromQualification(input: {
  tenantId: string;
  leadId: string;
  memory: ConversationMemory;
  qualificationStatus?: "pending" | "qualified" | "hot" | "warm" | "cold";
}) {
  const db = getDatabase();
  const leadUpdates: Partial<typeof schema.leads.$inferInsert> = {};
  const rawName = input.memory.customerName?.value?.trim();
  if (rawName && !/^lead whatsapp/i.test(rawName)) leadUpdates.nome = rawName;
  const rawEmail = input.memory.email?.value?.trim().toLowerCase();
  if (rawEmail && rawEmail.includes("@")) leadUpdates.email = rawEmail;
  const leadType = resolveQualifiedLeadType(input.memory);
  if (leadType) leadUpdates.tipo = leadType;
  if (input.qualificationStatus) leadUpdates.qualificationStatus = input.qualificationStatus;
  if (!Object.keys(leadUpdates).length) return;

  await db.update(schema.leads).set({ ...leadUpdates, updatedAt: new Date() })
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));
}

async function completeDeterministicQualificationTurn(input: {
  tenantId: string;
  leadId: string;
  phone: string;
  conversationId: string;
  communicationChannelId?: string | null;
  transport: AiTransport;
  openWaSessionId?: string | null;
  wahaRunId?: string | null;
  sourceIdentifier?: string | null;
  memory: ConversationMemory;
  policy: Parameters<typeof persistQualificationEvaluation>[0]["policy"];
  turn: DeterministicQualificationTurn;
  /** The newest customer message the turn read (see the stale-reply check). */
  turnLatestInboundAt?: Date | null;
}) {
  const db = getDatabase();
  const now = new Date();
  const isHandoff = input.turn.kind === "handoff";
  // The closing goes out once: a message arriving while the lead is being
  // handed over must not send the same final text again.
  if (isHandoff) {
    const [sameClosing] = await db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, input.tenantId),
      eq(schema.whatsappMessages.leadId, input.leadId),
      eq(schema.whatsappMessages.senderRole, "assistant"),
      eq(schema.whatsappMessages.body, input.turn.reply),
    )).limit(1);
    if (sameClosing) {
      await transitionConversationState({ tenantId: input.tenantId, conversationId: input.conversationId, newStatus: "WAITING_HUMAN", reason: "Mensagem final já enviada." }).catch(() => undefined);
      return { status: "ignored_duplicate_closing", deliveryStatus: "skipped", reply: input.turn.reply };
    }
  }
  const memory = {
    ...input.memory,
    ...(input.turn.beneficiaryInvitation ? {
      relationAsked: true,
      beneficiaries: input.memory.beneficiaries?.length ? input.memory.beneficiaries : parseAgeValues(input.memory.age?.value).map((age) => ({ age, relation: null })),
    } : {}),
    // Only the question: a lateral answer or greeting before it ("O valor
    // depende da idade...") would make the next answer be read as an age.
    lastQuestionAsked: isHandoff ? undefined : pendingQuestionOf(input.turn.reply),
    // Every question of the reply, so a question asked before the last paragraph still counts (28/10).
    lastQuestionsAsked: isHandoff ? undefined : pendingQuestionsOf(input.turn.reply),
    updatedAt: now.toISOString(),
  };

  await db.update(schema.aiConversations).set({
    memory: memory as unknown as Record<string, unknown>,
    lastProcessedMessageId: input.sourceIdentifier ?? null,
    lastActivityAt: now,
    updatedAt: now,
  }).where(and(eq(schema.aiConversations.id, input.conversationId), eq(schema.aiConversations.tenantId, input.tenantId)));

  const persistedQualification = await persistQualificationEvaluation({
    tenantId: input.tenantId,
    leadId: input.leadId,
    conversationId: input.conversationId,
    actorUserId: null,
    policy: input.policy,
    memory,
  });
  await persistLeadFieldsFromQualification({
    tenantId: input.tenantId,
    leadId: input.leadId,
    memory,
    qualificationStatus: persistedQualification.qualificationStatus,
  });

  let distribution: Awaited<ReturnType<typeof import("@/features/lead-distribution/service").distributeQualifiedLead>> | null = null;
  if (!isHandoff) {
    await transitionConversationState({ tenantId: input.tenantId, conversationId: input.conversationId, newStatus: "WAITING_CUSTOMER" });
  }

  // The customer wrote again while this turn was thinking: this reply is
  // already out of date ("qual e-mail?" right after the e-mail). The newer
  // message's turn answers with everything; the data read here is kept.
  if (input.turnLatestInboundAt) {
    const [newer] = await db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, input.tenantId),
      eq(schema.whatsappMessages.leadId, input.leadId),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      gt(schema.whatsappMessages.sentAt, input.turnLatestInboundAt),
    )).limit(1);
    if (newer) {
      console.info("[qualification] reply_superseded_by_newer_message", { tenantId: input.tenantId, leadId: input.leadId });
      return { status: "superseded_by_newer_message", deliveryStatus: "skipped", reply: input.turn.reply };
    }
  }

  const messageId = `ai_msg_qualification_${crypto.randomUUID()}`;
  await db.insert(schema.whatsappMessages).values({
    id: messageId,
    tenantId: input.tenantId,
    leadId: input.leadId,
    communicationChannelId: input.communicationChannelId ?? null,
    conversationId: input.conversationId,
    senderRole: "assistant",
    provider: input.transport,
    phone: input.phone,
    direction: "outbound",
    body: input.turn.reply,
    sentAt: now,
  });

  let deliveryStatus = "failed";
  let providerMessageId: string | null = null;
  try {
    const sent = await sendAiOutbound({
      tenantId: input.tenantId,
      leadId: input.leadId,
      phone: input.phone,
      body: input.turn.reply,
      transport: input.transport,
      openWaSessionId: input.openWaSessionId,
      wahaRunId: input.wahaRunId,
      currentMessageId: messageId,
    });
    if (sent.status === "sent") {
      deliveryStatus = "sent";
      providerMessageId = sent.messageId ?? null;
      await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId ?? undefined })
        .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
    }
  } catch (error) {
    await db.update(schema.whatsappMessages).set({ providerStatus: "failed" })
      .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
    console.error("[qualification] deterministic_outbound_failed", { tenantId: input.tenantId, leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
  }

  // The final message is a delivery contract: only a provider-confirmed send
  // may close automation and put the conversation in the human queue.
  if (isHandoff && isConfirmedClosingDelivery(deliveryStatus, providerMessageId)) {
    // From now on a new customer message is a correction for the broker, not a
    // new turn: the distribution below can take a while.
    await transitionConversationState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      newStatus: "WAITING_HUMAN",
      reason: "Mensagem final entregue; qualificação concluída e atendimento encaminhado.",
    });
    const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
    distribution = await distributeQualifiedLead({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: null });
    const { executeDeterministicClosing } = await import("@/features/ai-qualification/closing-state-service");
    await executeDeterministicClosing(
      input.tenantId,
      input.conversationId,
      input.leadId,
      memory.customerName?.value,
      providerMessageId,
    );
  }

  // Alta aptidão (type, lives and ages give the quote) goes to the broker now, while the AI keeps
  // collecting the rest (DEC-153). After the reply, so the customer is not kept waiting.
  if (!isHandoff && persistedQualification.qualificationStatus === "hot" && persistedQualification.state === "IN_PROGRESS") {
    const { isHotLeadEarlyDistributionEnabled } = await import("@/features/lead-distribution/qualification-hold");
    if (await isHotLeadEarlyDistributionEnabled()) {
      const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
      distribution = await distributeQualifiedLead({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: null })
        .catch((error) => {
          console.error("[qualification] early_hot_distribution_failed", { tenantId: input.tenantId, leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
          return null;
        });
    }
  }

  await db.insert(schema.aiAttendanceLogs).values({
    id: `log_qualification_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    provider: "deterministic_qualification",
    modelUsed: "qualification_rules_v1",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: "0",
    latencyMs: 0,
    status: deliveryStatus === "sent" ? "success" : "delivery_failed",
    sourceMessageId: input.sourceIdentifier ?? null,
  }).onConflictDoNothing().catch((error) => console.warn("[qualification] attendance_log_failed", { conversationId: input.conversationId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" }));

  console.info("[qualification] deterministic_turn_completed", {
    tenantId: input.tenantId,
    leadId: input.leadId,
    conversationId: input.conversationId,
    state: persistedQualification.state,
    classification: persistedQualification.classification,
    mode: input.turn.kind,
    deliveryStatus,
    distribution: distribution?.distributed ? "assigned" : distribution?.assignedResult?.status ?? distribution?.reason ?? null,
  });

  return {
    status: isHandoff && !isConfirmedClosingDelivery(deliveryStatus, providerMessageId) ? "handoff_delivery_failed" : isHandoff ? "transferred_to_human" : "replied",
    deliveryStatus,
    reply: input.turn.reply,
  };
}

/**
 * After the handoff the AI stays quiet, except when the customer corrects what
 * was registered ("Não, 12anos e 42 anos, 2 vidas"): the lead is updated, the
 * broker gets a note, and the customer is told once what was corrected.
 */
async function applyCustomerCorrectionAfterHandoff(input: {
  tenantId: string;
  leadId: string;
  conversationId: string;
  lockVersion: number;
  sourceMessageId?: string | null;
  phone: string;
  transport: AiTransport;
  openWaSessionId?: string | null;
  wahaRunId?: string | null;
  memory: ConversationMemory;
  message: string;
  policy: Parameters<typeof persistQualificationEvaluation>[0]["policy"];
}): Promise<false | "applied" | "stale"> {
  const corrections = detectQualificationCorrections(input.memory, input.message);
  if (!corrections.length) return false;
  const db = getDatabase();
  const { memory, beneficiaryCapture } = applyQualificationCorrectionsToMemory({
    memory: input.memory,
    corrections,
    message: input.message,
    sourceMessageId: input.sourceMessageId,
  });
  const now = new Date();
  const [claimed] = await db.update(schema.aiConversations).set({
    memory: memory as unknown as Record<string, unknown>,
    lastProcessedMessageId: input.sourceMessageId ?? undefined,
    lockVersion: sql`${schema.aiConversations.lockVersion} + 1`,
    lastActivityAt: now,
    updatedAt: now,
  }).where(and(
    eq(schema.aiConversations.id, input.conversationId),
    eq(schema.aiConversations.tenantId, input.tenantId),
    eq(schema.aiConversations.lockVersion, input.lockVersion),
  )).returning({ id: schema.aiConversations.id });
  if (!claimed) return "stale";
  await persistQualificationEvaluation({ tenantId: input.tenantId, leadId: input.leadId, conversationId: input.conversationId, actorUserId: null, policy: input.policy, memory });
  const correctionSummary = describeQualificationCorrections(corrections);
  const relationshipSummary = beneficiaryCapture?.status === "mapped" ? summarizeQualification(memory, ["age"]) : null;
  const summary = [correctionSummary, relationshipSummary].filter(Boolean).join("; ");
  const systemUserId = await resolveSystemUserId(input.tenantId);
  await db.insert(schema.leadInteractions).values({
    id: randomUUID(), leadId: input.leadId, userId: systemUserId, tipo: "note",
    conteudo: `📝 O cliente corrigiu os dados depois da qualificação: ${summary}. Mensagem: "${input.message.replace(/\s+/g, " ").slice(0, 200)}"`,
  });
  const [lead] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (lead?.corretorId) {
    await publishNotification({ capability: "quick_reply_human", tenantId: input.tenantId, recipientUserId: lead.corretorId, leadId: input.leadId, type: "quick_reply_human", title: "Cliente corrigiu os dados", message: summary, pushTitle: "Dados do lead corrigidos", pushBody: summary, url: `/leads/${input.leadId}`, tag: `lead-correction-${input.leadId}` }).catch(() => undefined);
  }
  const firstName = memory.customerFirstName?.value ? `, ${memory.customerFirstName.value}` : "";
  const reply = `Obrigado por corrigir${firstName}! Anotei: ${summary}. Já avisei o corretor, que segue a conversa por aqui.`;
  await db.insert(schema.whatsappMessages).values({
    id: `ai_msg_correction_${crypto.randomUUID()}`, tenantId: input.tenantId, leadId: input.leadId, conversationId: input.conversationId,
    senderRole: "assistant", provider: input.transport, phone: input.phone, direction: "outbound", body: reply, sentAt: new Date(),
  });
  await sendAiOutbound({ tenantId: input.tenantId, leadId: input.leadId, phone: input.phone, body: reply, transport: input.transport, openWaSessionId: input.openWaSessionId, wahaRunId: input.wahaRunId })
    .catch((error) => console.error("[ai-wpp] correction_reply_failed", { tenantId: input.tenantId, leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  return "applied";
}

async function captureOptionalBeneficiaryReply(input: {
  tenantId: string;
  leadId: string;
  conversationId: string;
  lockVersion: number;
  memory: ConversationMemory;
  message: string;
  sourceMessageId?: string | null;
}): Promise<false | "captured" | "stale"> {
  if (!input.memory.relationAsked) return false;
  const ages = parseAgeValues(input.memory.age?.value);
  if (ages.length < 2 || input.memory.planType?.value === "empresarial") return false;
  const captured = captureBeneficiaryRelations({
    message: input.message,
    ages,
    planType: input.memory.planType?.value,
    sourceMessageId: input.sourceMessageId,
    relationAsked: true,
  });
  if (captured.status === "unrecognized") return false;

  const memory: ConversationMemory = {
    ...input.memory,
    beneficiaries: captured.beneficiaries,
    relationAsked: true,
    ...(captured.raw ? { beneficiaryRaw: captured.raw.slice(0, 2000) } : { beneficiaryRaw: undefined }),
  };
  const db = getDatabase();
  const now = new Date();
  const [claimed] = await db.update(schema.aiConversations).set({
    memory: memory as unknown as Record<string, unknown>,
    lastProcessedMessageId: input.sourceMessageId ?? undefined,
    lockVersion: sql`${schema.aiConversations.lockVersion} + 1`,
    lastActivityAt: now,
    updatedAt: now,
  }).where(and(
    eq(schema.aiConversations.id, input.conversationId),
    eq(schema.aiConversations.tenantId, input.tenantId),
    eq(schema.aiConversations.lockVersion, input.lockVersion),
  )).returning({ id: schema.aiConversations.id });
  if (!claimed) return "stale";

  const [lead] = await db.select({ qualificationDetails: schema.leads.qualificationDetails })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);
  const details = lead?.qualificationDetails && typeof lead.qualificationDetails === "object" && !Array.isArray(lead.qualificationDetails)
    ? lead.qualificationDetails as Record<string, unknown>
    : {};
  await db.update(schema.leads).set({
    qualificationDetails: {
      ...details,
      resumoAtendimento: summarizeQualification(memory) || details.resumoAtendimento || null,
      beneficiarios: captured.beneficiaries.map((beneficiary) => ({
        idade: beneficiary.age,
        parentesco: beneficiary.relation,
        texto: beneficiary.relationText ?? memory.beneficiaryRaw ?? null,
      })),
      beneficiaryRaw: memory.beneficiaryRaw ?? null,
    },
    updatedAt: now,
  }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

  const systemUserId = await resolveSystemUserId(input.tenantId);
  await db.insert(schema.leadInteractions).values({
    id: randomUUID(),
    leadId: input.leadId,
    userId: systemUserId,
    tipo: "note",
    conteudo: `Parentescos opcionais informados na qualificação automática: ${captured.status}.`,
  }).catch((error) => console.warn("[qualification] beneficiary_relation_audit_failed", { leadId: input.leadId, error }));
  return "captured";
}

/** Seconds the AI waits for the rest of a burst of customer messages before answering. */
const DEFAULT_AI_DEBOUNCE_SECONDS = 8;

/** One recovery attempt per conversation; the next refusal closes politely. */
const MAX_OBJECTION_RECOVERIES = 1;
const OBJECTION_RECOVERY_RULE = "objection_recovery";
const DECLINE_AFTER_OBJECTION_RULE = "decline_after_objection";
/** How long a conversation closed after an objection can be reopened by the customer. */
const REOPEN_AFTER_DECLINE_MS = 14 * 24 * 60 * 60_000;

/** Used when the interpreter is unavailable: still asks why instead of closing. */
export function defaultObjectionReply(firstName: string) {
  return `Entendi${firstName ? `, ${firstName}` : ""}, obrigado por avisar. Se você já tem plano, eu comparo com o atual, e se for pra outra pessoa da família também cotamos. Posso perguntar o que pesou?`;
}

/**
 * A conversation closed after an objection reopens when the customer writes
 * again with anything but another refusal or an explicit stop. Explicit stops
 * ("sair", "não me mande mais") never reopen.
 */
async function reopenAfterSoftDecline(input: {
  tenantId: string;
  leadId: string;
  conversation: { id: string; optOutAt: Date | null };
  body: string;
}) {
  if (!input.conversation.optOutAt || Date.now() - input.conversation.optOutAt.getTime() > REOPEN_AFTER_DECLINE_MS) return false;
  if (parseExplicitStop(input.body) || parseOptOut(input.body) || input.body.trim().length < 3) return false;
  const db = getDatabase();
  const [lastEvent] = await db.select({ ruleKey: schema.aiQuickReplyEvents.ruleKey })
    .from(schema.aiQuickReplyEvents)
    .where(and(eq(schema.aiQuickReplyEvents.tenantId, input.tenantId), eq(schema.aiQuickReplyEvents.conversationId, input.conversation.id)))
    .orderBy(desc(schema.aiQuickReplyEvents.createdAt))
    .limit(1);
  if (lastEvent?.ruleKey !== DECLINE_AFTER_OBJECTION_RULE) return false;
  const [lead] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead || lead.corretorId) return false;
  const now = new Date();
  await db.update(schema.aiConversations).set({ status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: null, updatedAt: now })
    .where(and(eq(schema.aiConversations.id, input.conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
  await db.update(schema.leads).set({ qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", distributionStatus: "unassigned", updatedAt: now })
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), isNull(schema.leads.corretorId), eq(schema.leads.qualificationStatus, "disqualified")));
  await db.insert(schema.aiQuickReplyEvents).values({
    id: crypto.randomUUID(), tenantId: input.tenantId, conversationId: input.conversation.id, leadId: input.leadId, sourceMessageId: null,
    intent: "GREETING", ruleKey: "reopened_after_decline", templateKey: null, outcome: "reopened", estimatedTokensSaved: 0, notifiedUserId: null,
  });
  console.info("[qualification] reopened_after_decline", { tenantId: input.tenantId, leadId: input.leadId, conversationId: input.conversation.id });
  return true;
}

/**
 * The lead went to a broker by the time limit with the qualification unfinished (PARTIAL) and
 * the customer answered afterwards: the AI finishes the flow while the broker has not written
 * yet (28/10). The broker keeps the lead; the end of the flow names them (distributedHandoffText).
 */
async function reopenDistributedQualification(input: {
  tenantId: string;
  leadId: string;
  conversation: { id: string; status: string };
}) {
  if (input.conversation.status !== "CLOSED") return false;
  const db = getDatabase();
  const [lead] = await db.select({
    corretorId: schema.leads.corretorId,
    qualificationState: schema.leads.qualificationState,
    status: schema.leads.status,
    assignedAt: schema.leads.assignedAt,
  }).from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead?.corretorId || lead.qualificationState !== "PARTIAL") return false;
  // The broker's own messages (sent from the CRM or the phone) carry no bot role.
  const [brokerMessages] = await db.select({ total: count() }).from(schema.whatsappMessages).where(and(
    eq(schema.whatsappMessages.tenantId, input.tenantId),
    eq(schema.whatsappMessages.leadId, input.leadId),
    inArray(schema.whatsappMessages.direction, ["outgoing", "outbound"]),
    or(isNull(schema.whatsappMessages.senderRole), notInArray(schema.whatsappMessages.senderRole, ["assistant", "system", "agent"])),
    lead.assignedAt ? gt(schema.whatsappMessages.sentAt, lead.assignedAt) : undefined,
  ));
  if (!canResumeDistributedQualification({
    conversationStatus: input.conversation.status,
    corretorId: lead.corretorId,
    qualificationState: lead.qualificationState,
    leadStatus: lead.status,
    brokerMessagesSinceAssignment: Number(brokerMessages?.total ?? 0),
  })) return false;
  const now = new Date();
  await db.update(schema.aiConversations).set({ status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", updatedAt: now })
    .where(and(eq(schema.aiConversations.id, input.conversation.id), eq(schema.aiConversations.tenantId, input.tenantId), eq(schema.aiConversations.status, "CLOSED")));
  await db.insert(schema.aiQuickReplyEvents).values({
    id: crypto.randomUUID(), tenantId: input.tenantId, conversationId: input.conversation.id, leadId: input.leadId, sourceMessageId: null,
    intent: "GREETING", ruleKey: "reopened_after_distribution", templateKey: null, outcome: "reopened", estimatedTokensSaved: 0, notifiedUserId: null,
  });
  console.info("[qualification] reopened_after_distribution", { tenantId: input.tenantId, leadId: input.leadId, conversationId: input.conversation.id });
  return true;
}

/**
 * Handoff text for this moment. The tenant's own text wins (D1). Outside working hours the night
 * text replaces only the default one; a tenant text without time gets the return sentence after it.
 */
function handoffBodyFor(configured: string | null | undefined, defaultText: string, afterHoursDefault: string) {
  const text = effectiveHandoffText(configured, defaultText);
  return isAfterHoursInSaoPaulo() ? afterHoursText(text, defaultText, afterHoursDefault) : text;
}

export async function processInboundAiResponse({
  tenantId,
  leadId,
  phone,
  userMessageBody,
  messageKind = "text",
  communicationChannelId,
  providerMessageId,
  whatsappMessageId,
  transport = "meta",
  openWaSessionId,
  wahaRunId,
  skipDebounce = false,
  correctionOnly = false,
}: {
  tenantId: string;
  leadId: string;
  phone: string;
  userMessageBody: string;
  messageKind?: QuickReplyMessageKind;
  communicationChannelId?: string | null;
  providerMessageId?: string | null;
  whatsappMessageId?: string | null;
  transport?: AiTransport;
  openWaSessionId?: string | null;
  wahaRunId?: string | null;
  skipDebounce?: boolean;
  /** A qualified lead's message: only a correction while waiting for the broker is handled. */
  correctionOnly?: boolean;
}) {
  const db = getDatabase();
  // Media messages arrive without a text body. Give the qualification engine
  // an explicit, truthful context marker so it can acknowledge the upload and
  // continue with the next missing field instead of repeating the question
  // that preceded the attachment. The file contents are never guessed here.
  const inboundPlaceholderKind = userMessageBody.trim().match(/^\[(image|document|audio|video|sticker)\]$/i)?.[1]?.toLowerCase();
  const effectiveMessageKind = (messageKind === "text" && inboundPlaceholderKind ? inboundPlaceholderKind : messageKind) as QuickReplyMessageKind;
  let normalizedInboundMessage = (userMessageBody.trim() && !inboundPlaceholderKind ? userMessageBody.trim() : undefined) || (
    effectiveMessageKind === "image"
      ? "O cliente enviou uma imagem para análise (possivelmente uma carteirinha)."
      : effectiveMessageKind === "document"
        ? "O cliente enviou um documento para análise."
        : effectiveMessageKind === "audio"
          ? "O cliente enviou um áudio."
          : effectiveMessageKind === "video"
            ? "O cliente enviou um vídeo."
            : effectiveMessageKind === "sticker"
              ? "O cliente enviou uma figurinha."
              : "O cliente enviou uma mensagem sem texto."
  );

  console.info("[ai-wpp] inbound.received", {
    tenantId,
    leadId,
    messageLength: normalizedInboundMessage.length,
    messageKind: effectiveMessageKind,
    providerMessageId,
  });

  // 1. Obter ou criar conversa
  const conversation = await getOrCreateAiConversation({
    tenantId,
    leadId,
    communicationChannelId,
  });

  const nowReceived = new Date();
  await db
    .update(schema.aiConversations)
    .set({ lastActivityAt: nowReceived, updatedAt: nowReceived })
    .where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, tenantId)));

  // 1b. Debounce Buffer Window: aggregate rapid multi-message bursts into a single consolidated turn.
  // People write in bursts ("Para 12 , 42 anos" then "Meu"): the AI waits a
  // few seconds and answers the burst once (default 8s; "0" turns it off).
  if (!skipDebounce && process.env.NODE_ENV !== "test") {
    const { getSystemSetting } = await import("@/features/system-settings/queries");
    const debounceSetting = await getSystemSetting("ai_debounce_delay_seconds");
    const debounceSeconds = debounceSetting !== null && debounceSetting !== undefined ? parseInt(debounceSetting, 10) : DEFAULT_AI_DEBOUNCE_SECONDS;
    const debounceMs = isNaN(debounceSeconds) || debounceSeconds <= 0 ? 0 : Math.min(15_000, debounceSeconds * 1000);

    if (debounceMs > 0) {
      // Newer than this message as the customer sent it (the provider time), not the server clock.
      const [ownMessage] = providerMessageId || whatsappMessageId
        ? await db.select({ sentAt: schema.whatsappMessages.sentAt }).from(schema.whatsappMessages)
          .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.messageId, (providerMessageId || whatsappMessageId)!))).limit(1)
        : [];
      const receivedAt = ownMessage?.sentAt ?? nowReceived;
      await new Promise((resolve) => setTimeout(resolve, debounceMs));

      const last8DigitsPhone = phone.replace(/\D/g, "").slice(-8);
      const [newerIncoming] = await db
        .select({ id: schema.whatsappMessages.id })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, tenantId),
            or(
              eq(schema.whatsappMessages.leadId, leadId),
              eq(schema.whatsappMessages.conversationId, conversation.id),
              sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${last8DigitsPhone}`
            ),
            or(
              eq(schema.whatsappMessages.direction, "incoming"),
              eq(schema.whatsappMessages.direction, "inbound")
            ),
            gt(schema.whatsappMessages.sentAt, receivedAt)
          )
        )
        .limit(1);

      if (newerIncoming) {
        console.info("[ai-wpp] inbound.debounced_superceded", {
          tenantId,
          leadId,
          receivedAt: nowReceived.toISOString(),
        });
        return { status: "debounced_superceded" as const };
      }

      // This is the last message of the burst: the turn reads the whole burst.
      const [lastReply] = await db.select({ sentAt: schema.whatsappMessages.sentAt }).from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId), inArray(schema.whatsappMessages.direction, ["outbound", "outgoing"])))
        .orderBy(desc(schema.whatsappMessages.sentAt)).limit(1);
      const burst = await db.select({ body: schema.whatsappMessages.body }).from(schema.whatsappMessages)
        .where(and(
          eq(schema.whatsappMessages.tenantId, tenantId),
          eq(schema.whatsappMessages.leadId, leadId),
          inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
          lastReply?.sentAt ? gt(schema.whatsappMessages.sentAt, lastReply.sentAt) : undefined,
        ))
        .orderBy(schema.whatsappMessages.sentAt).limit(10);
      const burstText = burst.map((message) => message.body?.trim() ?? "").filter((body) => body && !/^\[(image|document|audio|video|sticker)\]$/i.test(body));
      if (burstText.length > 1) {
        normalizedInboundMessage = burstText.join("\n");
        userMessageBody = normalizedInboundMessage;
      }
    }
  }

  if (correctionOnly && conversation.status !== "WAITING_HUMAN") return { status: "ignored_after_qualification" as const };

  const behavior = await resolvePublishedAgentBehavior(tenantId, conversation.behaviorVersionId);
  if (!conversation.behaviorVersionId && behavior.versionId) {
    await db.update(schema.aiConversations).set({ behaviorVersionId: behavior.versionId, updatedAt: new Date() })
      .where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, tenantId)));
  }

  const sourceIdentifier = providerMessageId || whatsappMessageId;
  if (sourceIdentifier) {
    await db.update(schema.whatsappMessages)
      .set({ conversationId: conversation.id })
      .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.messageId, sourceIdentifier)));
  }

  // 2. Quick Reply idempotency and closed-state gate run before AI.
  if (conversation.status === "PAUSED") {
    // Closed after an objection (not an explicit stop): the customer writing again with
    // anything but another refusal reopens the qualification (case Adelair, 21/10).
    const reopened = await reopenAfterSoftDecline({ tenantId, leadId, conversation, body: userMessageBody });
    if (!reopened) return { status: "ignored_PAUSED" };
    return processInboundAiResponse({ tenantId, leadId, phone, userMessageBody, messageKind, communicationChannelId, providerMessageId, whatsappMessageId, transport, openWaSessionId, wahaRunId, skipDebounce: true, correctionOnly });
  }
  if (sourceIdentifier) {
    const [quickReplyEvent] = await db.select({ id: schema.aiQuickReplyEvents.id }).from(schema.aiQuickReplyEvents).where(and(eq(schema.aiQuickReplyEvents.tenantId, tenantId), eq(schema.aiQuickReplyEvents.sourceMessageId, sourceIdentifier), eq(schema.aiQuickReplyEvents.conversationId, conversation.id))).limit(1);
    if (quickReplyEvent || conversation.lastProcessedMessageId === sourceIdentifier) return { status: "ignored_duplicate" };
  }

  // 2. Verificar se a IA pode responder
  if (conversation.status === "HUMAN_ACTIVE") {
    console.log(`[ai-agent] Conversa ${conversation.id} está em HUMAN_ACTIVE. Atendimento assumido por humano. IA em silêncio.`);
    return { status: "ignored_human_active" };
  }

  // Distributed by the time limit with the flow unfinished: the customer's answer resumes it.
  if (conversation.status === "CLOSED" && await reopenDistributedQualification({ tenantId, leadId, conversation })) {
    return processInboundAiResponse({ tenantId, leadId, phone, userMessageBody, messageKind, communicationChannelId, providerMessageId, whatsappMessageId, transport, openWaSessionId, wahaRunId, skipDebounce: true, correctionOnly });
  }

  if (conversation.status === "CLOSED" || conversation.status === "FAILED") {
    const capturedRelation = await captureOptionalBeneficiaryReply({
      tenantId, leadId, conversationId: conversation.id, lockVersion: conversation.lockVersion,
      memory: (conversation.memory as ConversationMemory | null) ?? createEmptyMemory(),
      message: normalizedInboundMessage, sourceMessageId: sourceIdentifier,
    });
    if (capturedRelation === "captured") return { status: "beneficiary_relation_captured" };
    if (capturedRelation === "stale") return { status: "ignored_duplicate" };
    console.log(`[ai-agent] Conversa ${conversation.id} está ${conversation.status}. IA não responde.`);
    const postClosingResult = await handlePostClosingInboundMessage(tenantId, conversation.id);
    if (postClosingResult.noticeSent && postClosingResult.messageText) {
      const delivery = await sendAiOutbound({
        tenantId,
        leadId,
        phone,
        body: postClosingResult.messageText,
        transport,
        openWaSessionId,
        wahaRunId,
      }).catch((error) => {
        console.warn("[ai-agent] post-closing notice delivery failed", {
          reason: error instanceof Error && "code" in error ? String((error as Error & { code?: unknown }).code) : "delivery_failed",
        });
        return null;
      });
      if (delivery?.status === "blocked_source_channel") {
        return { status: "blocked_post_closing_notice", reason: delivery.reason };
      }
      return { status: delivery?.status === "sent" ? "sent_post_closing_notice" : "post_closing_notice_not_sent" };
    }
    return { status: `ignored_${conversation.status}` };
  }

  // 3. Idempotency — skip if this message was already processed
  if (sourceIdentifier) {
    const [existingLog] = await db
      .select({ id: schema.aiAttendanceLogs.id })
      .from(schema.aiAttendanceLogs)
      .where(
        and(
          eq(schema.aiAttendanceLogs.tenantId, tenantId),
          eq(schema.aiAttendanceLogs.sourceMessageId, sourceIdentifier),
          eq(schema.aiAttendanceLogs.conversationId, conversation.id),
        ),
      )
      .limit(1);

    if (existingLog) {
      console.log(`[ai-agent] Mensagem ${sourceIdentifier} já processada. Ignorando duplicata.`);
      return { status: "ignored_duplicate" };
    }
  }

  // 4. Optimistic lock — claim this conversation using lockVersion
  if (conversation.status === "WAITING_HUMAN") {
    const correction = await applyCustomerCorrectionAfterHandoff({
      tenantId, leadId, conversationId: conversation.id, phone, transport, openWaSessionId, wahaRunId,
      lockVersion: conversation.lockVersion, sourceMessageId: sourceIdentifier,
      memory: (conversation.memory as ConversationMemory | null) ?? createEmptyMemory(),
      message: normalizedInboundMessage,
      policy: behavior.policy,
    });
    if (correction === "applied") return { status: "correction_applied" as const };
    if (correction === "stale") return { status: "ignored_duplicate" as const };
    const capturedRelation = await captureOptionalBeneficiaryReply({
      tenantId, leadId, conversationId: conversation.id, lockVersion: conversation.lockVersion,
      memory: (conversation.memory as ConversationMemory | null) ?? createEmptyMemory(),
      message: normalizedInboundMessage, sourceMessageId: sourceIdentifier,
    });
    if (capturedRelation === "captured") return { status: "beneficiary_relation_captured" };
    if (capturedRelation === "stale") return { status: "ignored_duplicate" as const };
    console.info("[ai-wpp] inbound_ignored_waiting_human", { tenantId, leadId, conversationId: conversation.id });
    return { status: "ignored_waiting_human" };
  }

  const [claimed] = await db
    .update(schema.aiConversations)
    .set({
      status: conversation.status === "HUMAN_ACTIVE" ? "HUMAN_ACTIVE" : "AI_ACTIVE",
      lockVersion: sql`${schema.aiConversations.lockVersion} + 1`,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.aiConversations.id, conversation.id),
        eq(schema.aiConversations.tenantId, tenantId),
        eq(schema.aiConversations.lockVersion, conversation.lockVersion),
      ),
    )
    .returning({ id: schema.aiConversations.id });

  if (!claimed) {
    console.warn(`[ai-agent] Concorrência na conversa ${conversation.id}. lockVersion mudou — outro processo já está processando.`);
    return { status: "skipped_concurrent" };
  }
  // The newest customer message this turn reads: a reply is not sent when a
  // newer one arrives meanwhile (its own turn answers with everything).
  const [turnInbound] = await db.select({ latest: sql<Date | null>`max(${schema.whatsappMessages.sentAt})` }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId), inArray(schema.whatsappMessages.direction, ["incoming", "inbound"])));
  const turnLatestInboundAt = turnInbound?.latest ? new Date(turnInbound.latest) : null;

  // 5. Buscar histórico de mensagens recentes do lead
  const pastMessages = await db
    .select({
      messageId: schema.whatsappMessages.messageId,
      body: schema.whatsappMessages.body,
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      sentAt: schema.whatsappMessages.sentAt,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, tenantId),
        eq(schema.whatsappMessages.leadId, leadId),
        eq(schema.whatsappMessages.conversationId, conversation.id),
      ),
    )
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(10);

  const formattedHistory = pastMessages.reverse().map((m) => ({
    role: (m.senderRole === "assistant" || m.direction === "outbound" ? "assistant" : "user") as "user" | "assistant",
    content: m.body,
  }));
  const historyAlreadyContainsCurrentMessage = Boolean(sourceIdentifier) && pastMessages.some((message) => message.messageId === sourceIdentifier);

  // 5. Quick Reply gate: deterministic, tenant-template based, and before AI.
  // Reset de memória geral: se ai_memory_reset_mode === "before_each_message", o agente
  // responde do zero a cada mensagem (memória zerada + apenas a mensagem atual no contexto).
  const memoryResetMode = (await getSystemSetting("ai_memory_reset_mode")) ?? "before_each_session";
  const { baseMemory: currentMemory, aiMessages } = resolveMemoryResetContext({
    resetMode: memoryResetMode,
    storedMemory: conversation.memory as ConversationMemory | null,
    formattedHistory,
    currentMessage: normalizedInboundMessage,
    historyAlreadyContainsCurrentMessage,
  });
  const hasPriorMessages = pastMessages.some((message) => !sourceIdentifier || message.messageId !== sourceIdentifier);
  const automationState: ConversationAutomationState = conversation.status === "HUMAN_ACTIVE" ? "HUMAN_IN_PROGRESS" : conversation.status === "WAITING_HUMAN" ? "WAITING_HUMAN" : "AI_ACTIVE";
  const quickReplyEnabled = (await getSystemSetting(FEATURE_FLAGS.AI_QUICK_REPLY.key)) !== "false";

  // Carregar configuração de cooldown do tenant (configurável pelo diretor em /agentes-ia)
  const tenantQrConfig = quickReplyEnabled
    ? await db
        .select({
          quickReplyCooldownMinutes: schema.aiQualificationConfigs.quickReplyCooldownMinutes,
          quickReplyWaitWindowMinutes: schema.aiQualificationConfigs.quickReplyWaitWindowMinutes,
          quickReplyWaitLimitCount: schema.aiQualificationConfigs.quickReplyWaitLimitCount,
        })
        .from(schema.aiQualificationConfigs)
        .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  const cooldownConfig = tenantQrConfig
    ? {
        cooldownMinutes: tenantQrConfig.quickReplyCooldownMinutes ?? 10,
        waitWindowMinutes: tenantQrConfig.quickReplyWaitWindowMinutes ?? 30,
        waitLimitCount: tenantQrConfig.quickReplyWaitLimitCount ?? 2,
      }
    : undefined;

  // Phrases the tenant taught and its own situations (Atendimento → Situações).
  const tenantSituations = await loadTenantSituations(tenantId);
  const resolvedQuickReply = quickReplyEnabled ? resolveQuickReply({
    ...quickReplyTuning(tenantSituations),
    body: userMessageBody,
    messageKind: effectiveMessageKind,
    conversationState: automationState,
    isNewConversation: conversation.status === "NEW" && !hasPriorMessages,
    hasPriorMessages,
    hasPendingQuestion: Boolean(currentMemory.lastQuestionAsked),
    cooldown: { lastTemplateKey: conversation.quickReplyLastTemplate, lastSentAt: conversation.quickReplyLastSentAt, waitWindowStartedAt: conversation.quickReplyWaitWindowStartedAt, waitResponseCount: conversation.quickReplyWaitResponseCount },
    cooldownConfig,
  }) : { resolved: false as const, intent: null, ruleKey: null, templateKey: null, notifyHuman: false };
  const quickReply = shouldContinueQualificationAfterMedia({
    messageKind: effectiveMessageKind,
    hasPendingQuestion: Boolean(currentMemory.lastQuestionAsked),
    conversationState: automationState,
  }) && resolvedQuickReply.intent === "MEDIA_RECEIVED"
    ? { resolved: false as const, intent: null, ruleKey: null, templateKey: null, notifyHuman: false }
    : resolvedQuickReply;
  if (quickReply.resolved) {
    const templates = await loadQuickReplyTemplates(tenantId);
    const rawTemplate = quickReply.templateKey ? templates[quickReply.templateKey] : undefined;
    const [leadForTemplate] = await db.select({ nome: schema.leads.nome }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
    // {{nome}} and {{resumo}}: never ask again what the customer already told.
    // At night the "talk to a person" reply promises the first available broker, not "em instantes".
    const nightBody = rawTemplate && quickReply.templateKey === "human.requested" && isAfterHoursInSaoPaulo() ? afterHoursText(rawTemplate.body, DEFAULT_HUMAN_REQUEST_TEXT, AFTER_HOURS_HUMAN_REQUEST_TEXT) : rawTemplate?.body;
    const template = rawTemplate ? { ...rawTemplate, body: renderConversationVariables(nightBody ?? rawTemplate.body, currentMemory, leadForTemplate?.nome) } : undefined;
    const now = new Date();
    const suppressed = Boolean(quickReply.suppressReason);
    let deliveryStatus = suppressed ? "suppressed_cooldown" : "disabled_template";
    let messageId: string | null = null;
    if (!suppressed && template?.active) {
      messageId = `quick_reply_${crypto.randomUUID()}`;
      await db.insert(schema.whatsappMessages).values({ id: messageId, tenantId, leadId, communicationChannelId: communicationChannelId ?? null, conversationId: conversation.id, senderRole: "assistant", provider: transport, phone, direction: "outbound", body: template.body, sentAt: now });
      try {
        const sent = await sendAiOutbound({ tenantId, leadId, phone, body: template.body, transport, openWaSessionId, wahaRunId, currentMessageId: messageId });
        deliveryStatus = sent.status;
        if (sent.messageId) await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      } catch (error) {
        deliveryStatus = "failed";
        await db.update(schema.whatsappMessages).set({ providerStatus: "failed" }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
        console.error("[quick-reply] outbound.failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
      }
    }
    const [leadOwner] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
    let notifiedUserId: string | null = null;
    if (quickReply.notifyHuman && leadOwner?.corretorId) {
      notifiedUserId = leadOwner.corretorId;
      await publishNotification({ capability: "quick_reply_human", tenantId, recipientUserId: leadOwner.corretorId, leadId, type: "quick_reply_human", title: "Nova mensagem no atendimento", message: suppressed ? "O lead enviou nova mensagem; a resposta foi suprimida pelo cooldown." : "O lead enviou uma mensagem e o atendimento foi sinalizado.", pushTitle: "Mensagem de lead", pushBody: "Verifique o atendimento na plataforma.", url: `/leads/${leadId}`, tag: `quick-reply-${leadId}` });
    }
    const wantsCall = quickReply.intent === "REQUEST_CALLBACK" && quickReply.nextState === "WAITING_HUMAN";
    if (quickReply.intent === "REQUEST_HUMAN" || wantsCall) {
      await transitionConversationState({
        tenantId,
        conversationId: conversation.id,
        newStatus: "WAITING_HUMAN",
        reason: wantsCall ? "O lead pediu ligação" : "Solicitação explícita de atendimento humano",
      });
      await db.update(schema.leads)
        .set(buildHumanHandoffLeadUpdate(now))
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
      await enqueueAndProcessLeadDistribution({ tenantId, leadId, source: "human_handoff" });
    } else if ((quickReply.intent === "OPT_OUT" || quickReply.intent === "NO_LONGER_INTERESTED" || quickReply.intent === "WRONG_NUMBER") && !leadOwner?.corretorId) {
      // Said no (or wrong number): never goes to a broker. Held for the director, who may hand it back
      // (Vinicios, 18/10, case Vanessa Soares: "Não quero não" and she still reached Alan as cold).
      await db.update(schema.leads).set({ ...terminalReplyLeadDisposition(), updatedAt: now })
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.corretorId)));
    }
    const waitWindowMs = (cooldownConfig?.waitWindowMinutes ?? 30) * 60 * 1000;
    const waitWindowActive = conversation.quickReplyWaitWindowStartedAt && now.getTime() - conversation.quickReplyWaitWindowStartedAt.getTime() < waitWindowMs;
    const isWaitRule = quickReply.ruleKey === "waiting_human" || quickReply.ruleKey === "waiting_response";
    const waitCount = isWaitRule && !suppressed ? (waitWindowActive ? conversation.quickReplyWaitResponseCount + 1 : 1) : conversation.quickReplyWaitResponseCount;
    const nextState = quickReply.nextState ?? automationState;
    await db.update(schema.aiConversations).set({ automationState: nextState, status: nextState === "PAUSED" ? "PAUSED" : nextState === "WAITING_HUMAN" ? "WAITING_HUMAN" : conversation.status === "HUMAN_ACTIVE" ? "HUMAN_ACTIVE" : "WAITING_CUSTOMER", quickReplyLastTemplate: suppressed ? conversation.quickReplyLastTemplate : quickReply.templateKey, quickReplyLastSentAt: suppressed ? conversation.quickReplyLastSentAt : now, quickReplyWaitWindowStartedAt: quickReply.ruleKey === "waiting_human" && !waitWindowActive ? now : conversation.quickReplyWaitWindowStartedAt, quickReplyWaitResponseCount: waitCount, optOutAt: quickReply.intent === "OPT_OUT" ? now : undefined, wrongNumberAt: quickReply.intent === "WRONG_NUMBER" ? now : undefined, lastProcessedMessageId: sourceIdentifier ?? conversation.lastProcessedMessageId, lastActivityAt: now, updatedAt: now }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, tenantId)));
    await db.insert(schema.aiQuickReplyEvents).values({ id: crypto.randomUUID(), tenantId, conversationId: conversation.id, leadId, sourceMessageId: sourceIdentifier ?? null, intent: quickReply.intent ?? "EMPTY_OR_UNCLEAR", ruleKey: quickReply.ruleKey ?? "unknown", templateKey: quickReply.templateKey, outcome: deliveryStatus, estimatedTokensSaved: 450, notifiedUserId });
    console.info("[quick-reply] resolved", { tenantId, leadId, conversationId: conversation.id, intent: quickReply.intent, rule: quickReply.ruleKey, template: quickReply.templateKey, outcome: deliveryStatus, notified: Boolean(notifiedUserId) });
    return { status: suppressed ? "quick_reply_suppressed" : "quick_reply_replied", deliveryStatus, reply: suppressed ? undefined : template?.body };
  }
  if (conversation.status === "WAITING_HUMAN") return { status: "ignored_waiting_human" };
  if (conversation.status === "HUMAN_ACTIVE") return { status: "ignored_human_active" };

  // Buscar dados do lead para contextualizar a IA
  const [lead] = await db
    .select({ nome: schema.leads.nome, tipo: schema.leads.tipo, corretorId: schema.leads.corretorId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  // 6. Extrair campos estruturados da mensagem e atualizar memória
  const expectedQuestionBeforeMessage = getNextQualificationQuestion(currentMemory, behavior.policy);
  const fieldsBeforeMessage = new Set(currentMemory.collectedFields);
  // The customer's own auto-reply or a copied instruction ("Digite sua idade
  // por favor.") is not an answer: no fact is read from it.
  const inboundIsAutomated = effectiveMessageKind === "text" && isAutomatedInboundMessage(userMessageBody);
  if (inboundIsAutomated) {
    // Two automated messages in a row: a bot is talking to our bot. Stay quiet
    // instead of feeding the loop; the person's next real message resumes it.
    const previousInbound = [...pastMessages].reverse().find((message) =>
      (message.direction === "incoming" || message.direction === "inbound") && (!sourceIdentifier || message.messageId !== sourceIdentifier));
    const sentBefore = pastMessages.some((message) => message.direction === "outbound" || message.senderRole === "assistant");
    if (sentBefore && previousInbound && isAutomatedInboundMessage(previousInbound.body)) {
      console.info("[qualification] automated_inbound_loop_ignored", { tenantId, leadId, conversationId: conversation.id });
      return { status: "ignored_automated_inbound" };
    }
  }
  let updatedMemory = inboundIsAutomated
    ? { ...currentMemory, collectedFields: [...currentMemory.collectedFields] }
    : extractFieldsFromMessage(userMessageBody, currentMemory, sourceIdentifier ?? undefined);
  let fieldsExtractedFromCurrentMessage = updatedMemory.collectedFields.filter((field) => !fieldsBeforeMessage.has(field));

  // 6-bis. The AI checks age, people and plan type the rules read from a longer message
  // before the reply repeats them (case Edivaldo, 21/10: "63 anos" twice became 2 people).
  const factsToVerify = fieldsExtractedFromCurrentMessage.filter((field): field is VerifiableField => (VERIFIABLE_FIELDS as readonly string[]).includes(field));
  if (!inboundIsAutomated && factsToVerify.length && effectiveMessageKind === "text" && shouldVerifyExtraction(userMessageBody)) {
    const facts: Partial<Record<VerifiableField, string>> = {};
    for (const field of factsToVerify) facts[field] = (updatedMemory[field] as { value?: string } | undefined)?.value ?? "";
    const verification = await verifyExtractedFacts({
      tenantId, conversationId: conversation.id, leadId, sourceMessageId: sourceIdentifier ?? null,
      message: userMessageBody, lastQuestion: currentMemory.lastQuestionAsked ?? null, facts,
    });
    const applied: string[] = [];
    for (const correction of verification.corrections) {
      if (!factsToVerify.includes(correction.field)) continue;
      const value = correction.value?.trim() ?? "";
      const valid = !value
        || (correction.field === "numberOfLives" && /^\d{1,2}$/.test(value) && Number(value) > 0)
        || (correction.field === "age" && /^\d{1,3}(\s*,\s*\d{1,3})*$/.test(value))
        || (correction.field === "planType" && ["individual", "familiar", "empresarial"].includes(value));
      if (!valid) continue;
      if (!value) {
        const { [correction.field]: _removed, ...rest } = updatedMemory;
        void _removed;
        updatedMemory = { ...rest, collectedFields: updatedMemory.collectedFields.filter((field) => field !== correction.field) } as ConversationMemory;
      } else {
        updatedMemory = { ...updatedMemory, [correction.field]: { value, confidence: 1, sourceMessageId: sourceIdentifier ?? undefined } };
      }
      applied.push(`${correction.field}=${value || "removido"}`);
    }
    if (applied.length) {
      fieldsExtractedFromCurrentMessage = updatedMemory.collectedFields.filter((field) => !fieldsBeforeMessage.has(field));
      console.info("[qualification] ai_verification_corrected", { tenantId, leadId, conversationId: conversation.id, applied, model: verification.model });
    }
  }

  // 6a. Analisar nome do cadastro do lead se for um nome valido
  if (lead?.nome && !lead.nome.startsWith("Lead WhatsApp") && !lead.nome.toLowerCase().includes("cliente") && !updatedMemory.customerName?.value) {
    updatedMemory = {
      ...updatedMemory,
      customerName: { value: lead.nome, confidence: 1 },
      customerFirstName: { value: lead.nome.split(/\s+/)[0], confidence: 1 },
      collectedFields: Array.from(new Set([...updatedMemory.collectedFields, "customerName"])),
    };
  }

  // 6b. Analisar historico de mensagens recebidas para acumular informacoes ja fornecidas
  const allIncomingMsgs = await db
    .select({ body: schema.whatsappMessages.body })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, tenantId),
        eq(schema.whatsappMessages.leadId, leadId),
        eq(schema.whatsappMessages.direction, "incoming")
      )
    );

  // Messages from before the AI's last reply are read without the question being asked now: "Faz uma
  // coisa", said before the city question, is not a city.
  const questionNow = updatedMemory.lastQuestionAsked;
  const questionsNow = updatedMemory.lastQuestionsAsked;
  for (const inc of allIncomingMsgs) {
    if (inc.body && !isAutomatedInboundMessage(inc.body)) {
      updatedMemory = extractFieldsFromMessage(inc.body, { ...updatedMemory, lastQuestionAsked: undefined, lastQuestionsAsked: undefined });
    }
  }
  updatedMemory = { ...updatedMemory, lastQuestionAsked: questionNow, lastQuestionsAsked: questionsNow };

  // Every customer message sent after the AI's last reply is an answer to its last question: read them
  // all, oldest first, each with that question (28/10). Before, only the last message of a batch was
  // read with it, so a city sent just before "Não tenho plano" was lost.
  const [lastAiReply] = await db
    .select({ sentAt: schema.whatsappMessages.sentAt })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.conversationId, conversation.id),
      or(eq(schema.whatsappMessages.direction, "outbound"), eq(schema.whatsappMessages.senderRole, "assistant")),
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(1);
  const unansweredIncoming = await db
    .select({ messageId: schema.whatsappMessages.messageId, body: schema.whatsappMessages.body })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.conversationId, conversation.id),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      lastAiReply?.sentAt ? gt(schema.whatsappMessages.sentAt, lastAiReply.sentAt) : undefined,
    ))
    .orderBy(asc(schema.whatsappMessages.sentAt))
    .limit(50);
  // The message this turn already reads (step 6) is left out.
  updatedMemory = extractUnansweredMessages(
    updatedMemory,
    unansweredIncoming.filter((message) => message.messageId !== sourceIdentifier && message.body && !isAutomatedInboundMessage(message.body)),
  );

  // 6c. Buscar textos de mensagens enviadas para evitar repeticao de perguntas
  const allOutboundMsgs = await db
    .select({ body: schema.whatsappMessages.body, sentAt: schema.whatsappMessages.sentAt, senderRole: schema.whatsappMessages.senderRole })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.tenantId, tenantId),
        eq(schema.whatsappMessages.leadId, leadId),
        eq(schema.whatsappMessages.direction, "outbound")
      )
    )
    .orderBy(desc(schema.whatsappMessages.sentAt));

  const pastOutboundTexts = new Set(allOutboundMsgs.map((m) => m.body.trim().toLowerCase()));
  const assistantReplies = allOutboundMsgs.filter((message) => message.senderRole === "assistant");
  const recentReplies = assistantReplies.slice(0, 3).map((message) => message.body);
  const latestOutboundAt = assistantReplies[0]?.sentAt ?? null;

  // 6d. Carregar config do tenant para usar mensagens configuráveis e checar flag enabled
  const tenantConfig = await loadTenantAiAgentConfig(tenantId);

  // One transfer path: an explicit request for a person, or a tenant situation whose action is "transfer".
  const transferToHuman = async (handoffMessage: string, reason: string) => {
    const messageId = `ai_msg_handoff_${crypto.randomUUID()}`;
    await db.insert(schema.whatsappMessages).values({
      id: messageId,
      tenantId,
      leadId,
      communicationChannelId: communicationChannelId ?? null,
      conversationId: conversation.id,
      senderRole: "assistant",
      provider: transport,
      phone,
      direction: "outbound",
      body: handoffMessage,
      sentAt: new Date(),
    });
    let deliveryStatus = "failed";
    try {
      const sent = await sendAiOutbound({ tenantId, leadId, phone, body: handoffMessage, transport, openWaSessionId, wahaRunId, currentMessageId: messageId });
      deliveryStatus = sent.status;
      if (sent.messageId) {
        await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId })
          .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      }
    } catch (error) {
      console.error("[ai-wpp] handoff.failed", { tenantId, leadId, transport, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
    }
    await transitionConversationState({ tenantId, conversationId: conversation.id, newStatus: "WAITING_HUMAN", reason });
    const humanQualification = await persistQualificationEvaluation({ tenantId, leadId, conversationId: conversation.id, actorUserId: null, policy: behavior.policy, memory: updatedMemory, reason: "human_requested" });
    const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
    await distributeQualifiedLead({ tenantId, leadId, actorUserId: null }).catch((distErr) => {
      console.warn("[qualification] human_requested.distribution_failed", { tenantId, leadId, error: distErr });
    });
    console.info("[qualification] human_requested", { tenantId, leadId, conversationId: conversation.id, state: humanQualification.state, score: humanQualification.score });
    return { status: "transferred_to_human", deliveryStatus, reply: handoffMessage };
  };

  if (detectHumanTransferRequest(userMessageBody)) {
    return transferToHuman(
      renderConversationVariables(handoffBodyFor(tenantConfig.handoffMessage, DEFAULT_HUMAN_REQUEST_TEXT, AFTER_HOURS_HUMAN_REQUEST_TEXT), updatedMemory, lead?.nome),
      "Solicitação explícita de atendimento humano",
    );
  }

  // 6e. IA desativada para o tenant: silêncio. Pedidos explícitos de humano
  // (bloco acima) são sempre honrados, mesmo com a IA desligada.
  if (!tenantConfig.enabled) {
    console.info("[ai-wpp] ai_disabled_by_tenant", { tenantId, leadId });
    return { status: "ignored_ai_disabled" };
  }

  // A resposta pode estar correta, mas fora do vocabulário das regras (por
  // exemplo, "Famíliar" ou "é para a família"). Nesse caso a IA atua apenas
  // como intérprete: ela propõe fatos estruturados e o motor determinístico
  // continua responsável por validar a memória e escolher a próxima etapa.
  let aiFallbackResult: InterpreterResult | undefined;
  let fallbackAppliedCount = 0;
  let fallbackAppliedFields: string[] = [];
  const pendingQuestionAfterExtraction = getNextQualificationQuestion(updatedMemory, behavior.policy, pastOutboundTexts);
  const expectedWasAnswered = Boolean(expectedQuestionBeforeMessage && fieldsExtractedFromCurrentMessage.includes(expectedQuestionBeforeMessage.key));
  const currentMessageAdvancedToAnotherField = Boolean(
    expectedQuestionBeforeMessage
      && pendingQuestionAfterExtraction
      && pendingQuestionAfterExtraction.key !== expectedQuestionBeforeMessage.key
      && fieldsExtractedFromCurrentMessage.length > 0,
  );
  if (pendingQuestionAfterExtraction && !inboundIsAutomated && shouldUseQualificationFallback({
    hasPendingQuestion: Boolean(pendingQuestionAfterExtraction),
    expectedWasAnswered,
    advancedToAnotherField: currentMessageAdvancedToAnotherField,
    extractedFieldCount: fieldsExtractedFromCurrentMessage.length,
    messageLength: normalizedInboundMessage.length,
    messageKind: effectiveMessageKind,
  })) {
    const pendingField = pendingQuestionAfterExtraction.key as keyof ConversationMemory;
    const pendingValue = pendingField === "age" && updatedMemory.planType?.value === "empresarial"
      ? updatedMemory.averageAge?.value
      : (updatedMemory[pendingField] as { value?: string } | undefined)?.value;

    if (!pendingValue?.trim()) {
      try {
        // Gateway "interpreter" profile: fast model, a second one as fallback,
        // 6 s each; the gateway logs every attempt and this logs the give-up.
        aiFallbackResult = await interpretQualificationTurn({
          tenantId,
          conversationId: conversation.id,
          leadId,
          sourceMessageId: sourceIdentifier ?? null,
          leadName: lead?.nome,
          leadType: lead?.tipo,
          messages: aiMessages,
          // The question the customer actually saw (not the internal definition
          // text): short answers such as "pode ser 1" only make sense against it.
          prompt: buildQualificationFallbackPrompt(pendingQuestionAfterExtraction.key, currentMemory.lastQuestionAsked?.trim() || pendingQuestionAfterExtraction.text),
          memoryContext: buildMemoryContext({ ...updatedMemory, lastQuestionAsked: currentMemory.lastQuestionAsked?.trim() || pendingQuestionAfterExtraction.text }),
        });
      } catch (error) {
        console.warn("[qualification] ai_fallback_failed_open", {
          tenantId,
          leadId,
          conversationId: conversation.id,
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
        });
      }

      const applied = applyAiMemoryUpdates(updatedMemory, aiFallbackResult?.memoryUpdates, sourceIdentifier ?? undefined, normalizedInboundMessage);
      if (applied.applied.length > 0) {
        updatedMemory = applied.memory;
        fallbackAppliedCount = applied.applied.length;
        fallbackAppliedFields = applied.applied.map((item) => String(item.field));
        console.info("[qualification] ai_fallback_memory_applied", {
          tenantId,
          leadId,
          conversationId: conversation.id,
          sourceMessageId: sourceIdentifier ?? null,
          fields: applied.applied.map((item) => item.field),
          model: aiFallbackResult?.modelUsed ?? "unavailable",
          latencyMs: aiFallbackResult?.latencyMs ?? 0,
        });
      } else {
        console.info("[qualification] ai_fallback_no_fact", {
          tenantId,
          leadId,
          conversationId: conversation.id,
          sourceMessageId: sourceIdentifier ?? null,
          model: aiFallbackResult?.modelUsed ?? "unavailable",
          success: aiFallbackResult?.ok ?? false,
          error: aiFallbackResult?.error ?? null,
        });
      }

    }
  }

  // Objection or refusal read in context by the interpreter (never a word list): ask why once,
  // offering a concrete path; a second refusal closes politely (qualification turbo, 21/10).
  const softDecline = !inboundIsAutomated && parseSoftDecline(userMessageBody);
  const interpreterIntent = aiFallbackResult?.ok ? aiFallbackResult.intent : undefined;
  // "Já tenho Amil" answering "vocês já têm plano hoje?" is information, never a decline (23/10).
  const answeredCurrentPlan = !currentMemory.currentPlan?.value && Boolean(updatedMemory.currentPlan?.value);
  const isObjection = !answeredCurrentPlan && (interpreterIntent === "objection" || interpreterIntent === "decline" || (softDecline && !aiFallbackResult?.ok));
  if (isObjection && fieldsExtractedFromCurrentMessage.length === 0 && fallbackAppliedCount === 0) {
    const attempts = updatedMemory.objectionAttempts ?? 0;
    const leadFirstName = lead?.nome && !/^lead\b/i.test(lead.nome.trim()) ? lead.nome.trim().split(/\s+/)[0] : "";
    const firstName = updatedMemory.customerFirstName?.value ?? leadFirstName;
    const recovering = attempts < MAX_OBJECTION_RECOVERIES;
    const text = recovering
      ? aiFallbackResult?.reply?.trim() || defaultObjectionReply(firstName)
      : `Tudo bem${firstName ? `, ${firstName}` : ""}, obrigado pela atenção. Fica à vontade pra voltar quando quiser, ou pra cotar pra alguém da família. É só me chamar por aqui.`;
    const now = new Date();
    const replyId = `ai_msg_objection_${crypto.randomUUID()}`;
    await db.insert(schema.whatsappMessages).values({ id: replyId, tenantId, leadId, communicationChannelId: communicationChannelId ?? null, conversationId: conversation.id, senderRole: "assistant", provider: transport, phone, direction: "outbound", body: text, sentAt: now });
    let deliveryStatus = "failed";
    try {
      const sent = await sendAiOutbound({ tenantId, leadId, phone, body: text, transport, openWaSessionId, wahaRunId, currentMessageId: replyId });
      deliveryStatus = sent.status;
      if (sent.messageId) await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId }).where(and(eq(schema.whatsappMessages.id, replyId), eq(schema.whatsappMessages.tenantId, tenantId)));
    } catch (error) {
      console.error("[qualification] objection_reply.failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
    }
    const nextMemory: ConversationMemory = { ...updatedMemory, objectionAttempts: attempts + 1, lastQuestionAsked: recovering ? text : updatedMemory.lastQuestionAsked };
    await db.update(schema.aiConversations).set({
      memory: nextMemory,
      status: recovering ? "WAITING_CUSTOMER" : "PAUSED",
      automationState: recovering ? "AI_ACTIVE" : "PAUSED",
      optOutAt: recovering ? undefined : now,
      lastProcessedMessageId: sourceIdentifier ?? conversation.lastProcessedMessageId,
      lastActivityAt: now,
      updatedAt: now,
    }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, tenantId)));
    if (!recovering) {
      await db.update(schema.leads).set({ ...terminalReplyLeadDisposition(), updatedAt: now })
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.corretorId)));
    }
    await db.insert(schema.aiQuickReplyEvents).values({
      id: crypto.randomUUID(), tenantId, conversationId: conversation.id, leadId, sourceMessageId: sourceIdentifier ?? null,
      intent: "NO_LONGER_INTERESTED", ruleKey: recovering ? OBJECTION_RECOVERY_RULE : DECLINE_AFTER_OBJECTION_RULE,
      templateKey: aiFallbackResult?.objectionType ?? null, outcome: deliveryStatus, estimatedTokensSaved: 0, notifiedUserId: null,
    });
    console.info("[qualification] objection", { tenantId, leadId, conversationId: conversation.id, recovering, type: aiFallbackResult?.objectionType ?? (softDecline ? "soft_decline" : "unknown"), model: aiFallbackResult?.modelUsed ?? "rule" });
    return { status: recovering ? "objection_recovery" : "declined_after_objection", deliveryStatus, reply: text };
  }

  const answeredNow = fieldsExtractedFromCurrentMessage.length > 0 || fallbackAppliedCount > 0 || answeredCurrentPlan;
  const customerPriceConcern = !inboundIsAutomated && effectiveMessageKind === "text"
    ? priceConcernLine(normalizedInboundMessage, { lives: Number.parseInt(updatedMemory.numberOfLives?.value ?? "", 10) || null, seed: conversation.id })
    : null;
  // What this message filled, for the confirmation ("Itaboraí, ótimo."). The
  // lives implied by an individual plan were not said, so they are not echoed.
  const answeredFields = Array.from(new Set([...fieldsExtractedFromCurrentMessage, ...fallbackAppliedFields]))
    .filter((field) => !(field === "numberOfLives" && (updatedMemory.numberOfLives?.confidence ?? 1) < 1));
  // First reply of the conversation (the customer wrote first): say hello by
  // name and who is talking before the first question.
  let greeting: string | null = null;
  const turnNow = new Date();
  if (assistantReplies.length === 0) {
    const [tenantInfo] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
    greeting = composeGreeting({
      name: updatedMemory.customerFirstName?.value ?? lead?.nome ?? null,
      assistantName: tenantConfig.assistantName,
      companyName: tenantInfo?.name ?? null,
      seed: conversation.id,
      now: turnNow,
    });
  }
  const afterHours = isAfterHoursInSaoPaulo();
  let deterministicTurn = resolveDeterministicQualificationTurn({
    memory: updatedMemory,
    policy: behavior.policy,
    handoffMessage: tenantConfig.handoffMessage,
    pastOutboundTexts,
    answeredNow: customerPriceConcern ? false : answeredNow,
    answered: customerPriceConcern ? [] : answeredFields,
    // The greeting already used the name: the question must not repeat it.
    previousReply: greeting ?? currentMemory.lastQuestionAsked ?? null,
    recentReplies,
    greetingText: greeting,
    periodGreeting: !greeting && shouldUsePeriodGreeting(latestOutboundAt, turnNow),
    now: turnNow,
    seed: `${conversation.id}:${pastOutboundTexts.size}`,
  });
  // The customer asked something instead of answering. A registered situation
  // (the tenant's own ones first, then the common questions) gets its reviewed
  // text, or the transfer when that is its action; anything else the lateral
  // answer guided by the roteiros. Then the pending question follows; on any
  // failure the scripted reply goes alone.
  if (deterministicTurn.kind === "collecting" && !answeredNow && !customerPriceConcern && !inboundIsAutomated && effectiveMessageKind === "text") {
    const situation = detectLateralSituation(normalizedInboundMessage, tenantSituations);
    // Learning (Atendimento → Situações): every question asked here is recorded
    // with the situation that covered it; the uncovered ones become suggestions.
    const learn = (matchedSituationKey: string | null, aiAnswer: string | null) => void recordLearningEvent({
      tenantId, conversationId: conversation.id, leadId, question: normalizedInboundMessage,
      matchedSituationKey, aiAnswer, channel: transport, communicationChannelId: communicationChannelId ?? null,
    });
    if (situation?.kind === "custom" && situation.action === "transfer") {
      learn(situation.key, null);
      return transferToHuman(renderConversationVariables(situation.response, updatedMemory, lead?.nome), `Situação: ${situation.label}`);
    }
    if (situation) {
      learn(situation.key, null);
      const situationText = situation.kind === "custom" ? situation.response : (await loadQuickReplyTemplates(tenantId))[situation.key]?.body;
      if (situationText) deterministicTurn = { ...deterministicTurn, reply: `${renderConversationVariables(situationText, updatedMemory, lead?.nome)}\n\n${deterministicTurn.reply}` };
    } else if (isCustomerQuestion(normalizedInboundMessage)) {
      const lateral = await generateLateralAnswer({ tenantId, question: normalizedInboundMessage, customerFirstName: updatedMemory.customerFirstName?.value ?? null, conversationId: conversation.id, leadId });
      learn(null, lateral);
      if (lateral) deterministicTurn = { ...deterministicTurn, reply: `${lateral}\n\n${deterministicTurn.reply}` };
    }
  }
  // An automated/ad text mid-conversation ("Digite sua idade e receba uma
  // cotação...", the click-to-WhatsApp prefilled text) gets the pending
  // question again, without echoing it as if the person had answered.
  // At night no broker answers "em instantes": the first available one gets in touch.
  if (deterministicTurn.kind === "handoff" && afterHours) {
    // The tenant's handoff text wins (D1). Only the handoff sentence is swapped: whatever the turn appended after it
    // (an invitation, such as the optional relationship question) is kept as it was.
    const daytimeHandoff = renderConversationVariables(effectiveHandoffText(tenantConfig.handoffMessage, DEFAULT_QUALIFIED_HANDOFF_TEXT), updatedMemory);
    const handoffBody = handoffBodyFor(tenantConfig.handoffMessage, DEFAULT_QUALIFIED_HANDOFF_TEXT, AFTER_HOURS_QUALIFIED_HANDOFF_TEXT);
    const renderedHandoff = renderConversationVariables(handoffBody, updatedMemory, lead?.nome);
    deterministicTurn = replaceHandoffTextPreservingExtension(deterministicTurn, daytimeHandoff, renderedHandoff);
  }
  // The lead already has a broker (resumed after the time limit, or a hot lead sent early):
  // the end says who continues, by first name (28/10).
  if (deterministicTurn.kind === "handoff" && lead?.corretorId) {
    const [broker] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, lead.corretorId)).limit(1);
    const brokerHandoff = distributedHandoffText(broker?.name);
    if (brokerHandoff) {
      const currentHandoff = afterHours
        ? renderConversationVariables(handoffBodyFor(tenantConfig.handoffMessage, DEFAULT_QUALIFIED_HANDOFF_TEXT, AFTER_HOURS_QUALIFIED_HANDOFF_TEXT), updatedMemory, lead?.nome)
        : renderConversationVariables(effectiveHandoffText(tenantConfig.handoffMessage, DEFAULT_QUALIFIED_HANDOFF_TEXT), updatedMemory);
      deterministicTurn = replaceHandoffTextPreservingExtension(deterministicTurn, currentHandoff, brokerHandoff);
    }
  }
  // The customer said the current plan costs too much: show it was heard before the question.
  if (deterministicTurn.kind === "collecting" && !inboundIsAutomated) {
    const nextQuestionKey = deterministicTurn.nextQuestion?.key as QualificationFieldKey | undefined;
    const customQuestionText = nextQuestionKey ? behavior.policy.questionTexts?.[nextQuestionKey] : null;
    if (shouldAddPriceConcern(customerPriceConcern, customQuestionText)) {
      deterministicTurn = { ...deterministicTurn, reply: `${customerPriceConcern}\n\n${deterministicTurn.reply}` };
    }
  }
  return completeDeterministicQualificationTurn({
    tenantId,
    leadId,
    phone,
    conversationId: conversation.id,
    communicationChannelId,
    transport,
    openWaSessionId,
    wahaRunId,
    sourceIdentifier,
    memory: updatedMemory,
    policy: behavior.policy,
    turn: deterministicTurn,
    turnLatestInboundAt,
  });

  // 7. Detectar idioma da mensagem do usuário
  /* Legacy LLM path retained for a future non-qualification assistant mode.
   * Qualification returns above, before this path can select another field.
  const detectedLanguage = detectLanguage(userMessageBody);

  // 7b. tenantConfig já carregado no step 6b

  // 7c. Buscar nome do tenant para personalizar o prompt
  const [tenantInfo] = await db
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  const nextPendingQuestion = getNextQualificationQuestion(updatedMemory, behavior.policy);
  const nextQuestionGuidance = nextPendingQuestion
    ? `\n\nPERGUNTA OBRIGATÓRIA PENDENTE A FAZER AGORA (Faça APENAS esta pergunta ao cliente de forma natural em português): "${nextPendingQuestion.text}"`
    : "";

  // 8. Chamar gerador de resposta da IA com contexto de memória + configs tenant
  // No modo de reset por mensagem, o contexto enviado à IA contém apenas a mensagem atual.
  const aiResult = await generateAiResponse({
    tenantId,
    leadName: lead?.nome,
    leadType: lead?.tipo,
    messages: aiMessages,
    preferredLanguage: detectedLanguage,
    memoryContext: `${memoryContext}${nextQuestionGuidance}`,
    tenantConfig,
    tenantName: tenantInfo?.name,
  });

  let qualificationStatus = qualification.state === "QUALIFIED" ? qualification.qualificationStatus : undefined;

  console.info("[ai-wpp] ai.completed", {
    tenantId,
    leadId,
    conversationId: conversation.id,
    success: aiResult.success,
    model: aiResult.modelUsed,
    latencyMs: aiResult.latencyMs,
    totalTokens: aiResult.totalTokens,
    language: detectedLanguage,
  });

  // Early fallback guard: if AI fails to generate any reply, send a fallback notification
  if (!aiResult.success || !aiResult.content) {
    const fallbackMessage = "Olá! Nosso atendente virtual está temporariamente indisponível. Já estamos direcionando seu contato para um de nossos corretores humanos!";
    
    // 1. Save fallback message in db
    const fallbackMsgId = `ai_msg_fallback_${crypto.randomUUID()}`;
    try {
      await db.insert(schema.whatsappMessages).values({
        id: fallbackMsgId,
        tenantId,
        leadId,
        communicationChannelId: communicationChannelId ?? null,
        conversationId: conversation.id,
        senderRole: "assistant",
        provider: transport,
        phone,
        direction: "outbound",
        body: fallbackMessage,
        sentAt: new Date(),
      });
    } catch (saveErr) {
      console.error("[ai-agent] Falha ao salvar mensagem de fallback no banco:", saveErr);
    }

    // 2. Send fallback message to WhatsApp
    try {
      const sent = await sendAiOutbound({ tenantId, leadId, phone, body: fallbackMessage, transport, openWaSessionId, wahaRunId, currentMessageId: fallbackMsgId });
      if (sent.status === "sent") {
        console.info("[ai-wpp] fallback.sent", { tenantId, leadId, phone });
      } else {
        console.warn("[ai-wpp] fallback.skipped_no_channel", { tenantId, leadId, transport });
      }
    } catch (sendError) {
      console.error("[ai-agent] Falha ao enviar mensagem de fallback no WhatsApp:", sendError);
    }

    // 3. Transition to WAITING_HUMAN
    await transitionConversationState({
      tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_HUMAN",
      reason: aiResult.transferReason || "Falha na geração de resposta da IA (enviado fallback)",
    });

    return { status: "failed_fallback_sent", error: aiResult.error, reply: fallbackMessage };
  }

  // ── Guardrail Pipeline ─────────────────────────────────────────────────
  // Run ALL guardrails BEFORE logging or sending anything.
  // If a guardrail blocks, the response NEVER reaches the customer.

  const collectedFieldsBefore = [...updatedMemory.collectedFields];
  const guardrailCtx = {
    response: aiResult.structured ?? {
      message: aiResult.content ?? "",
      language: detectedLanguage as "pt-BR" | "en",
      detectedIntent: "other" as const,
      shouldTransfer: false,
      shouldWait: true,
    } as import("./ai-response-schema").AiStructuredResponse,
    rawText: aiResult.content ?? "",
    memory: updatedMemory,
    conversationStatus: conversation.status as ConversationStatus,
    tenantId,
    conversationId: conversation.id,
    leadId,
    userMessage: userMessageBody,
    collectedFieldsBefore,
  };

  const pipeline = createDefaultGuardrailPipeline(detectedLanguage as "pt-BR");
  const pipelineResult = await runGuardrailPipeline(pipeline, guardrailCtx);

  if (!pipelineResult.passed) {
    console.warn("[ai-agent] guardrail_blocked", {
      conversationId: conversation.id,
      guardrail: pipelineResult.blockedBy,
      code: pipelineResult.code,
      reason: pipelineResult.reason,
    });
    // Guardrail bloqueou — não enviamos a resposta, mas NÃO matamos a conversa.
    // A próxima mensagem do usuário tentará novamente com contexto atualizado.
    const safeFallback = createSafeFallbackResponse(
      updatedMemory.customerName?.value,
      buildMemoryContext(updatedMemory),
    );
    const fallbackMessageId = `ai_msg_guardrail_fallback_${crypto.randomUUID()}`;
    await db.insert(schema.whatsappMessages).values({
      id: fallbackMessageId,
      tenantId,
      leadId,
      communicationChannelId: communicationChannelId ?? null,
      conversationId: conversation.id,
      senderRole: "assistant",
      provider: transport,
      phone,
      direction: "outbound",
      body: safeFallback.message,
      sentAt: new Date(),
    });

    let fallbackDeliveryStatus = "failed";
    try {
      const sent = await sendAiOutbound({ tenantId, leadId, phone, body: safeFallback.message, transport, openWaSessionId, wahaRunId, currentMessageId: fallbackMessageId });
      if (sent.status === "sent") {
        await db.update(schema.whatsappMessages)
          .set({ providerStatus: "sent", messageId: sent.messageId ?? undefined })
          .where(and(eq(schema.whatsappMessages.id, fallbackMessageId), eq(schema.whatsappMessages.tenantId, tenantId)));
        fallbackDeliveryStatus = "sent";
        console.info("[ai-wpp] guardrail_fallback.sent", { tenantId, leadId, conversationId: conversation.id, code: pipelineResult.code });
      } else {
        console.warn("[ai-wpp] guardrail_fallback.skipped_no_channel", { tenantId, leadId, conversationId: conversation.id, transport });
      }
    } catch (sendError) {
      const error = sendError instanceof Error ? sendError.message.slice(0, 240) : "unknown_error";
      await db.update(schema.whatsappMessages)
        .set({ providerStatus: "failed" })
        .where(and(eq(schema.whatsappMessages.id, fallbackMessageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      console.error("[ai-wpp] guardrail_fallback.failed", { tenantId, leadId, conversationId: conversation.id, error });
    }

    await transitionConversationState({
      tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_CUSTOMER",
      reason: `Guardrail ${pipelineResult.code} substituído por fallback seguro`,
    });

    return {
      status: "guardrail_fallback_sent",
      deliveryStatus: fallbackDeliveryStatus,
      reply: safeFallback.message,
      error: `Resposta bloqueada pelo guardrail ${pipelineResult.blockedBy}: ${pipelineResult.reason}`,
    };
  }

  // ── Log attendance (only after all guardrails pass) ────────────────────
  try {
    const logId = `log_${crypto.randomUUID()}`;
    await db.insert(schema.aiAttendanceLogs).values({
      id: logId,
      tenantId,
      conversationId: conversation.id,
      leadId,
      provider: "openrouter",
      modelUsed: aiResult.modelUsed,
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      totalTokens: aiResult.totalTokens,
      estimatedCost: aiResult.estimatedCost,
      latencyMs: aiResult.latencyMs,
      // The model did not answer and the safe scripted reply went: visible as "fallback".
      status: aiResult.modelUsed === "fallback-rule-engine" ? "fallback" : "success",
      errorMessage: aiResult.error?.slice(0, 240) ?? null,
      sourceMessageId: sourceIdentifier ?? null,
    }).onConflictDoNothing();
  } catch (logErr) {
    console.warn("[ai-agent] Failed to insert aiAttendanceLogs:", logErr);
  }

  // Merge any memory updates proposed by the LLM (from aiResult.structured)
  const currentInboundHasPositiveCnpjEvidence = extractFieldsFromMessage(
    userMessageBody,
    createEmptyMemory(),
    sourceIdentifier ?? undefined,
  ).companyHasCnpj?.value === "true";
  if (aiResult.success && aiResult.structured?.memoryUpdates) {
    const addField = (key: string) => {
      if (!updatedMemory.collectedFields.includes(key)) {
        updatedMemory.collectedFields.push(key);
      }
    };

    for (const update of aiResult.structured.memoryUpdates) {
      const field = update.field;
      const value = update.value?.trim();
      const confidence = update.confidence ?? 1;

      if (!field || !value) continue;

      if (field === "customerName") {
        if (!updatedMemory.customerName || confidence >= (updatedMemory.customerName.confidence ?? 0)) {
          updatedMemory.customerName = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          updatedMemory.customerFirstName = { value: value.split(" ")[0], confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("customerName");
        }
      } else if (field === "email") {
        if (!updatedMemory.email || confidence >= (updatedMemory.email.confidence ?? 0)) {
          updatedMemory.email = { value: value.toLowerCase(), confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("email");
        }
      } else if (field === "city") {
        if (!updatedMemory.city || confidence >= (updatedMemory.city.confidence ?? 0)) {
          updatedMemory.city = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("city");
        }
      } else if (field === "planType") {
        const planVal = /individual|familiar|empresarial/i.test(value) ? value.toLowerCase() : "individual";
        if (!updatedMemory.planType || confidence >= (updatedMemory.planType.confidence ?? 0)) {
          updatedMemory.planType = { value: planVal, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("planType");
        }
      } else if (field === "numberOfLives") {
        if (!updatedMemory.numberOfLives || confidence >= (updatedMemory.numberOfLives.confidence ?? 0)) {
          updatedMemory.numberOfLives = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("numberOfLives");
        }
      } else if (field === "age") {
        const isPme = updatedMemory.planType?.value === "empresarial";
        const currentAgeValue = isPme ? updatedMemory.averageAge : updatedMemory.age;
        if (!currentAgeValue || confidence >= (currentAgeValue.confidence ?? 0)) {
          if (isPme) updatedMemory.averageAge = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          else updatedMemory.age = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("age");
        }
      } else if (field === "companyHasCnpj") {
        const val = /true|sim|yes/i.test(value) ? "true" : "false";
        if (val === "true" && !currentInboundHasPositiveCnpjEvidence) continue;
        if (!updatedMemory.companyHasCnpj || confidence >= (updatedMemory.companyHasCnpj.confidence ?? 0)) {
          updatedMemory.companyHasCnpj = { value: val, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("companyHasCnpj");
        }
      }
    }
  }

  // Reapply deterministic facts after model updates so structured suggestions cannot
  // override positive company evidence from the inbound message.
  updatedMemory = extractFieldsFromMessage(userMessageBody, updatedMemory, sourceIdentifier ?? undefined);

  // The model can extract a field from the same message it responds to. Re-evaluate
  // after those structured updates so the final answer is not an extra question and
  // the lead is handed off in this same turn.
  qualification = evaluateQualification(updatedMemory, behavior.policy);
  qualificationStatus = qualification.state === "QUALIFIED" ? qualification.qualificationStatus : undefined;

  if (qualification.missingFields.length === 0) {
    aiResult.content = tenantConfig.handoffMessage || "Obrigado pelas informações. Vou encaminhar seu atendimento para um corretor da equipe agora.";
    aiResult.shouldTransferToHuman = true;
    aiResult.transferReason = "Qualification completed";

    if (aiResult.structured) {
      aiResult.structured.shouldTransfer = true;
      aiResult.structured.questionAsked = null;
    }
  }

  // Persist the question in the same turn so a short next reply such as "3" can be interpreted safely.
  updatedMemory.lastQuestionAsked = aiResult.content;

  // Persist detected language, memory, and last processed message ID
  try {
    await db.update(schema.aiConversations)
      .set({
        language: detectedLanguage,
        memory: updatedMemory as unknown as Record<string, unknown>,
        lastProcessedMessageId: sourceIdentifier ?? null,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.aiConversations.id, conversation.id),
          eq(schema.aiConversations.tenantId, tenantId),
        ),
      );
  } catch (err) {
    console.error("[ai-agent] Failed to update aiConversation memory:", err);
  }

  // Update the lead table with any newly extracted information
  try {
    const leadUpdates: Partial<typeof schema.leads.$inferInsert> = {};
    
    if (updatedMemory.customerName?.value) {
      const rawName = updatedMemory.customerName.value.trim();
      if (rawName && !/^lead whatsapp/i.test(rawName)) {
        leadUpdates.nome = rawName;
      }
    }
    
    if (updatedMemory.email?.value) {
      const rawEmail = updatedMemory.email.value.trim().toLowerCase();
      if (rawEmail && rawEmail.includes("@")) {
        leadUpdates.email = rawEmail;
      }
    }
    
    if (updatedMemory.planType?.value) {
      const val = updatedMemory.planType.value;
      if (val === "empresarial") {
        leadUpdates.tipo = "PJ";
      } else if (val === "individual" || val === "familiar") {
        leadUpdates.tipo = "PF";
      }
    }

    if (qualificationStatus) {
      leadUpdates.qualificationStatus = qualificationStatus;
    }

    if (Object.keys(leadUpdates).length > 0) {
      await db.update(schema.leads)
        .set({
          ...leadUpdates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.leads.id, leadId),
            eq(schema.leads.tenantId, tenantId),
          )
        );
      console.info("[ai-agent] lead.updated_from_qualification", {
        tenantId,
        leadId,
        fields: Object.keys(leadUpdates),
      });
    }
  } catch (leadUpdateErr) {
    console.error("[ai-agent] Failed to update lead details from memory in database:", leadUpdateErr);
  }

  const persistedQualification = await persistQualificationEvaluation({ tenantId, leadId, conversationId: conversation.id, actorUserId: null, policy: behavior.policy, memory: updatedMemory });
  const qualificationCompleted = persistedQualification.state === "QUALIFIED";


  // 7. Salvar mensagem da IA no banco
  const messageId = `ai_msg_${crypto.randomUUID()}`;
  await db.insert(schema.whatsappMessages).values({
    id: messageId,
    tenantId,
    leadId,
    communicationChannelId: communicationChannelId ?? null,
    conversationId: conversation.id,
    senderRole: "assistant",
    provider: transport,
    phone,
    direction: "outbound",
    body: aiResult.content,
    sentAt: new Date(),
  });

  // 8. Tentar enviar mensagem de saída pelo provedor da Meta se canal ativo
  let deliveryStatus = "failed";
  let providerMessageId: string | null = null;
  try {
    const sent = await sendAiOutbound({ tenantId, leadId, phone, body: aiResult.content, transport, openWaSessionId, wahaRunId, currentMessageId: messageId });
    if (sent.status === "sent") {
      await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId ?? undefined }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      deliveryStatus = "sent";
      providerMessageId = sent.messageId ?? null;
      console.info("[ai-wpp] outbound.sent", { tenantId, leadId, conversationId: conversation.id, messageId: sent.messageId });
    } else {
      console.warn("[ai-wpp] outbound.skipped", { tenantId, leadId, reason: "no_active_channel", transport });
    }
  } catch (sendError) {
    const error = sendError instanceof Error ? sendError.message.slice(0, 240) : "unknown_error";
    await db.update(schema.whatsappMessages).set({ providerStatus: "failed" }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
    console.error("[ai-wpp] outbound.failed", { tenantId, leadId, conversationId: conversation.id, error });
  }

  // 9. Atualizar estado final da conversa

  if (qualificationCompleted && isConfirmedClosingDelivery(deliveryStatus, providerMessageId)) {
    const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
    const distResult = await distributeQualifiedLead({ tenantId, leadId, actorUserId: null });
    const { executeDeterministicClosing } = await import("@/features/ai-qualification/closing-state-service");
    await executeDeterministicClosing(tenantId, conversation.id, leadId, updatedMemory.customerName?.value, providerMessageId);
    await transitionConversationState({
      tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_HUMAN",
      reason: "Mensagem final entregue; qualificação concluída e atendimento encaminhado.",
    });
    console.info("[qualification] completed_and_routed", { tenantId, leadId, conversationId: conversation.id, distributed: distResult.distributed });
    return { status: "transferred_to_human", deliveryStatus, reply: aiResult.content };
  }

  if (aiResult.shouldTransferToHuman && !qualificationCompleted) {
    const handoffAt = new Date();
    await db.update(schema.leads)
      .set(buildHumanHandoffLeadUpdate(handoffAt))
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
    await enqueueAndProcessLeadDistribution({ tenantId, leadId, source: "human_handoff" });
    await transitionConversationState({
      tenantId,
      conversationId: conversation.id,
      newStatus: "WAITING_HUMAN",
      reason: aiResult.transferReason || "Transferido para corretor humano",
    });
    return { status: "transferred_to_human", deliveryStatus, reply: aiResult.content };
  }

  await transitionConversationState({
    tenantId,
    conversationId: conversation.id,
    newStatus: "WAITING_CUSTOMER",
  });

  return { status: "replied", deliveryStatus, reply: aiResult.content };
  */
}
