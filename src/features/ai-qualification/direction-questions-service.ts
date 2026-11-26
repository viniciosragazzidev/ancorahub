import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import {
  buildTaughtKnowledge,
  canAnswerDirectionQuestions,
  canTeachDirectionAnswers,
  carrierNamedIn,
  cleanDirectionQuestion,
  directionChannelLabel,
  findTaughtAnswer,
  normalizeDirectionQuestion,
  parseExcerpt,
  toExcerptLine,
  validateDirectionAnswer,
  type DirectionAnswerInput,
  type DirectionQuestionRow,
} from "./direction-questions-core";

/**
 * Perguntas para a direção (26/11/2026). Tudo aqui confere a tabela antes (migration 0246): sem ela, registrar devolve
 * false e a IA segue como antes, a lista diz que falta a migration e o contador fica sem número.
 */

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

export async function directionQuestionsReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await getDatabase()
    .execute(sql`select to_regclass('public.ai_direction_questions') is not null as ready`)
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] } | null)?.rows ?? []) as { ready?: unknown }[];
      return rows[0]?.ready === true;
    })
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

const EXCERPT_MESSAGES = 8;

/**
 * Registra a pergunta que a IA não soube responder. Devolve true quando a pergunta está registrada (agora ou já
 * estava aberta nesta conversa): aí a IA responde que vai confirmar. Nunca lança: a qualificação segue sem isto.
 */
export async function recordDirectionQuestion(input: {
  tenantId: string;
  leadId: string;
  conversationId: string;
  phone: string;
  transport: string;
  communicationChannelId?: string | null;
  wahaRunId?: string | null;
  question: string;
}): Promise<boolean> {
  try {
    if (!(await directionQuestionsReady())) return false;
    const question = cleanDirectionQuestion(input.question);
    const normalized = normalizeDirectionQuestion(question);
    if (normalized.length < 3) return false;
    const db = getDatabase();
    const table = schema.aiDirectionQuestions;
    const [already] = await db.select({ id: table.id }).from(table).where(and(
      eq(table.tenantId, input.tenantId),
      eq(table.conversationId, input.conversationId),
      eq(table.normalizedQuestion, normalized),
      eq(table.status, "open"),
    )).limit(1);
    if (already) return true;
    const recent = await db.select({
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      body: schema.whatsappMessages.body,
      sentAt: schema.whatsappMessages.sentAt,
    }).from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, input.tenantId), eq(schema.whatsappMessages.leadId, input.leadId)))
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(EXCERPT_MESSAGES);
    const excerpt = recent.reverse().flatMap((message) => {
      const line = toExcerptLine(message);
      return line ? [line] : [];
    });
    await db.insert(table).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      phone: input.phone,
      transport: input.transport,
      communicationChannelId: input.communicationChannelId ?? null,
      wahaRunId: input.wahaRunId ?? null,
      question,
      normalizedQuestion: normalized,
      excerpt,
      status: "open",
    });
    return true;
  } catch (error) {
    console.warn("[direction-questions] record_failed", { tenantId: input.tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return false;
  }
}

const TAUGHT_LIMIT = 300;

/** Resposta que a direção já ensinou para uma pergunta parecida, ou null. Nunca lança. */
export async function findTaughtDirectionAnswer(tenantId: string, question: string): Promise<string | null> {
  try {
    if (!(await directionQuestionsReady())) return null;
    const table = schema.aiDirectionQuestions;
    const taught = await getDatabase().select({ question: table.question, answer: table.answer }).from(table).where(and(
      eq(table.tenantId, tenantId),
      eq(table.status, "answered"),
      isNotNull(table.taughtDocumentId),
      isNotNull(table.answer),
    )).orderBy(desc(table.answeredAt)).limit(TAUGHT_LIMIT);
    return findTaughtAnswer(question, taught.map((row) => ({ question: row.question, answer: row.answer ?? "" })));
  } catch (error) {
    console.warn("[direction-questions] taught_lookup_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return null;
  }
}

/** Filtro de escopo: diretor vê a empresa, gestor só os leads da unidade (mesma regra dos relatórios). */
async function scopeFor(context: TenantContext) {
  const scope = await resolveReportDataScope(context);
  return scope.leadScope;
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

const LIST_LIMIT = 200;

export type DirectionQuestionsList = { ready: false } | { ready: true; rows: DirectionQuestionRow[] };

export async function listDirectionQuestions(context: TenantContext): Promise<DirectionQuestionsList> {
  if (!(await directionQuestionsReady())) return { ready: false };
  const table = schema.aiDirectionQuestions;
  const leadScope = await scopeFor(context);
  const rows = await getDatabase().select({
    id: table.id,
    createdAt: table.createdAt,
    leadId: table.leadId,
    leadName: schema.leads.nome,
    question: table.question,
    status: table.status,
    answer: table.answer,
    answeredAt: table.answeredAt,
    answeredByName: schema.user.name,
    sentToLeadAt: table.sentToLeadAt,
    taughtDocumentId: table.taughtDocumentId,
    transport: table.transport,
    excerpt: table.excerpt,
  }).from(table)
    .leftJoin(schema.leads, eq(schema.leads.id, table.leadId))
    .leftJoin(schema.user, eq(schema.user.id, table.answeredBy))
    .where(and(eq(table.tenantId, context.tenantId), leadScope))
    .orderBy(desc(table.createdAt))
    .limit(LIST_LIMIT);
  return { ready: true, rows: rows.map(toRow) };
}

function toRow(row: {
  id: string; createdAt: Date | string; leadId: string | null; leadName: string | null; question: string; status: string;
  answer: string | null; answeredAt: Date | string | null; answeredByName: string | null; sentToLeadAt: Date | string | null;
  taughtDocumentId: string | null; transport: string; excerpt: unknown;
}): DirectionQuestionRow {
  return {
    id: row.id,
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    leadId: row.leadId,
    leadName: row.leadName,
    question: row.question,
    status: row.status === "answered" ? "answered" : "open",
    answer: row.answer,
    answeredAt: iso(row.answeredAt),
    answeredByName: row.answeredByName,
    sentToLeadAt: iso(row.sentToLeadAt),
    taught: Boolean(row.taughtDocumentId),
    transport: row.transport,
    excerpt: parseExcerpt(row.excerpt),
  };
}

/** Contador do menu: perguntas abertas no escopo de quem vê. Sem a tabela, zero (o menu não mostra número). */
export async function countOpenDirectionQuestions(context: TenantContext): Promise<number> {
  if (!canAnswerDirectionQuestions(context.role, context.jobTitle)) return 0;
  if (!(await directionQuestionsReady())) return 0;
  const table = schema.aiDirectionQuestions;
  const leadScope = await scopeFor(context);
  const [row] = await getDatabase().select({ value: count() }).from(table)
    .leftJoin(schema.leads, eq(schema.leads.id, table.leadId))
    .where(and(eq(table.tenantId, context.tenantId), eq(table.status, "open"), leadScope));
  return Number(row?.value ?? 0);
}

export type StoredDirectionQuestion = {
  id: string;
  tenantId: string;
  leadId: string | null;
  phone: string | null;
  transport: string;
  conversationId: string | null;
  communicationChannelId: string | null;
  wahaRunId: string | null;
  question: string;
  status: string;
};

/** Portas da resposta: o banco e o envio. Os testes trocam por dublês. */
export type DirectionAnswerPorts = {
  load: (context: TenantContext, id: string) => Promise<StoredDirectionQuestion | null>;
  sendToLead: (question: StoredDirectionQuestion, text: string, actorUserId: string) => Promise<void>;
  teach: (question: StoredDirectionQuestion, answer: string, actorUserId: string) => Promise<string>;
  save: (question: StoredDirectionQuestion, update: { answer: string; actorUserId: string; sentToLeadAt: Date | null; taughtDocumentId: string | null }) => Promise<void>;
};

export class DirectionAnswerError extends Error {}

/**
 * O diretor (ou o gestor, só na unidade) responde. Ordem: confere tudo, envia ao lead (se pedido; falhou, nada é
 * gravado e a pergunta segue aberta), ensina a IA (se pedido) e marca como respondida.
 */
export async function answerDirectionQuestion(context: TenantContext, input: DirectionAnswerInput, ports: DirectionAnswerPorts = defaultPorts) {
  if (!canAnswerDirectionQuestions(context.role, context.jobTitle)) throw new DirectionAnswerError("Só o diretor ou o gestor da unidade responde as perguntas da IA.");
  if (input.teach && !canTeachDirectionAnswers(context.role)) throw new DirectionAnswerError("Só o diretor ensina a IA. Responda sem marcar \"Ensinar a IA\".");
  const valid = validateDirectionAnswer(input);
  if (!valid.ok) throw new DirectionAnswerError(valid.error);
  const question = await ports.load(context, input.id);
  if (!question) throw new DirectionAnswerError("Pergunta não encontrada.");
  if (question.status === "answered") throw new DirectionAnswerError("Esta pergunta já foi respondida.");
  if (input.sendToLead && (!question.leadId || !question.phone)) throw new DirectionAnswerError("Esta conversa não tem mais um lead para receber a resposta.");

  let sentToLeadAt: Date | null = null;
  if (input.sendToLead) {
    await ports.sendToLead(question, valid.answer, context.userId);
    sentToLeadAt = new Date();
  }
  const taughtDocumentId = input.teach ? await ports.teach(question, valid.answer, context.userId) : null;
  await ports.save(question, { answer: valid.answer, actorUserId: context.userId, sentToLeadAt, taughtDocumentId });
  return { sentToLeadAt, taughtDocumentId };
}

async function loadQuestion(context: TenantContext, id: string): Promise<StoredDirectionQuestion | null> {
  if (!(await directionQuestionsReady())) throw new DirectionAnswerError("Falta aplicar a migration 0246 para responder as perguntas.");
  const table = schema.aiDirectionQuestions;
  const leadScope = await scopeFor(context);
  const [row] = await getDatabase().select({
    id: table.id,
    tenantId: table.tenantId,
    leadId: table.leadId,
    phone: table.phone,
    transport: table.transport,
    conversationId: table.conversationId,
    communicationChannelId: table.communicationChannelId,
    wahaRunId: table.wahaRunId,
    question: table.question,
    status: table.status,
  }).from(table)
    .leftJoin(schema.leads, eq(schema.leads.id, table.leadId))
    .where(and(eq(table.id, id), eq(table.tenantId, context.tenantId), leadScope))
    .limit(1);
  return row ?? null;
}

/**
 * Envia pelo mesmo caminho das respostas da IA nesta conversa (sendAiOutbound): WAHA pela execução da conversa,
 * Meta pelo número de origem do lead (sem trocar de remetente quando ele está indisponível). Erro com a causa.
 */
async function sendQuestionAnswer(question: StoredDirectionQuestion, text: string) {
  const { sendAiOutbound } = await import("@/features/ai-agent/conversation-state-machine");
  const transport = question.transport === "waha" || question.transport === "openwa" ? question.transport : "meta";
  const sent = await sendAiOutbound({
    tenantId: question.tenantId,
    leadId: question.leadId ?? undefined,
    phone: question.phone ?? "",
    body: text,
    transport,
    wahaRunId: question.wahaRunId,
  });
  if (sent.status === "blocked_source_channel") {
    throw new DirectionAnswerError(`O número da conversa (${sent.channelLabel ?? directionChannelLabel(transport)}) está indisponível. Nada foi enviado.`);
  }
  if (sent.status !== "sent") {
    throw new DirectionAnswerError(transport === "meta"
      ? "Não deu para enviar pelo WhatsApp oficial. Se passou de 24 h da última mensagem do lead, a Meta só aceita modelo aprovado. Nada foi enviado."
      : `Não deu para enviar pelo ${directionChannelLabel(transport)}. Nada foi enviado.`);
  }
  const db = getDatabase();
  await db.insert(schema.whatsappMessages).values({
    id: `direction_answer_${randomUUID()}`,
    tenantId: question.tenantId,
    leadId: question.leadId,
    communicationChannelId: question.communicationChannelId,
    conversationId: question.conversationId,
    senderRole: "agent",
    provider: transport,
    providerStatus: "sent",
    messageId: sent.messageId ?? undefined,
    phone: question.phone ?? "",
    direction: "outbound",
    body: text,
    sentAt: new Date(),
  }).onConflictDoNothing();
}

/**
 * "Ensinar a IA": a resposta vira documento publicado da base de conhecimento das operadoras (mesma busca do
 * assistente de cotação), com a operadora citada quando o catálogo a reconhece. Autoridade máxima: foi a direção.
 */
async function teachQuestionAnswer(question: StoredDirectionQuestion, answer: string) {
  const db = getDatabase();
  const carriers = await db.select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, question.tenantId), eq(schema.tenantPrivateCarriers.active, true), isNull(schema.tenantPrivateCarriers.archivedAt)));
  const carrier = carrierNamedIn(question.question, carriers);
  const knowledge = buildTaughtKnowledge({ question: question.question, answer, carrierName: carrier?.name });
  const documentId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.knowledgeDocuments).values({
      id: documentId,
      tenantId: question.tenantId,
      title: knowledge.title,
      canonicalContent: knowledge.content,
      category: OPERATOR_MATERIAL_CATEGORY,
      authorityLevel: 5,
      status: "published",
      version: 1,
      documentKey: `direction-question:${question.id}`,
    });
    await tx.insert(schema.knowledgeChunks).values({
      id: randomUUID(),
      tenantId: question.tenantId,
      documentId,
      chunkIndex: 0,
      text: knowledge.content,
      tokenCount: Math.ceil(knowledge.content.length / 4),
      authorityLevel: 5,
      metadata: { origin: "direction_answer", questionId: question.id, ...(carrier ? { carrierId: carrier.id } : {}) },
    });
  });
  return documentId;
}

async function saveQuestionAnswer(question: StoredDirectionQuestion, update: { answer: string; actorUserId: string; sentToLeadAt: Date | null; taughtDocumentId: string | null }) {
  const now = new Date();
  const db = getDatabase();
  await db.update(schema.aiDirectionQuestions).set({
    status: "answered",
    answer: update.answer,
    answeredBy: update.actorUserId,
    answeredAt: now,
    sentToLeadAt: update.sentToLeadAt,
    taughtDocumentId: update.taughtDocumentId,
    updatedAt: now,
  }).where(and(eq(schema.aiDirectionQuestions.id, question.id), eq(schema.aiDirectionQuestions.tenantId, question.tenantId)));
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: update.actorUserId,
    entidade: "ai_direction_question",
    entidadeId: question.id,
    acao: "ai_direction_question.answered",
    metadata: { sentToLead: Boolean(update.sentToLeadAt), taught: Boolean(update.taughtDocumentId) },
    createdAt: now,
  }).catch(() => undefined);
}

const defaultPorts: DirectionAnswerPorts = {
  load: loadQuestion,
  sendToLead: (question, text) => sendQuestionAnswer(question, text),
  teach: (question, answer) => teachQuestionAnswer(question, answer),
  save: saveQuestionAnswer,
};

/** Linha atualizada depois de responder (para a tela trocar sem recarregar). */
export async function getDirectionQuestionRow(context: TenantContext, id: string) {
  const list = await listDirectionQuestions(context);
  return list.ready ? list.rows.find((row) => row.id === id) ?? null : null;
}
