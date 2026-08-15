import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { aiComplete } from "@/features/ai/engine";
import { processMetaOutboundBatch, enqueueMetaTextMessage } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { startQualificationConversationForLead } from "@/features/ai-agent/conversation-state-machine";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";

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
    getSystemSetting("feature_ai_whatsapp_qualification_enabled"),
    getSystemSetting("ai_enabled"),
  ]);
  return feature !== "false" && feature !== "disabled" && engine === "true";
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
  if ((await getSystemSetting("feature_qualification_engine_enabled")) === "true") {
    const engineResult = await startQualificationConversationForLead(input, input.force).catch(() => ({ started: false as const, reason: "failed" as const }));
    if (engineResult.started || engineResult.reason === "missing_channel") return engineResult;
  }
  const db = getDatabase();
  const config = await getOrCreateConfig(input.tenantId);
  const globalEnabled = await qualificationEnabled();
  if (!globalEnabled || !config) return { started: false, reason: "disabled" as const };
  if (config && !config.enabled) {
    await db.update(schema.aiQualificationConfigs).set({ enabled: true, updatedAt: new Date() }).where(and(eq(schema.aiQualificationConfigs.id, config.id), eq(schema.aiQualificationConfigs.tenantId, input.tenantId)));
  }
  const [lead] = await db.select({ id: schema.leads.id, phone: schema.leads.telefone }).from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
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
  const body = `${config.initialMessage}\n\n${questions[0].prompt}`;
  const queued = await enqueueMetaTextMessage({ tenantId: input.tenantId, channelId: channel.id, recipientType: "lead", recipientId: input.leadId, destinationPhone: lead.phone, body, requestedBy: input.actorUserId, idempotencyKey: `ai-qualification:${input.leadId}:start:${Date.now()}` });
  await db.insert(schema.whatsappMessages).values({
    id: `ai_msg_start_${randomUUID()}`,
    tenantId: input.tenantId,
    leadId: input.leadId,
    communicationChannelId: channel.id,
    senderRole: "assistant",
    provider: META_CLOUD_PROVIDER,
    phone: lead.phone,
    direction: "outbound",
    body,
    providerStatus: "sent",
    sentAt: now,
  }).onConflictDoNothing();
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "ai_qualification_session", entidadeId: sessionId, acao: "ai_qualification.started" });
  await processMetaOutboundBatch(1, input.tenantId).catch((error) => console.error("[ai-qualification] initial delivery deferred", error));
  return { started: true, sessionId, queuedId: queued.id };
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
    const result = await aiComplete({
      systemPromptOverride: "Você é o qualificador da Âncora Corretora. Não solicite documentos, senhas, CPF ou dados de saúde. Retorne somente JSON válido no formato {value:string|null,valid:boolean,message:string|null}. Valide a resposta para a pergunta indicada e escreva uma orientação curta em português se precisar repetir.",
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
