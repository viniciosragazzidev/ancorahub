import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { generateAiResponse, detectLanguage } from "./service";
import { loadTenantAiAgentConfig } from "./tenant-config";
import {
  extractFieldsFromMessage,
  buildMemoryContext,
  createEmptyMemory,
  isCoreQualificationComplete,
  type ConversationMemory,
} from "./memory";
import { createSafeFallbackResponse } from "./ai-response-schema";
import {
  createDefaultGuardrailPipeline,
  runGuardrailPipeline,
} from "./guardrails";
import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";

export type ConversationStatus =
  | "NEW"
  | "AI_ACTIVE"
  | "WAITING_CUSTOMER"
  | "WAITING_HUMAN"
  | "HUMAN_ACTIVE"
  | "CLOSED"
  | "FAILED";

let tablesEnsured = false;
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
    sql`ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'offline'`,
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
  });

  const [created] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);

  return created;
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
}

export async function processInboundAiResponse({
  tenantId,
  leadId,
  phone,
  userMessageBody,
  communicationChannelId,
  providerMessageId,
  whatsappMessageId,
}: {
  tenantId: string;
  leadId: string;
  phone: string;
  userMessageBody: string;
  communicationChannelId?: string | null;
  providerMessageId?: string | null;
  whatsappMessageId?: string | null;
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

  const sourceIdentifier = providerMessageId || whatsappMessageId;
  if (sourceIdentifier) {
    await db.update(schema.whatsappMessages)
      .set({ conversationId: conversation.id })
      .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.messageId, sourceIdentifier)));
  }

  // 2. Verificar se a IA pode responder
  if (conversation.status === "HUMAN_ACTIVE") {
    console.log(`[ai-agent] Conversa ${conversation.id} está em HUMAN_ACTIVE. Atendimento assumido por humano. IA em silêncio.`);
    return { status: "ignored_human_active" };
  }

  if (conversation.status === "CLOSED" || conversation.status === "FAILED") {
    console.log(`[ai-agent] Conversa ${conversation.id} está ${conversation.status}. IA não responde.`);
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
  const [claimed] = await db
    .update(schema.aiConversations)
    .set({
      status: "AI_ACTIVE",
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

  // Buscar dados do lead para contextualizar a IA
  const [lead] = await db
    .select({ nome: schema.leads.nome, tipo: schema.leads.tipo })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  // 6. Extrair campos estruturados da mensagem e atualizar memória
  const currentMemory: ConversationMemory =
    (conversation.memory as ConversationMemory | null) ?? createEmptyMemory();
  const updatedMemory = extractFieldsFromMessage(userMessageBody, currentMemory, sourceIdentifier ?? undefined);
  const memoryContext = buildMemoryContext(updatedMemory);

  // 7. Detectar idioma da mensagem do usuário
  const detectedLanguage = detectLanguage(userMessageBody);

  // 7b. Carregar configurações do tenant
  const tenantConfig = await loadTenantAiAgentConfig(tenantId);

  // 7c. Buscar nome do tenant para personalizar o prompt
  const [tenantInfo] = await db
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  // 8. Chamar gerador de resposta da IA com contexto de memória + configs tenant
  const aiResult = await generateAiResponse({
    tenantId,
    leadName: lead?.nome,
    leadType: lead?.tipo,
    messages: historyAlreadyContainsCurrentMessage ? formattedHistory : [...formattedHistory, { role: "user", content: userMessageBody }],
    preferredLanguage: detectedLanguage,
    memoryContext,
    tenantConfig,
    tenantName: tenantInfo?.name,
  });

  // Once the six core fields are present, qualification is complete. The
  // handoff is deterministic so an incorrect model question cannot reopen the
  // questionnaire after the e-mail was received.
  if (isCoreQualificationComplete(updatedMemory)) {
    const handoffMessage = "Obrigado! Já tenho os dados necessários. Vou encaminhar seu atendimento para um corretor da equipe agora.";
    aiResult.content = handoffMessage;
    aiResult.shouldTransferToHuman = true;
    aiResult.transferReason = "Qualificação concluída";
    if (aiResult.structured) {
      aiResult.structured.message = handoffMessage;
      aiResult.structured.shouldTransfer = true;
      aiResult.structured.questionAsked = null;
    }
  }

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
        provider: "meta",
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
      const channel = await getPreferredMetaCloudChannel({ tenantId });
      if (channel) {
        await sendMetaCloudChannelText({
          channel,
          to: phone,
          body: fallbackMessage,
        });
        console.info("[ai-wpp] fallback.sent", { tenantId, leadId, phone });
      } else {
        console.warn("[ai-wpp] fallback.skipped_no_channel", { tenantId, leadId });
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
      provider: "meta",
      phone,
      direction: "outbound",
      body: safeFallback.message,
      sentAt: new Date(),
    });

    let fallbackDeliveryStatus = "failed";
    try {
      const channel = await getPreferredMetaCloudChannel({ tenantId });
      if (channel) {
        const sent = await sendMetaCloudChannelText({ channel, to: phone, body: safeFallback.message });
        await db.update(schema.whatsappMessages)
          .set({ providerStatus: "sent", messageId: sent.messageId })
          .where(and(eq(schema.whatsappMessages.id, fallbackMessageId), eq(schema.whatsappMessages.tenantId, tenantId)));
        fallbackDeliveryStatus = "sent";
        console.info("[ai-wpp] guardrail_fallback.sent", { tenantId, leadId, conversationId: conversation.id, code: pipelineResult.code });
      } else {
        console.warn("[ai-wpp] guardrail_fallback.skipped_no_channel", { tenantId, leadId, conversationId: conversation.id });
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
        if (!updatedMemory.age || confidence >= (updatedMemory.age.confidence ?? 0)) {
          updatedMemory.age = { value, confidence: confidence as 0 | 1, sourceMessageId: sourceIdentifier ?? undefined };
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
      console.info("[ai-agent] Lead information updated in database from memory:", { leadId, leadUpdates });
    }
  } catch (leadUpdateErr) {
    console.error("[ai-agent] Failed to update lead details from memory in database:", leadUpdateErr);
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
    provider: "meta",
    phone,
    direction: "outbound",
    body: aiResult.content,
    sentAt: new Date(),
  });

  // 8. Tentar enviar mensagem de saída pelo provedor da Meta se canal ativo
  let deliveryStatus = "failed";
  try {
    const channel = await getPreferredMetaCloudChannel({ tenantId });
    if (channel) {
      const sent = await sendMetaCloudChannelText({
        channel,
        to: phone,
        body: aiResult.content,
      });
      await db.update(schema.whatsappMessages).set({ providerStatus: "sent", messageId: sent.messageId }).where(and(eq(schema.whatsappMessages.id, messageId), eq(schema.whatsappMessages.tenantId, tenantId)));
      deliveryStatus = "sent";
      console.info("[ai-wpp] outbound.sent", { tenantId, leadId, conversationId: conversation.id, messageId: sent.messageId });
    } else {
      console.warn("[ai-wpp] outbound.skipped", { tenantId, leadId, reason: "no_active_meta_channel" });
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
}
