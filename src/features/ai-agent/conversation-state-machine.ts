import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { generateAiResponse, detectLanguage, detectHumanTransferRequest } from "./service";
import { loadTenantAiAgentConfig } from "./tenant-config";
import {
  extractFieldsFromMessage,
  buildMemoryContext,
  COLLECTIBLE_FIELDS,
  createEmptyMemory,
  type ConversationMemory,
} from "./memory";
import { createSafeFallbackResponse } from "./ai-response-schema";
import {
  createDefaultGuardrailPipeline,
  runGuardrailPipeline,
} from "./guardrails";
import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { sendOpenWaText } from "@/lib/integrations/openwa";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { loadQuickReplyTemplates, resolveQuickReply, type ConversationAutomationState, type QuickReplyMessageKind } from "./quick-reply";
import { getSystemSetting } from "@/features/system-settings/queries";
import { resolvePublishedAgentBehavior } from "@/features/agent-training/runtime";
import { evaluateQualification, persistQualificationEvaluation, getNextQualificationQuestion, resolveDeterministicQualificationTurn, type DeterministicQualificationTurn } from "@/features/qualification-engine/service";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { enqueueWahaAiReply } from "@/features/waha-cadence/service";
import { handlePostClosingInboundMessage } from "@/features/ai-qualification/closing-state-service";


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

async function sendAiOutbound(input: {
  tenantId: string;
  phone: string;
  body: string;
  transport: AiTransport;
  openWaSessionId?: string | null;
  wahaRunId?: string | null;
}) {
  if (input.transport === "openwa" && input.openWaSessionId) {
    try {
      const sent = await sendOpenWaText(input.openWaSessionId, input.phone, input.body);
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

  const channel = await getPreferredMetaCloudChannel({ tenantId: input.tenantId });
  if (channel) {
    try {
      const sent = await sendMetaCloudChannelText({ channel, to: input.phone, body: input.body });
      if (sent.messageId) return { status: "sent" as const, messageId: sent.messageId };
    } catch (err) {
      console.warn("[sendAiOutbound] meta cloud failed", err);
    }
  }

  // Fallback para sessão conectada no OpenWA legado se houver
  const db = getDatabase();
  const [openWaConn] = await db
    .select({ sessionId: schema.whatsappConnections.sessionId })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.tenantId, input.tenantId), eq(schema.whatsappConnections.status, "ready")))
    .limit(1);
  if (openWaConn?.sessionId) {
    try {
      const sent = await sendOpenWaText(openWaConn.sessionId, input.phone, input.body);
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

export async function startQualificationConversationForLead(
  input: { tenantId: string; leadId: string; actorUserId: string },
  force: boolean = false
) {
  if ((await getSystemSetting("feature_qualification_engine_enabled")) !== "true") return { started: false as const, reason: "disabled" as const };
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, telefone: schema.leads.telefone, origem: schema.leads.origem, sourceCampaign: schema.leads.sourceCampaign, tipo: schema.leads.tipo, branchId: schema.leads.branchId, nome: schema.leads.nome })
    .from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead?.telefone) return { started: false as const, reason: "missing_phone" as const };
  const behavior = await resolvePublishedAgentBehavior(input.tenantId);
  const { leadMatchesQualificationEntryRules } = await import("@/features/qualification-engine/service");
  if (!leadMatchesQualificationEntryRules({ origem: lead.origem, sourceCampaign: lead.sourceCampaign, tipo: lead.tipo, branchId: lead.branchId }, behavior.policy)) return { started: false as const, reason: "not_eligible" as const };
  const conversation = await getOrCreateAiConversation({ tenantId: input.tenantId, leadId: input.leadId });
  if (!force && !["NEW", "AI_ACTIVE"].includes(conversation.status)) return { started: false as const, reason: "already_started" as const };

  const memory = (conversation.memory as ConversationMemory | null) ?? createEmptyMemory();
  const { resolveDeterministicQualificationTurn } = await import("@/features/qualification-engine/service");
  const turn = resolveDeterministicQualificationTurn({ memory, policy: behavior.policy });

  const firstField = behavior.policy.requiredFields[0];
  const firstQuestion = COLLECTIBLE_FIELDS.find((field) => field.key === firstField)?.promptLabel ?? "nome";
  const defaultGreeting = `Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento. Para começar, qual é o seu ${firstQuestion}?`;
  const body = turn.kind === "collecting" ? turn.reply : defaultGreeting;

  const messageId = `ai_msg_start_${crypto.randomUUID()}`;
  await db.insert(schema.whatsappMessages).values({ id: messageId, tenantId: input.tenantId, leadId: input.leadId, conversationId: conversation.id, senderRole: "assistant", provider: "meta", phone: lead.telefone, direction: "outbound", body, sentAt: new Date() });
  const sent = await sendAiOutbound({ tenantId: input.tenantId, phone: lead.telefone, body, transport: "meta" }).catch(() => ({ status: "failed" as const, messageId: null }));

  if (sent.status === "skipped_no_channel") {
    await db.update(schema.whatsappMessages).set({ providerStatus: "failed" }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
    return { started: false as const, reason: "missing_channel" as const, error: "Nenhum canal do WhatsApp está ativo." };
  }

  await db.update(schema.whatsappMessages).set({ providerStatus: sent.status === "sent" ? "sent" : "failed", messageId: sent.messageId ?? undefined }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
  await db.update(schema.aiConversations).set({ status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", behaviorVersionId: behavior.versionId, memory: { ...memory, lastQuestionAsked: body }, updatedAt: new Date() }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
  await persistQualificationEvaluation({ tenantId: input.tenantId, leadId: input.leadId, conversationId: conversation.id, actorUserId: input.actorUserId, policy: behavior.policy, memory });
  return { started: true as const, conversationId: conversation.id };
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
        qualificationStatus: sql`CASE WHEN ${schema.leads.qualificationStatus} IN ('qualifying', 'pending') THEN 'qualified' ELSE ${schema.leads.qualificationStatus} END`,
        qualificationState: sql`CASE WHEN ${schema.leads.qualificationState} IN ('IN_PROGRESS', 'PENDING') THEN 'QUALIFIED' ELSE ${schema.leads.qualificationState} END`,
        qualificationCompletedAt: sql`COALESCE(${schema.leads.qualificationCompletedAt}, ${now})`,
        updatedAt: now,
      }).where(and(eq(schema.leads.id, convLead.leadId), eq(schema.leads.tenantId, tenantId)));
    } else if (newStatus === "CLOSED") {
      await db.update(schema.leads).set({
        qualificationStatus: sql`CASE WHEN ${schema.leads.qualificationStatus} IN ('qualifying', 'pending') THEN 'cold' ELSE ${schema.leads.qualificationStatus} END`,
        qualificationState: sql`CASE WHEN ${schema.leads.qualificationState} IN ('IN_PROGRESS', 'PENDING') THEN 'NOT_INTERESTED' ELSE ${schema.leads.qualificationState} END`,
        qualificationCompletedAt: sql`COALESCE(${schema.leads.qualificationCompletedAt}, ${now})`,
        updatedAt: now,
      }).where(and(eq(schema.leads.id, convLead.leadId), eq(schema.leads.tenantId, tenantId)));
    }
  }
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
  if (input.memory.planType?.value === "empresarial") leadUpdates.tipo = "PJ";
  if (["individual", "familiar"].includes(input.memory.planType?.value ?? "")) leadUpdates.tipo = "PF";
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
}) {
  const db = getDatabase();
  const now = new Date();
  const isHandoff = input.turn.kind === "handoff";
  const memory = {
    ...input.memory,
    lastQuestionAsked: isHandoff ? undefined : input.turn.reply,
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
  if (isHandoff) {
    const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
    distribution = await distributeQualifiedLead({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: null });
    await transitionConversationState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      newStatus: "WAITING_HUMAN",
      reason: "Qualificação concluída; atendimento encaminhado para a fila comercial.",
    });
    const { executeDeterministicClosing } = await import("@/features/ai-qualification/closing-state-service");
    await executeDeterministicClosing(input.tenantId, input.conversationId, input.leadId, memory.customerName?.value);
  } else {
    await transitionConversationState({ tenantId: input.tenantId, conversationId: input.conversationId, newStatus: "WAITING_CUSTOMER" });
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
  try {
    const sent = await sendAiOutbound({
      tenantId: input.tenantId,
      phone: input.phone,
      body: input.turn.reply,
      transport: input.transport,
      openWaSessionId: input.openWaSessionId,
      wahaRunId: input.wahaRunId,
    });
    if (sent.status === "sent") {
      deliveryStatus = "sent";
      await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId ?? undefined })
        .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
    }
  } catch (error) {
    await db.update(schema.whatsappMessages).set({ providerStatus: "failed" })
      .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, input.tenantId)));
    console.error("[qualification] deterministic_outbound_failed", { tenantId: input.tenantId, leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
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
  }).catch((error) => console.warn("[qualification] attendance_log_failed", { conversationId: input.conversationId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" }));

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

  return { status: isHandoff ? "transferred_to_human" : "replied", deliveryStatus, reply: input.turn.reply };
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
}) {
  const db = getDatabase();

  console.info("[ai-wpp] inbound.received", {
    tenantId,
    leadId,
    messageLength: userMessageBody.length,
    providerMessageId,
  });

  // 1. Obter ou criar conversa
  const conversation = await getOrCreateAiConversation({
    tenantId,
    leadId,
    communicationChannelId,
  });
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
  if (conversation.status === "PAUSED") return { status: "ignored_PAUSED" };
  if (sourceIdentifier) {
    const [quickReplyEvent] = await db.select({ id: schema.aiQuickReplyEvents.id }).from(schema.aiQuickReplyEvents).where(and(eq(schema.aiQuickReplyEvents.tenantId, tenantId), eq(schema.aiQuickReplyEvents.sourceMessageId, sourceIdentifier), eq(schema.aiQuickReplyEvents.conversationId, conversation.id))).limit(1);
    if (quickReplyEvent || conversation.lastProcessedMessageId === sourceIdentifier) return { status: "ignored_duplicate" };
  }

  // 2. Verificar se a IA pode responder
  if (conversation.status === "HUMAN_ACTIVE") {
    console.log(`[ai-agent] Conversa ${conversation.id} está em HUMAN_ACTIVE. Atendimento assumido por humano. IA em silêncio.`);
    return { status: "ignored_human_active" };
  }

  if (conversation.status === "CLOSED" || conversation.status === "FAILED") {
    console.log(`[ai-agent] Conversa ${conversation.id} está ${conversation.status}. IA não responde.`);
    const postClosingResult = await handlePostClosingInboundMessage(tenantId, conversation.id);
    if (postClosingResult.noticeSent && postClosingResult.messageText) {
      await sendAiOutbound({
        tenantId,
        phone,
        body: postClosingResult.messageText,
        transport,
        openWaSessionId,
        wahaRunId,
      });
      return { status: "sent_post_closing_notice" };
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
    currentMessage: userMessageBody,
    historyAlreadyContainsCurrentMessage,
  });
  const hasPriorMessages = pastMessages.some((message) => !sourceIdentifier || message.messageId !== sourceIdentifier);
  const automationState: ConversationAutomationState = conversation.status === "HUMAN_ACTIVE" ? "HUMAN_IN_PROGRESS" : conversation.status === "WAITING_HUMAN" ? "WAITING_HUMAN" : "AI_ACTIVE";
  const quickReplyEnabled = (await getSystemSetting("feature_ai_quick_reply_enabled")) !== "false";
  const quickReply = quickReplyEnabled ? resolveQuickReply({
    body: userMessageBody,
    messageKind,
    conversationState: automationState,
    isNewConversation: conversation.status === "NEW" && !hasPriorMessages,
    hasPriorMessages,
    hasPendingQuestion: Boolean(currentMemory.lastQuestionAsked),
    cooldown: { lastTemplateKey: conversation.quickReplyLastTemplate, lastSentAt: conversation.quickReplyLastSentAt, waitWindowStartedAt: conversation.quickReplyWaitWindowStartedAt, waitResponseCount: conversation.quickReplyWaitResponseCount },
  }) : { resolved: false as const, intent: null, ruleKey: null, templateKey: null, notifyHuman: false };
  if (quickReply.resolved) {
    const templates = await loadQuickReplyTemplates(tenantId);
    const template = quickReply.templateKey ? templates[quickReply.templateKey] : undefined;
    const now = new Date();
    const suppressed = Boolean(quickReply.suppressReason);
    let deliveryStatus = suppressed ? "suppressed_cooldown" : "disabled_template";
    let messageId: string | null = null;
    if (!suppressed && template?.active) {
      messageId = `quick_reply_${crypto.randomUUID()}`;
      await db.insert(schema.whatsappMessages).values({ id: messageId, tenantId, leadId, communicationChannelId: communicationChannelId ?? null, conversationId: conversation.id, senderRole: "assistant", provider: transport, phone, direction: "outbound", body: template.body, sentAt: now });
      try {
        const sent = await sendAiOutbound({ tenantId, phone, body: template.body, transport, openWaSessionId, wahaRunId });
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
    if (quickReply.intent === "REQUEST_HUMAN") {
      await transitionConversationState({
        tenantId,
        conversationId: conversation.id,
        newStatus: "WAITING_HUMAN",
        reason: "Solicitação explícita de atendimento humano",
      });
      await enqueueLeadDistributionJob({ tenantId, leadId }).catch(() => undefined);
    }
    const waitWindowActive = conversation.quickReplyWaitWindowStartedAt && now.getTime() - conversation.quickReplyWaitWindowStartedAt.getTime() < 30 * 60 * 1000;
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
    .select({ nome: schema.leads.nome, tipo: schema.leads.tipo })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  // 6. Extrair campos estruturados da mensagem e atualizar memória
  const updatedMemory = extractFieldsFromMessage(userMessageBody, currentMemory, sourceIdentifier ?? undefined);
  const memoryContext = buildMemoryContext(updatedMemory);
  let qualification = evaluateQualification(updatedMemory, behavior.policy);

  // 6b. Carregar config do tenant para usar mensagens configuráveis e checar flag enabled
  const tenantConfig = await loadTenantAiAgentConfig(tenantId);

  if (detectHumanTransferRequest(userMessageBody)) {
    const handoffMessage = tenantConfig.handoffMessage
      || "Claro. Vou encaminhar seu atendimento para um corretor da equipe agora.";
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
      const sent = await sendAiOutbound({ tenantId, phone, body: handoffMessage, transport, openWaSessionId, wahaRunId });
      deliveryStatus = sent.status;
      if (sent.messageId) {
        await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId })
          .where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      }
    } catch (error) {
      console.error("[ai-wpp] handoff.failed", { tenantId, leadId, transport, error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error" });
    }
    await transitionConversationState({ tenantId, conversationId: conversation.id, newStatus: "WAITING_HUMAN", reason: "Solicitação explícita de atendimento humano" });
    const humanQualification = await persistQualificationEvaluation({ tenantId, leadId, conversationId: conversation.id, actorUserId: null, policy: behavior.policy, memory: updatedMemory, reason: "human_requested" });
    if ((await getSystemSetting("feature_distribution_by_qualification_enabled")) === "true") {
      await enqueueLeadDistributionJob({ tenantId, leadId }).catch(() => undefined);
    }
    console.info("[qualification] human_requested", { tenantId, leadId, conversationId: conversation.id, state: humanQualification.state, score: humanQualification.score });
    return { status: "transferred_to_human", deliveryStatus, reply: handoffMessage };
  }

  // 6c. IA desativada para o tenant: silêncio. Pedidos explícitos de humano
  // (bloco acima) são sempre honrados, mesmo com a IA desligada.
  if (!tenantConfig.enabled) {
    console.info("[ai-wpp] ai_disabled_by_tenant", { tenantId, leadId });
    return { status: "ignored_ai_disabled" };
  }

  const deterministicTurn = resolveDeterministicQualificationTurn({
    memory: updatedMemory,
    policy: behavior.policy,
    handoffMessage: tenantConfig.handoffMessage,
  });
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
      const sent = await sendAiOutbound({ tenantId, phone, body: fallbackMessage, transport, openWaSessionId, wahaRunId });
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
      const sent = await sendAiOutbound({ tenantId, phone, body: safeFallback.message, transport, openWaSessionId, wahaRunId });
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
      status: "success",
      sourceMessageId: sourceIdentifier ?? null,
    });
  } catch (logErr) {
    console.warn("[ai-agent] Failed to insert aiAttendanceLogs:", logErr);
  }

  // Merge any memory updates proposed by the LLM (from aiResult.structured)
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
        if (!updatedMemory.companyHasCnpj || confidence >= (updatedMemory.companyHasCnpj.confidence ?? 0)) {
          updatedMemory.companyHasCnpj = { value: val, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
          addField("companyHasCnpj");
        }
      }
    }
  }

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
  if (persistedQualification.state === "QUALIFIED") {
    try {
      const { distributeQualifiedLead } = await import("@/features/lead-distribution/service");
      const distResult = await distributeQualifiedLead({ tenantId, leadId, actorUserId: null });

      const { executeDeterministicClosing } = await import("@/features/ai-qualification/closing-state-service");
      await executeDeterministicClosing(tenantId, conversation.id, leadId, updatedMemory.customerName?.value);

      console.info("[qualification] completed_and_routed", {
        tenantId,
        leadId,
        conversationId: conversation.id,
        classification: persistedQualification.classification,
        score: persistedQualification.score,
        distributed: distResult.distributed,
        brokerId: distResult.brokerId ?? null,
      });
    } catch (distErr) {
      console.error("[qualification] error_during_distribution_or_closing", distErr);
    }
  }


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
  try {
    const sent = await sendAiOutbound({ tenantId, phone, body: aiResult.content, transport, openWaSessionId, wahaRunId });
    if (sent.status === "sent") {
      await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId ?? undefined }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      deliveryStatus = "sent";
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

  if (aiResult.shouldTransferToHuman) {
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
