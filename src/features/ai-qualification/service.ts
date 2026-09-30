import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { aiComplete } from "@/features/ai/engine";
import {
  enqueueAndProcessMetaEventMessage,
  enqueueMetaTextMessage,
  processMetaOutboundBatch,
} from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { startQualificationConversationForLead } from "@/features/ai-agent/conversation-state-machine";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getColdLeadInboundAction, isEligibleColdLeadForReactivation } from "./cold-lead-reactivation-policy";
import { reopenColdLeadForQualification } from "@/features/qualification-engine/cold-lead-reopen";
import { parseOptOut, parseWrongNumber, type QuickReplyMessageKind } from "@/features/ai-agent/quick-reply";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

const questions = [
  { key: "city", prompt: "Para começar, em qual cidade você pretende contratar o plano?" },
  { key: "plan", prompt: "Você procura um plano individual ou para sua empresa?" },
  { key: "beneficiaries", prompt: "Quantas pessoas você pretende incluir no plano?" },
  { key: "urgency", prompt: "Quando você gostaria de receber uma proposta: hoje, nesta semana ou apenas está pesquisando?" },
] as const;

const aiReplySchema = z.object({
  value: z.string().trim().max(500).nullable().default(null),
  valid: z.boolean().default(true),
  message: z.string().trim().max(600).nullable().default(null),
}).passthrough();

type QualificationData = Record<string, string>;

function parseData(value: unknown): QualificationData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

async function qualificationEnabled() {
  const [feature, engine] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.AI_WHATSAPP_QUALIFICATION),
    getFeatureFlag(FEATURE_FLAGS.AI_ENABLED),
  ]);
  return feature !== "false" && feature !== "disabled" && engine !== "false";
}

async function getOrCreateConfig(tenantId: string) {
  const db = getDatabase();
  const [existing] = await db.select().from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenantId)).limit(1);
  if (existing) return existing;
  const now = new Date();
  const [created] = await db.insert(schema.aiQualificationConfigs).values({
    id: randomUUID(), tenantId, enabled: await qualificationEnabled(),
    assistantName: "Assistente Âncora Corretora",
    initialMessage: "Olá! Sou o assistente virtual da Âncora Corretora. Vou fazer algumas perguntas rápidas para preparar seu atendimento. Você pode pedir um atendente humano a qualquer momento.",
    timeoutMinutes: 30, maxRetries: 2, createdAt: now, updatedAt: now,
  }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenantId)).limit(1))[0] ?? null;
}

export async function startAiQualificationForLead(input: { tenantId: string; leadId: string; actorUserId: string; force?: boolean }) {
  // Automatic starts (intake, imports) must respect the queue's own switch; only
  // an explicit operator action (force) may qualify a lead of a disabled queue.
  if (!input.force) {
    const [queue] = await getDatabase()
      .select({ aiQualificationEnabled: schema.leadQueues.aiQualificationEnabled })
      .from(schema.leads)
      .innerJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    if (queue && queue.aiQualificationEnabled === false) return { started: false as const, reason: "queue_disabled" as const };
  }
  if ((await getFeatureFlag(FEATURE_FLAGS.QUALIFICATION_ENGINE)) !== "false") {
    return await startQualificationConversationForLead(input, input.force).catch(() => ({ started: false as const, reason: "failed" as const }));
  }
  const db = getDatabase();
  const config = await getOrCreateConfig(input.tenantId);
  const globalEnabled = await qualificationEnabled();
  if (!globalEnabled || !config) return { started: false, reason: "disabled" as const };
  if (config && !config.enabled) {
    await db.update(schema.aiQualificationConfigs).set({ enabled: true, updatedAt: new Date() }).where(and(eq(schema.aiQualificationConfigs.id, config.id), eq(schema.aiQualificationConfigs.tenantId, input.tenantId)));
  }
  const [lead] = await db.select({ id: schema.leads.id, phone: schema.leads.telefone, nome: schema.leads.nome }).from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead?.phone) return { started: false, reason: "missing_phone" as const };
  let [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, input.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.status, "active"), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1);
  if (!channel) {
    [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, input.tenantId), eq(schema.communicationChannels.status, "active"))).limit(1);
  }
  if (!channel) return { started: false, reason: "missing_channel" as const };
  const existing = await db.select({ id: schema.aiQualificationSessions.id, status: schema.aiQualificationSessions.status }).from(schema.aiQualificationSessions).where(and(eq(schema.aiQualificationSessions.tenantId, input.tenantId), eq(schema.aiQualificationSessions.leadId, input.leadId))).limit(1);
  if (!input.force && existing[0] && !["failed", "expired", "handed_off"].includes(existing[0].status)) return { started: false, reason: "already_started" as const };
  const now = new Date();
  const sessionId = existing[0]?.id ?? randomUUID();
  const expiresAt = new Date(now.getTime() + config.timeoutMinutes * 60_000);
  await db.insert(schema.aiQualificationSessions).values({ id: sessionId, tenantId: input.tenantId, leadId: input.leadId, status: "waiting_customer", currentQuestionKey: questions[0].key, collectedData: {}, missingFields: questions.map((question) => question.key), expiresAt, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: [schema.aiQualificationSessions.tenantId, schema.aiQualificationSessions.leadId], set: { status: "waiting_customer", currentQuestionKey: questions[0].key, collectedData: {}, missingFields: questions.map((question) => question.key), expiresAt, failureReason: null, retryCount: 0, updatedAt: now } });
  
  let finalBody = `${config.initialMessage}\n\n${questions[0].prompt}`;
  let queuedId: string | undefined = undefined;

  try {
    const { getQualificationTenantSettings } = await import("@/features/ai-qualification/tenant-settings-service");
    const qualificationSettings = await getQualificationTenantSettings(input.tenantId);
    const botName = qualificationSettings?.assistantName?.trim() || "Assistente Âncora Saúde";
    const delivery = await enqueueAndProcessMetaEventMessage({
      tenantId: input.tenantId,
      channelId: channel.id,
      recipientType: "lead",
      recipientId: input.leadId,
      destinationPhone: lead.phone,
      purpose: "leadQualification",
      variables: [lead.nome || "Cliente", botName, "Âncora Saúde"],
      requestedBy: input.actorUserId,
      idempotencyKey: `ai-qualification:${input.leadId}:start:${sessionId}`,
    });
    queuedId = delivery.id;
    if (["sent", "delivered", "read"].includes(delivery.status)) {
      finalBody = delivery.renderedBody ?? delivery.fallbackRenderedBody ?? finalBody;
      await db.insert(schema.whatsappMessages).values({
        id: delivery.providerMessageId || `qualification_start_${randomUUID()}`,
        tenantId: input.tenantId,
        leadId: input.leadId,
        communicationChannelId: delivery.channelId ?? channel.id,
        senderRole: "assistant",
        provider: META_CLOUD_PROVIDER,
        phone: lead.phone,
        direction: "outbound",
        body: finalBody,
        providerStatus: "sent",
        messageId: delivery.providerMessageId ?? undefined,
        sentAt: now,
      }).onConflictDoNothing();
    } else {
      throw new Error(delivery.providerErrorMessage || "A mensagem inicial não foi aceita pelo provedor.");
    }
  } catch (templateError) {
    console.warn("[startAiQualificationForLead] configured first contact failed:", templateError);
    await db.update(schema.aiQualificationSessions).set({
      status: "failed",
      failureReason: "initial_message_dispatch_failed",
      updatedAt: new Date(),
    }).where(and(
      eq(schema.aiQualificationSessions.id, sessionId),
      eq(schema.aiQualificationSessions.tenantId, input.tenantId),
    ));
    return { started: false as const, reason: "initial_message_failed" as const, queuedId };
  }

  await db.update(schema.leads).set({ qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: now }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "ai_qualification_session", entidadeId: sessionId, acao: "ai_qualification.started" });
  return { started: true, sessionId, queuedId };
}

export async function processAiQualificationMessage(input: { tenantId: string; leadId: string; phone: string; text: string; actorUserId: string }) {
  const db = getDatabase();
  const [session] = await db.select().from(schema.aiQualificationSessions).where(and(eq(schema.aiQualificationSessions.tenantId, input.tenantId), eq(schema.aiQualificationSessions.leadId, input.leadId))).limit(1);
  if (!session || !["waiting_customer", "processing"].includes(session.status)) {
    if (!session || ["failed", "expired"].includes(session.status)) {
      const started = await startAiQualificationForLead({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: input.actorUserId }).catch(() => ({ started: false as const }));
      if (started.started) return { processed: true, started: true as const };
    }
    return { processed: false, reason: "no_active_session" as const };
  }
  if (session.expiresAt <= new Date()) {
    await db.update(schema.aiQualificationSessions).set({ status: "expired", failureReason: "timeout", updatedAt: new Date() }).where(and(eq(schema.aiQualificationSessions.id, session.id), eq(schema.aiQualificationSessions.tenantId, input.tenantId)));
    return { processed: false, reason: "expired" as const };
  }
  const [claimed] = await db.update(schema.aiQualificationSessions).set({ status: "processing", version: session.version + 1, updatedAt: new Date() }).where(and(eq(schema.aiQualificationSessions.id, session.id), eq(schema.aiQualificationSessions.tenantId, input.tenantId), eq(schema.aiQualificationSessions.version, session.version), eq(schema.aiQualificationSessions.status, "waiting_customer"))).returning({ id: schema.aiQualificationSessions.id });
  if (!claimed) return { processed: false, reason: "busy" as const };
  const currentIndex = Math.max(0, questions.findIndex((question) => question.key === session.currentQuestionKey));
  const current = questions[currentIndex] ?? questions[0];
  let value = input.text.trim();
  let message: string | null = null;
  try {
    const config = await getOrCreateConfig(input.tenantId);
    let systemPromptOverride = "Você é o qualificador da Âncora Corretora. Não solicite documentos, senhas, CPF ou dados de saúde. Retorne somente JSON válido no formato {value:string|null,valid:boolean,message:string|null}. Valide a resposta para a pergunta indicada e escreva uma orientação curta em português se precisar repetir.";
    if (config?.businessContext?.trim()) {
      systemPromptOverride += `\n\nCONTEXTO E BASE DE CONHECIMENTO DA EMPRESA:\n${config.businessContext.trim()}`;
    }
    if (config?.customInstructions?.trim()) {
      systemPromptOverride += `\n\nDIRETRIZES DE ATUAÇÃO E TOM DE VOZ:\n${config.customInstructions.trim()}`;
    }
    const result = await aiComplete({
      systemPromptOverride,
      maxTokensOverride: 220,
      temperatureOverride: 0.2,
      userMessage: JSON.stringify({ question: current.prompt, answer: input.text }),
    });
    const parsed = aiReplySchema.safeParse(JSON.parse(result.text.replace(/^```json\s*|```$/g, "").trim()));
    if (parsed.success) { value = parsed.data.value ?? ""; message = parsed.data.message; }
  } catch (error) { console.warn("[ai-qualification] response parsing fallback", error); }
  if (!value) {
    await db.update(schema.aiQualificationSessions).set({ status: "waiting_customer", retryCount: session.retryCount + 1, updatedAt: new Date() }).where(eq(schema.aiQualificationSessions.id, session.id));
    const reply = message ?? `Não consegui entender. ${current.prompt}`;
    await queueReply(input, session.id, reply, session.version);
    return { processed: true, completed: false, reply };
  }
  const collected = { ...parseData(session.collectedData), [current.key]: value };
  const next = questions[currentIndex + 1];
  const now = new Date();
  if (!next) {
    const summary = `Cidade: ${collected.city}; plano: ${collected.plan}; pessoas: ${collected.beneficiaries}; urgência: ${collected.urgency}.`;
    await db.update(schema.aiQualificationSessions).set({ status: "completed", collectedData: collected, missingFields: [], score: 100, summary, lastInteractionAt: now, updatedAt: now }).where(and(eq(schema.aiQualificationSessions.id, session.id), eq(schema.aiQualificationSessions.tenantId, input.tenantId)));
    await db.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: input.leadId, userId: input.actorUserId, tipo: "note", conteudo: `Qualificação automática concluída. ${summary}` });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "ai_qualification_session", entidadeId: session.id, acao: "ai_qualification.completed" });
    const reply = "Obrigado! Já tenho as informações iniciais. Um corretor continuará seu atendimento em seguida.";
    await queueReply(input, session.id, reply, session.version);
    return { processed: true, completed: true, reply };
  }
  await db.update(schema.aiQualificationSessions).set({ status: "waiting_customer", currentQuestionKey: next.key, collectedData: collected, missingFields: questions.slice(currentIndex + 2).map((question) => question.key), retryCount: 0, lastInteractionAt: now, updatedAt: now }).where(and(eq(schema.aiQualificationSessions.id, session.id), eq(schema.aiQualificationSessions.tenantId, input.tenantId)));
  const reply = `${message ? `${message}\n\n` : ""}${next.prompt}`;
  await queueReply(input, session.id, reply, session.version);
  return { processed: true, completed: false, reply };
}

/** Resumes the legacy questionnaire from its stored question without resending FIRST_CONTACT. */
export async function resumeColdLeadAiQualificationForLead(input: {
  tenantId: string;
  leadId: string;
  phone: string;
  text: string;
  actorUserId: string;
}) {
  if (!await qualificationEnabled()) return { processed: false as const, reason: "disabled" as const };
  const db = getDatabase();
  const config = await getOrCreateConfig(input.tenantId);
  if (!config?.enabled) return { processed: false as const, reason: "tenant_disabled" as const };
  const [session] = await db.select().from(schema.aiQualificationSessions).where(and(
    eq(schema.aiQualificationSessions.tenantId, input.tenantId),
    eq(schema.aiQualificationSessions.leadId, input.leadId),
  )).limit(1);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.timeoutMinutes * 60_000);

  if (!session) {
    await db.insert(schema.aiQualificationSessions).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      leadId: input.leadId,
      status: "waiting_customer",
      currentQuestionKey: questions[0].key,
      collectedData: {},
      missingFields: questions.map((question) => question.key),
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  } else {
    if (session.status === "processing") return { processed: false as const, reason: "busy" as const };
    const currentQuestionKey = questions.some((question) => question.key === session.currentQuestionKey)
      ? session.currentQuestionKey
      : questions[0].key;
    await db.update(schema.aiQualificationSessions).set({
      status: "waiting_customer",
      currentQuestionKey,
      expiresAt,
      failureReason: null,
      lastInteractionAt: now,
      updatedAt: now,
    }).where(and(
      eq(schema.aiQualificationSessions.id, session.id),
      eq(schema.aiQualificationSessions.tenantId, input.tenantId),
      eq(schema.aiQualificationSessions.status, session.status),
    ));
  }

  return processAiQualificationMessage(input);
}

/** Handles only cold-lead replies; the normal webhook pipeline owns every other lead state. */
export async function handleColdLeadInbound(input: {
  tenantId: string;
  leadId: string;
  phone: string;
  text: string;
  messageKind?: QuickReplyMessageKind;
  communicationChannelId: string;
  providerMessageId: string;
}) {
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationState: schema.leads.qualificationState,
    qualificationCompletedAt: schema.leads.qualificationCompletedAt,
    corretorId: schema.leads.corretorId,
    status: schema.leads.status,
    distributionStatus: schema.leads.distributionStatus,
    distributionRemovedAt: schema.leads.distributionRemovedAt,
    archivedAt: schema.leads.archivedAt,
    deletedAt: schema.leads.deletedAt,
  }).from(schema.leads).where(and(
    eq(schema.leads.id, input.leadId),
    eq(schema.leads.tenantId, input.tenantId),
  )).limit(1);
  if (!lead || lead.qualificationStatus !== "cold") return { handled: false as const };

  const now = new Date();
  const [conversation] = await db.select({ id: schema.aiConversations.id, optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt })
    .from(schema.aiConversations).where(and(
      eq(schema.aiConversations.tenantId, input.tenantId),
      eq(schema.aiConversations.leadId, input.leadId),
    )).orderBy(desc(schema.aiConversations.updatedAt)).limit(1);

  if (parseOptOut(input.text) || parseWrongNumber(input.text)) {
    const wrongNumber = parseWrongNumber(input.text);
    let conversationId = conversation?.id;
    if (!conversationId) {
      const { getOrCreateAiConversation } = await import("@/features/ai-agent/conversation-state-machine");
      const created = await getOrCreateAiConversation({ tenantId: input.tenantId, leadId: input.leadId, communicationChannelId: input.communicationChannelId });
      conversationId = created.id;
    }
    await db.update(schema.aiConversations).set({
      ...(wrongNumber ? { wrongNumberAt: conversation?.wrongNumberAt ?? now } : { optOutAt: conversation?.optOutAt ?? now }),
      lastProcessedMessageId: input.providerMessageId,
      lastActivityAt: now,
      updatedAt: now,
    }).where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.tenantId, input.tenantId)));
    await db.update(schema.whatsappOutboundMessages).set({
      status: "cancelled",
      providerErrorCode: "LEAD_OPTED_OUT",
      providerErrorMessage: "O lead solicitou interrupção; follow-up cancelado.",
      updatedAt: now,
    }).where(and(
      eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
      eq(schema.whatsappOutboundMessages.idempotencyKey, `cold-lead-reactivation:${input.leadId}`),
      inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
    ));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: await resolveSystemUserId(input.tenantId),
      entidade: "lead",
      entidadeId: input.leadId,
      acao: wrongNumber ? "cold_lead_reactivation.wrong_number_recorded" : "cold_lead_reactivation.opt_out_recorded",
      createdAt: now,
    });
    return { handled: true as const, action: wrongNumber ? "wrong_number" as const : "opt_out" as const };
  }

  if (lead.deletedAt || lead.archivedAt || ["lost", "converted"].includes(lead.status)) {
    return { handled: true as const, action: "ignore" as const };
  }

  const featureEnabled = await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) === "true";
  const [owner] = lead.corretorId
    ? await db.select({ role: schema.tenantMemberships.role })
        .from(schema.tenantMemberships).where(and(
          eq(schema.tenantMemberships.tenantId, input.tenantId),
          eq(schema.tenantMemberships.userId, lead.corretorId),
          eq(schema.tenantMemberships.status, "active"),
        )).limit(1)
    : [];
  const action = getColdLeadInboundAction({
    qualificationStatus: lead.qualificationStatus,
    corretorRole: owner?.role ?? null,
    featureEnabled,
    optedOut: Boolean(conversation?.optOutAt || conversation?.wrongNumberAt),
  });

  if (action === "acknowledge_broker") {
    const idempotencyKey = `cold-lead-reactivation-ack:${input.leadId}`;
    const text = "Obrigado por retornar! Um dos corretores que recebeu seu atendimento entrará em contato com você em breve.";
    const queued = await enqueueMetaTextMessage({
      tenantId: input.tenantId,
      channelId: input.communicationChannelId,
      recipientType: "lead",
      recipientId: input.leadId,
      destinationPhone: lead.telefone,
      body: text,
      purpose: "coldLeadReactivationAcknowledgement",
      requestedBy: await resolveSystemUserId(input.tenantId),
      idempotencyKey,
    });
    await processMetaOutboundBatch(1, input.tenantId, queued.id);
    const [delivery] = await db.select({
      id: schema.whatsappOutboundMessages.id,
      channelId: schema.whatsappOutboundMessages.channelId,
      providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
      status: schema.whatsappOutboundMessages.status,
    }).from(schema.whatsappOutboundMessages).where(and(
      eq(schema.whatsappOutboundMessages.id, queued.id),
      eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
    )).limit(1);
    if (!queued.duplicate && delivery && ["sent", "delivered", "read"].includes(delivery.status)) {
      await db.insert(schema.whatsappMessages).values({
        id: delivery.providerMessageId || `cold_reactivation_ack_${randomUUID()}`,
        tenantId: input.tenantId,
        leadId: input.leadId,
        communicationChannelId: delivery.channelId ?? input.communicationChannelId,
        senderRole: "assistant",
        provider: META_CLOUD_PROVIDER,
        phone: lead.telefone,
        direction: "outbound",
        body: text,
        providerStatus: "sent",
        messageId: delivery.providerMessageId ?? undefined,
        sentAt: now,
      }).onConflictDoNothing();
    }
    return { handled: true as const, action };
  }

  if (action !== "resume_qualification" || !isEligibleColdLeadForReactivation(lead)) {
    return { handled: true as const, action: "ignore" as const };
  }
  const useLegacyEngine = await getFeatureFlag(FEATURE_FLAGS.QUALIFICATION_ENGINE) === "false";
  if (useLegacyEngine) {
    if (!await qualificationEnabled()) return { handled: true as const, action: "ignore" as const };
    const legacyConfig = await getOrCreateConfig(input.tenantId);
    if (!legacyConfig?.enabled) return { handled: true as const, action: "ignore" as const };
  }
  const reopened = await reopenColdLeadForQualification({ tenantId: input.tenantId, leadId: input.leadId });
  if (!reopened) return { handled: true as const, action: "ignore" as const };

  const actorUserId = await resolveSystemUserId(input.tenantId);
  if (useLegacyEngine) {
    await resumeColdLeadAiQualificationForLead({
      tenantId: input.tenantId,
      leadId: input.leadId,
      phone: input.phone,
      text: input.text,
      actorUserId,
    });
  } else {
    const { processInboundAiResponse } = await import("@/features/ai-agent/conversation-state-machine");
    await processInboundAiResponse({
      tenantId: input.tenantId,
      leadId: input.leadId,
      phone: input.phone,
      userMessageBody: input.text,
      messageKind: input.messageKind,
      communicationChannelId: input.communicationChannelId,
      providerMessageId: input.providerMessageId,
      skipDebounce: true,
    });
  }
  return { handled: true as const, action };
}

async function queueReply(input: { tenantId: string; leadId: string; phone: string; actorUserId: string }, sessionId: string, body: string, version: number) {
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, input.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.status, "active"), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1);
  if (!channel) return;
  await enqueueMetaTextMessage({ tenantId: input.tenantId, channelId: channel.id, recipientType: "lead", recipientId: input.leadId, destinationPhone: input.phone, body, requestedBy: input.actorUserId, idempotencyKey: `ai-qualification:${sessionId}:reply:${version}:${body.slice(0, 24)}` });
  await db.insert(schema.whatsappMessages).values({
    id: `ai_msg_reply_${randomUUID()}`,
    tenantId: input.tenantId,
    leadId: input.leadId,
    communicationChannelId: channel.id,
    senderRole: "assistant",
    provider: META_CLOUD_PROVIDER,
    phone: input.phone,
    direction: "outbound",
    body,
    providerStatus: "sent",
    sentAt: new Date(),
  }).onConflictDoNothing();
  await processMetaOutboundBatch(1, input.tenantId).catch((error) => console.error("[ai-qualification] reply delivery deferred", error));
}

export async function handoffAiQualification(input: { tenantId: string; leadId: string; actorUserId: string; reason: string }) {
  const db = getDatabase();
  const [updated] = await db.update(schema.aiQualificationSessions).set({ status: "handed_off", failureReason: input.reason.slice(0, 240), updatedAt: new Date() }).where(and(eq(schema.aiQualificationSessions.tenantId, input.tenantId), eq(schema.aiQualificationSessions.leadId, input.leadId), eq(schema.aiQualificationSessions.status, "waiting_customer"))).returning({ id: schema.aiQualificationSessions.id });
  if (updated) await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "ai_qualification_session", entidadeId: updated.id, acao: "ai_qualification.handed_off" });
  return Boolean(updated);
}
