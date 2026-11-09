import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, lt, ne, or } from "drizzle-orm";
import { after } from "next/server";
import { runGateway } from "@/features/ai-gateway/gateway";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getDatabase, schema } from "@/shared/db";
import { enqueueMetaTemplateMessage, enqueueMetaTextMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { POST_SALE_META_TEMPLATE } from "./template-contract";
import { postSaleAlertReasons } from "./alert-rules";
import { ensurePostSaleSurveyAlerts } from "./alert-service";
import { businessHoursBetween, detectPostSaleKeywords, isActivePostSaleSurvey, postSaleAnswerSchema, postSaleNextTurn, type PostSaleAnswers } from "./conversation-rules";
import { postSaleMediaReply, requestPostSaleTextOnceAtStep, retryPostSaleOperation, runPostSaleOptOutTransaction, type PostSaleMessageKind } from "./conversation-operations";
import { classifyR0AnswerByKeywords, r0AnswerSchema, r0NextTurn, r0TimelineSummary, readR0State, R0_RULE_KEY, type R0Answer, type R0SurveyState } from "./r0-rules";

const ACTIVE_STATUSES = ["sent", "answering"] as const;
const SURVEY_WINDOW_MS = 5 * 86_400_000;
const REMINDER_BUSINESS_MS = 24 * 3_600_000;
type PostSaleWriteExecutor = Pick<ReturnType<typeof getDatabase>, "insert" | "update">;

export type PostSaleInbound = {
  tenantId: string;
  leadId: string;
  channelType: "waha" | "meta";
  channelRef: string;
  text: string;
  providerMessageId: string;
  messageKind?: PostSaleMessageKind;
};

async function extractPostSaleAnswer(input: { tenantId: string; step: number; question: string; text: string }): Promise<PostSaleAnswers> {
  const fallback = detectPostSaleKeywords(input.text, input.question);
  try {
    const result = await runGateway({
      profile: "interpreter",
      purpose: "post_sale_interpretation",
      tenantId: input.tenantId,
      userId: "post-sale-survey",
      sensitive: true,
      temperature: 0,
      maxTokens: 450,
      timeoutMs: 6_000,
      totalTimeoutMs: 12_000,
      maxAttempts: 2,
      schema: postSaleAnswerSchema,
      messages: [
        { role: "system", content: `Extraia somente os fatos explicitamente ditos na resposta, considerando a pergunta ${input.step}: ${input.question}. Não escreva uma resposta ao cliente. Não estime valores, preço ou cobertura. Para campo desconhecido, use null ou unknown. Opt-out só quando a pessoa pede claramente para não receber contato.` },
        { role: "user", content: input.text.slice(0, 2_000) },
      ],
    });
    if (result.ok) return postSaleAnswerSchema.parse(result.value);
  } catch (error) {
    console.warn("[post-sale-audit] interpreter_fallback", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
  return fallback;
}

async function extractR0Answer(input: { tenantId: string; text: string }): Promise<R0Answer> {
  const fallback = classifyR0AnswerByKeywords(input.text);
  try {
    const result = await runGateway({
      profile: "interpreter",
      purpose: "post_sale_interpretation",
      tenantId: input.tenantId,
      userId: "post-sale-survey",
      sensitive: true,
      temperature: 0,
      maxTokens: 300,
      timeoutMs: 6_000,
      totalTimeoutMs: 12_000,
      maxAttempts: 2,
      schema: r0AnswerSchema,
      messages: [
        { role: "system", content: "O cliente já tinha falado com um corretor e voltou a escrever. A pergunta foi: você chegou a ser atendido e recebeu a cotação? Classifique a resposta em category: not_attended (não foi atendido ou não recebeu cotação), wants_more (foi atendido e quer cotação nova, ajuste ou tirar dúvida), closed_or_gave_up (já fechou, inclusive com outra empresa, ou desistiu; informe closedKind closed_elsewhere ou gave_up), other_subject (outro assunto). request: o pedido do cliente em poucas palavras, ou null. reason: motivo de desistência, se dito. optOut só quando a pessoa pede claramente para não receber mensagens. Não escreva resposta ao cliente e não estime valores." },
        { role: "user", content: input.text.slice(0, 2_000) },
      ],
    });
    if (result.ok) return r0AnswerSchema.parse(result.value);
  } catch (error) {
    console.warn("[post-sale-audit] r0_interpreter_fallback", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
  return fallback;
}

async function enqueueSurveyReply(survey: typeof schema.postSaleSurveys.$inferSelect, body: string, idempotencyKey: string) {
  if (!survey.channelType || !survey.channelRef) throw new Error("Canal original da pesquisa indisponível.");
  const requestedBy = await resolveSystemUserId(survey.tenantId);
  if (survey.channelType === "waha") {
    return enqueuePostSaleSurveyWahaMessage({ tenantId: survey.tenantId, leadId: survey.leadId, wahaNumberId: survey.channelRef, destinationPhone: survey.phone, body, requestedBy, idempotencyKey });
  }
  return enqueueMetaTextMessage({ tenantId: survey.tenantId, channelId: survey.channelRef, recipientType: "lead", recipientId: survey.leadId, destinationPhone: survey.phone, body, requestedBy, purpose: "postSaleSurvey", idempotencyKey });
}

function postSaleInteractionId(surveyId: string, providerMessageId: string) {
  const digest = createHash("sha256").update(`${surveyId}:${providerMessageId}`).digest("hex");
  return `post-sale-${digest}`;
}

async function finalizeProcessedTurn(survey: typeof schema.postSaleSurveys.$inferSelect) {
  const providerMessageId = survey.lastInboundMessageId;
  if (!providerMessageId) return;
  const db = getDatabase();
  const now = new Date();
  const answers = (survey.answers ?? {}) as PostSaleAnswers;
  await ensurePostSaleSurveyAlerts(survey);
  if (survey.status === "opted_out") {
    await db.update(schema.aiConversations).set({ optOutAt: now, updatedAt: now }).where(and(eq(schema.aiConversations.tenantId, survey.tenantId), eq(schema.aiConversations.leadId, survey.leadId)));
  }
  // R0 leaves no note on the lead timeline: the broker reads it and must not notice the check (Vinicios, 09/11).
  if ((survey.status === "completed" || survey.status === "opted_out") && survey.ruleKey !== R0_RULE_KEY) {
    const r0State = survey.ruleKey === R0_RULE_KEY ? readR0State(answers) : null;
    const summary = r0State ? r0TimelineSummary({
      outcome: (survey.status === "opted_out" ? "other" : survey.outcome ?? "r0_other") as Parameters<typeof r0TimelineSummary>[0]["outcome"],
      answer: { category: r0State.category ?? "other_subject", closedKind: r0State.closedKind ?? null, request: r0State.request ?? null, reason: r0State.reason ?? null },
      trigger: r0State.trigger ?? null,
    }) : [
      `Pesquisa de pós-venda ${survey.status === "opted_out" ? "encerrada por opt-out" : "concluída"}.`,
      answers.contacted === true ? "Corretor fez contato." : answers.contacted === false ? "Cliente informou que não houve contato." : null,
      answers.rating ? `Nota ${answers.rating}/5.` : null,
      answers.receivedQuote === true ? "Recebeu cotação." : answers.receivedQuote === false ? "Não recebeu cotação." : null,
      answers.closed === "yes" ? "Informou que fechou." : answers.closed === "no" ? "Informou que não fechou." : null,
      answers.wantsHelp ? "Pediu ajuda da equipe." : null,
      answers.reason ? `Motivo: ${answers.reason.slice(0, 180)}.` : null,
      answers.comment ? `Comentário: ${answers.comment.slice(0, 180)}` : null,
    ].filter(Boolean).join(" ").slice(0, 900);
    const userId = await resolveSystemUserId(survey.tenantId);
    await db.insert(schema.leadInteractions).values({
      id: postSaleInteractionId(survey.id, providerMessageId),
      leadId: survey.leadId,
      userId,
      tipo: "note",
      conteudo: summary,
      metadata: { source: "post_sale_audit", surveyId: survey.id, providerMessageId, outcome: survey.outcome ?? "other", ...(survey.ruleKey ? { ruleKey: survey.ruleKey } : {}) },
      createdAt: now,
    }).onConflictDoNothing();
  }
  if (!survey.pendingReplyText) return;
  const replyText = survey.pendingReplyText;
  await enqueueSurveyReply(survey, replyText, `post-sale-reply:${survey.id}:${providerMessageId}`);
  await db.update(schema.postSaleSurveys).set({ pendingReplyText: null }).where(and(
    eq(schema.postSaleSurveys.id, survey.id),
    eq(schema.postSaleSurveys.tenantId, survey.tenantId),
    eq(schema.postSaleSurveys.lastInboundMessageId, providerMessageId),
    eq(schema.postSaleSurveys.pendingReplyText, replyText),
  ));
}

export async function handlePostSaleInbound(input: PostSaleInbound): Promise<boolean> {
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") return false;
  const db = getDatabase();
  const cutoff = new Date(Date.now() - SURVEY_WINDOW_MS);
  const [survey] = await db.select().from(schema.postSaleSurveys).where(and(
    eq(schema.postSaleSurveys.tenantId, input.tenantId),
    eq(schema.postSaleSurveys.leadId, input.leadId),
    eq(schema.postSaleSurveys.channelType, input.channelType),
    eq(schema.postSaleSurveys.channelRef, input.channelRef),
    gte(schema.postSaleSurveys.sentAt, cutoff),
    inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]),
  )).orderBy(desc(schema.postSaleSurveys.sentAt), desc(schema.postSaleSurveys.createdAt)).limit(1);
  if (!survey || !isActivePostSaleSurvey(survey, { channelType: input.channelType, channelRef: input.channelRef })) return false;
  const work = async () => {
    try {
      await retryPostSaleOperation(
        () => processPostSaleAnswer(input, survey),
        (error, attempt) => console.error("[post-sale-audit] inbound_processing_retry", {
          tenantId: input.tenantId,
          leadId: input.leadId,
          providerMessageId: input.providerMessageId,
          attempt,
          error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        }),
      );
    } catch (error) {
      console.error("[post-sale-audit] inbound_processing_exhausted", {
        tenantId: input.tenantId,
        leadId: input.leadId,
        providerMessageId: input.providerMessageId,
        error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
    }
  };
  try {
    after(work);
  } catch {
    await work();
  }
  return true;
}

async function processPostSaleAnswer(input: PostSaleInbound, survey: typeof schema.postSaleSurveys.$inferSelect) {
  const db = getDatabase();
  let [currentSurvey] = await db.select().from(schema.postSaleSurveys).where(and(
    eq(schema.postSaleSurveys.id, survey.id),
    eq(schema.postSaleSurveys.tenantId, input.tenantId),
  )).limit(1);
  if (!currentSurvey) return;
  if (currentSurvey.lastInboundMessageId === input.providerMessageId) {
    await finalizeProcessedTurn(currentSurvey);
    return;
  }
  if (currentSurvey.pendingReplyText) {
    await finalizeProcessedTurn(currentSurvey);
    [currentSurvey] = await db.select().from(schema.postSaleSurveys).where(and(
      eq(schema.postSaleSurveys.id, survey.id),
      eq(schema.postSaleSurveys.tenantId, input.tenantId),
    )).limit(1);
    if (!currentSurvey) return;
  }
  if (!(ACTIVE_STATUSES as readonly string[]).includes(currentSurvey.status)) return;
  const mediaReply = postSaleMediaReply(input.messageKind ?? "text");
  if (mediaReply) {
    await enqueueSurveyMediaPromptOnce(currentSurvey, mediaReply, input);
    return;
  }
  const [lead] = await db.select({ name: schema.leads.nome, tenantId: schema.leads.tenantId }).from(schema.leads).where(and(eq(schema.leads.id, currentSurvey.leadId), eq(schema.leads.tenantId, currentSurvey.tenantId), isNull(schema.leads.deletedAt))).limit(1);
  if (!lead) return;
  if (currentSurvey.ruleKey === R0_RULE_KEY) {
    await processR0Answer(input, currentSurvey, lead.name);
    return;
  }
  const [broker] = currentSurvey.brokerId ? await db.select({ name: schema.user.name }).from(schema.user).innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, currentSurvey.tenantId), eq(schema.tenantMemberships.status, "active"))).where(eq(schema.user.id, currentSurvey.brokerId)).limit(1) : [];
  const prior = (currentSurvey.answers ?? {}) as PostSaleAnswers;
  const question = currentSurvey.step === 0 ? "permissão para fazer duas perguntas" : currentSurvey.step === 1 ? "se o corretor conseguiu falar" : currentSurvey.step === 2 ? "como foi o atendimento" : currentSurvey.step === 3 ? prior.contacted === false ? "se ainda quer ajuda com o plano" : "se recebeu cotação" : currentSurvey.step === 4 ? "se fechou o plano" : "motivo da decisão";
  const answer = await extractPostSaleAnswer({ tenantId: input.tenantId, step: currentSurvey.step, question, text: input.text });
  answer.comment ??= input.text.slice(0, 500);
  const turn = postSaleNextTurn(currentSurvey.step, prior, answer, { lead: lead.name.trim().split(/\s+/)[0] || "Cliente", broker: broker?.name?.trim().split(/\s+/)[0] || "corretor" });
  const answers = turn.answers as PostSaleAnswers;
  const previousAlertReasons = postSaleAlertReasons(currentSurvey);
  const nextOutcome = turn.outcome === "ok" && answers.sentiment === "negative"
    ? "bad_service"
    : turn.outcome ?? currentSurvey.outcome;
  const nextRating = answers.rating ?? currentSurvey.rating;
  const nextAlertReasons = postSaleAlertReasons({ outcome: nextOutcome, rating: nextRating, answers });
  const updateValues = {
    status: turn.status,
    step: turn.step,
    answers,
    outcome: nextOutcome,
    rating: nextRating,
    alertsHandledAt: nextAlertReasons.some((reason) => !previousAlertReasons.includes(reason)) ? null : currentSurvey.alertsHandledAt,
    lastReplyAt: new Date(),
    lastInboundMessageId: input.providerMessageId,
    pendingReplyText: turn.text,
    ...(turn.status === "completed" || turn.status === "opted_out" ? { completedAt: new Date(), outcome: nextOutcome ?? "other" } : {}),
  };
  const updateSurvey = async (executor: PostSaleWriteExecutor) => {
    const [updated] = await executor.update(schema.postSaleSurveys).set(updateValues).where(and(
      eq(schema.postSaleSurveys.id, currentSurvey.id),
      eq(schema.postSaleSurveys.tenantId, input.tenantId),
      eq(schema.postSaleSurveys.step, currentSurvey.step),
      inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]),
      isNull(schema.postSaleSurveys.pendingReplyText),
    )).returning();
    if (!updated) throw new Error("Pesquisa mudou de etapa antes de salvar a resposta.");
    return updated;
  };
  let updated: typeof schema.postSaleSurveys.$inferSelect;
  if (turn.status === "opted_out") {
    updated = await runPostSaleOptOutTransaction<PostSaleWriteExecutor, typeof schema.postSaleSurveys.$inferSelect>({
      transaction: (work) => db.transaction((tx) => work(tx)),
      insertOptOut: async (tx) => {
        await tx.insert(schema.postSaleOptOuts).values({
          id: randomUUID(),
          tenantId: currentSurvey.tenantId,
          leadId: currentSurvey.leadId,
          surveyId: currentSurvey.id,
          channelType: currentSurvey.channelType,
          channelRef: currentSurvey.channelRef,
          providerMessageId: input.providerMessageId,
          createdAt: new Date(),
        }).onConflictDoNothing({ target: [schema.postSaleOptOuts.tenantId, schema.postSaleOptOuts.leadId] });
      },
      updateSurvey: (tx) => updateSurvey(tx),
    });
  } else {
    updated = await updateSurvey(db);
  }
  await finalizeProcessedTurn(updated);
}

/**
 * R0: uma resposta só. Classifica, grava o destino no survey (answers.r0) e responde ao cliente.
 * Não avisa o corretor (pedido de 09/11); o alerta da direção sai pelo ensurePostSaleSurveyAlerts e a
 * escalada de 15 min é feita pela varredura da R0.
 */
async function processR0Answer(input: PostSaleInbound, currentSurvey: typeof schema.postSaleSurveys.$inferSelect, leadName: string) {
  const db = getDatabase();
  const answer = await extractR0Answer({ tenantId: input.tenantId, text: input.text });
  const turn = r0NextTurn(answer, { lead: leadName.trim().split(/\s+/)[0] || "Cliente" });
  const now = new Date();
  const previous = (currentSurvey.answers ?? {}) as Record<string, unknown>;
  const r0: R0SurveyState = {
    ...readR0State(previous),
    category: answer.category,
    closedKind: answer.closedKind ?? null,
    request: answer.request ?? null,
    reason: answer.reason ?? null,
    answeredAt: now.toISOString(),
    awaitsTeam: turn.awaitsTeam,
  };
  const updateValues = {
    status: turn.status,
    answers: { ...previous, r0, comment: input.text.slice(0, 500), ...(answer.optOut ? { optOut: true } : {}) },
    outcome: turn.outcome,
    alertsHandledAt: null,
    lastReplyAt: now,
    lastInboundMessageId: input.providerMessageId,
    pendingReplyText: turn.text,
    completedAt: now,
  };
  const updateSurvey = async (executor: PostSaleWriteExecutor) => {
    const [updated] = await executor.update(schema.postSaleSurveys).set(updateValues).where(and(
      eq(schema.postSaleSurveys.id, currentSurvey.id),
      eq(schema.postSaleSurveys.tenantId, input.tenantId),
      eq(schema.postSaleSurveys.step, currentSurvey.step),
      inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]),
      isNull(schema.postSaleSurveys.pendingReplyText),
    )).returning();
    if (!updated) throw new Error("Pesquisa mudou de etapa antes de salvar a resposta.");
    return updated;
  };
  const updated = turn.status === "opted_out"
    ? await runPostSaleOptOutTransaction<PostSaleWriteExecutor, typeof schema.postSaleSurveys.$inferSelect>({
      transaction: (work) => db.transaction((tx) => work(tx)),
      insertOptOut: async (tx) => {
        await tx.insert(schema.postSaleOptOuts).values({
          id: randomUUID(),
          tenantId: currentSurvey.tenantId,
          leadId: currentSurvey.leadId,
          surveyId: currentSurvey.id,
          channelType: currentSurvey.channelType,
          channelRef: currentSurvey.channelRef,
          providerMessageId: input.providerMessageId,
          createdAt: now,
        }).onConflictDoNothing({ target: [schema.postSaleOptOuts.tenantId, schema.postSaleOptOuts.leadId] });
      },
      updateSurvey: (tx) => updateSurvey(tx),
    })
    : await updateSurvey(db);
  await finalizeProcessedTurn(updated);
}

async function enqueueSurveyMediaPromptOnce(survey: typeof schema.postSaleSurveys.$inferSelect, body: string, input: PostSaleInbound) {
  const db = getDatabase();
  await requestPostSaleTextOnceAtStep({
    step: survey.step,
    claimStep: async (step) => {
      const [claimed] = await db.update(schema.postSaleSurveys).set({ mediaTextPromptStep: step }).where(and(
        eq(schema.postSaleSurveys.id, survey.id),
        eq(schema.postSaleSurveys.tenantId, survey.tenantId),
        eq(schema.postSaleSurveys.step, step),
        inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]),
        or(isNull(schema.postSaleSurveys.mediaTextPromptStep), ne(schema.postSaleSurveys.mediaTextPromptStep, step)),
      )).returning({ id: schema.postSaleSurveys.id });
      return Boolean(claimed);
    },
    send: () => enqueueSurveyReply(survey, body, `post-sale-media:${survey.id}:${survey.step}`),
    releaseStep: async (step) => db.update(schema.postSaleSurveys).set({ mediaTextPromptStep: null }).where(and(
      eq(schema.postSaleSurveys.id, survey.id),
      eq(schema.postSaleSurveys.tenantId, survey.tenantId),
      eq(schema.postSaleSurveys.step, step),
      eq(schema.postSaleSurveys.mediaTextPromptStep, step),
    )),
    onFailure: (error, attempt) => console.error("[post-sale-audit] media_reply_retry", {
        tenantId: input.tenantId,
        leadId: input.leadId,
        providerMessageId: input.providerMessageId,
        attempt,
        error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      }),
  });
}

export async function runPostSaleReminderJob(now = new Date()) {
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") return { enqueued: 0, completed: 0 };
  const db = getDatabase();
  const active = await db.select().from(schema.postSaleSurveys).where(and(inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]), isNull(schema.postSaleSurveys.reminderSentAt), isNull(schema.postSaleSurveys.lastReplyAt), isNull(schema.postSaleSurveys.completedAt), lt(schema.postSaleSurveys.sentAt, new Date(now.getTime() - 24 * 3_600_000)))).orderBy(asc(schema.postSaleSurveys.sentAt)).limit(200);
  let enqueued = 0;
  let completed = 0;
  for (const survey of active) {
    if (!survey.sentAt || businessHoursBetween(survey.sentAt, now) < REMINDER_BUSINESS_MS) continue;
    // R0 é reativa a uma mensagem do cliente: sem lembrete (no Meta seria o template da pesquisa).
    // Sem resposta em 24 h úteis, encerra como "sem resposta".
    if (survey.ruleKey === R0_RULE_KEY) {
      await db.update(schema.postSaleSurveys).set({ status: "no_reply", completedAt: now }).where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId), inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]), isNull(schema.postSaleSurveys.lastReplyAt)));
      completed += 1;
      continue;
    }
    const key = `post-sale-reminder:${survey.id}`;
    const [existing] = await db.select({ id: schema.whatsappOutboundMessages.id, status: schema.whatsappOutboundMessages.status }).from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, survey.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, key))).limit(1);
    if (!existing) {
      const [lead] = await db.select({ name: schema.leads.nome }).from(schema.leads).where(and(eq(schema.leads.id, survey.leadId), eq(schema.leads.tenantId, survey.tenantId))).limit(1);
      const [campaign] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, survey.tenantId)).limit(1);
      const [broker] = survey.brokerId ? await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, survey.brokerId)).limit(1) : [];
      try {
        if (survey.channelType === "meta") {
          const requestedBy = await resolveSystemUserId(survey.tenantId);
          await enqueueMetaTemplateMessage({ tenantId: survey.tenantId, channelId: survey.channelRef ?? undefined, recipientType: "lead", recipientId: survey.leadId, destinationPhone: survey.phone, purpose: "postSaleSurvey", variables: [(lead?.name ?? "Cliente").split(/\s+/)[0]!, campaign?.name ?? "nossa equipe", (broker?.name ?? "nosso corretor").split(/\s+/)[0]!], requestedBy, idempotencyKey: key, requireApprovedMetaTemplate: true, templateName: POST_SALE_META_TEMPLATE.name, strictSourceChannel: true });
        } else if (survey.channelType === "waha") {
          await enqueueSurveyReply(survey, `Oi, ${(lead?.name ?? "Cliente").split(/\s+/)[0]}! Passando para saber se você pode responder nossa pesquisa rápida de atendimento quando puder.`, key);
        }
        enqueued += 1;
      } catch (error) {
        console.error("[post-sale-audit] reminder_enqueue_failed", { surveyId: survey.id, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
      }
      continue;
    }
    if (existing && ["failed", "cancelled", "expired", "skipped"].includes(existing.status)) {
      await db.update(schema.postSaleSurveys).set({ status: "no_reply", completedAt: now, skipReason: "lembrete não pôde ser entregue" }).where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId), inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES])));
      completed += 1;
      continue;
    }
    const elapsed = survey.reminderSentAt ? businessHoursBetween(survey.reminderSentAt, now) : 0;
    if (survey.reminderSentAt && elapsed >= REMINDER_BUSINESS_MS && (!survey.lastReplyAt || survey.lastReplyAt <= survey.reminderSentAt)) {
      await db.update(schema.postSaleSurveys).set({ status: "no_reply", completedAt: now }).where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId), inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]), or(isNull(schema.postSaleSurveys.lastReplyAt), lte(schema.postSaleSurveys.lastReplyAt, survey.reminderSentAt))));
      completed += 1;
    }
  }
  const reminded = await db.select().from(schema.postSaleSurveys).where(and(inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]), isNotNull(schema.postSaleSurveys.reminderSentAt))).limit(200);
  for (const survey of reminded) {
    if (survey.reminderSentAt && businessHoursBetween(survey.reminderSentAt, now) >= REMINDER_BUSINESS_MS && (!survey.lastReplyAt || survey.lastReplyAt <= survey.reminderSentAt)) {
      await db.update(schema.postSaleSurveys).set({ status: "no_reply", completedAt: now }).where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId), inArray(schema.postSaleSurveys.status, [...ACTIVE_STATUSES]), or(isNull(schema.postSaleSurveys.lastReplyAt), lte(schema.postSaleSurveys.lastReplyAt, survey.reminderSentAt))));
      completed += 1;
    }
  }
  return { enqueued, completed };
}
