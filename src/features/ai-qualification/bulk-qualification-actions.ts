"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { INITIAL_MESSAGE_FAILURE_NOTE_PREFIX } from "@/features/communication-channels/meta-delivery-failure";
import { manuallyChangeQualificationStageAction } from "@/features/leads/qualification-tab-actions";
import { startAiQualificationForLead } from "./service";
import { sendAiOutbound } from "@/features/ai-agent/conversation-state-machine";
import {
  AI_RESTART_SKIP_LABEL,
  AI_SEND_FAILED_LOOKBACK_MS,
  AI_SEND_FAILED_SKIP_LABEL,
  decideAiRestartDispatch,
  decideAiSendFailedCandidate,
  type AiSendFailedDecision,
  type AiSendFailedLeadFacts,
} from "./ai-send-failed-candidates";

const bulkFilterSchema = z.object({
  filterType: z.enum(["all_unqualified", "new_leads", "unresponsive_24h", "first_message_failed", "ai_send_failed", "custom_selection"]).default("all_unqualified"),
  leadIds: z.array(z.string().uuid()).optional(),
});

export type BulkQualificationFilter = z.infer<typeof bulkFilterSchema>;

const FIRST_MESSAGE_FAILED_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export async function getCandidateLeadsForBulkQualification(filterType: string = "all_unqualified") {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores podem realizar disparos em massa.");
  }
  if (filterType === "ai_send_failed") return loadAiSendFailedCandidates(context);
  const db = getDatabase();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const whereConditions = [
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
  ];

  if (filterType === "first_message_failed") {
    // The first message never left because of a system error (no Meta code in the note) and
    // the lead has no message at all, so it has no chat to resume (22/10: empty operator variable).
    whereConditions.push(
      isNull(schema.leads.corretorId),
      notInArray(schema.leads.status, ["lost", "converted"]),
      gte(schema.leads.createdAt, new Date(now.getTime() - FIRST_MESSAGE_FAILED_LOOKBACK_MS)),
      sql`exists (select 1 from lead_interactions i where i.lead_id = "leads"."id" and i.conteudo like ${`${INITIAL_MESSAGE_FAILURE_NOTE_PREFIX}%`} and i.conteudo not like '%Motivo (%')`,
      sql`not exists (select 1 from whatsapp_messages m where m.tenant_id = "leads"."tenant_id" and m.lead_id = "leads"."id")`,
    );
    if (context.role !== "director") {
      if (!context.branchId) throw new AuthorizationError("Disparo disponível só para a unidade do gestor.");
      whereConditions.push(eq(schema.leads.branchId, context.branchId));
    }
  } else if (filterType === "new_leads") {
    whereConditions.push(eq(schema.leads.status, "new"));
  } else if (filterType === "unresponsive_24h") {
    whereConditions.push(
      or(
        eq(schema.leads.status, "new"),
        eq(schema.leads.status, "in_contact"),
        eq(schema.leads.status, "distributed")
      )!,
      sql`${schema.leads.createdAt} <= ${twentyFourHoursAgo}`
    );
  } else {
    // all_unqualified
    whereConditions.push(
      or(
        eq(schema.leads.status, "new"),
        eq(schema.leads.status, "in_contact"),
        eq(schema.leads.status, "distributed")
      )!
    );
  }

  const leads = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .where(and(...whereConditions))
    .orderBy(schema.leads.createdAt)
    .limit(200);

  return leads.map((lead) => ({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
  }));
}

export async function triggerBulkQualificationAction(input: BulkQualificationFilter) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Permissão negada. Apenas diretores e gestores podem realizar disparos de qualificação em massa." };
    }

    const parsed = bulkFilterSchema.parse(input);
    if (parsed.filterType === "ai_send_failed") return reopenAiSendFailedLeads(context, parsed.leadIds ?? []);
    const db = getDatabase();

    let targetLeadIds: string[] = [];

    if (parsed.filterType === "custom_selection" && parsed.leadIds?.length) {
      targetLeadIds = parsed.leadIds;
    } else {
      const candidates = await getCandidateLeadsForBulkQualification(parsed.filterType);
      targetLeadIds = candidates.map((c) => c.id);
    }

    if (targetLeadIds.length === 0) {
      return { success: false, error: "Nenhum lead encontrado para os critérios selecionados." };
    }

    if (parsed.filterType === "first_message_failed") {
      // Out of "aguardando ação manual", or the lead would never reach a broker after qualifying.
      await db.update(schema.leads).set({ distributionStatus: "unassigned", qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: new Date() })
        .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, targetLeadIds), isNull(schema.leads.corretorId)));
    }

    let successCount = 0;
    let failedCount = 0;

    for (const leadId of targetLeadIds) {
      try {
        const res = await startAiQualificationForLead({
          tenantId: context.tenantId,
          leadId,
          actorUserId: context.userId,
          force: true,
        });
        if (res.started) successCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }
    }

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "ai_qualification_bulk",
      entidadeId: context.tenantId,
      acao: "ai_qualification.bulk_triggered",
    });


    return {
      success: true,
      totalProcessed: targetLeadIds.length,
      successCount,
      failedCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao disparar qualificação em massa.",
    };
  }
}

type BulkContext = Awaited<ReturnType<typeof getRequiredTenantContext>>;

const AI_SEND_FAILED_MAX_LEADS = 500;
const AI_SEND_FAILED_BATCH = 20;
const DELIVERED_STATUSES = ["sent", "delivered", "read"];

/** Facts per lead, read from the messages of the lookback; the rule itself is decideAiSendFailedCandidate. */
async function loadAiSendFailedDecisions(context: BulkContext, now: Date) {
  const db = getDatabase();
  const since = new Date(now.getTime() - AI_SEND_FAILED_LOOKBACK_MS);
  const failedRows = await db
    .selectDistinct({ leadId: schema.whatsappMessages.leadId })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      eq(schema.whatsappMessages.senderRole, "assistant"),
      eq(schema.whatsappMessages.providerStatus, "failed"),
      gte(schema.whatsappMessages.sentAt, since),
      isNotNull(schema.whatsappMessages.leadId),
    ))
    .limit(AI_SEND_FAILED_MAX_LEADS);
  const leadIds = failedRows.map((row) => row.leadId).filter((id): id is string => Boolean(id));
  if (!leadIds.length) return new Map<string, { decision: AiSendFailedDecision; lead: LeadRowForBulk }>();

  const leadRows = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      corretorId: schema.leads.corretorId,
      qualificationStatus: schema.leads.qualificationStatus,
      branchId: schema.leads.branchId,
      queueName: schema.leadQueues.name,
      queueAiEnabled: schema.leadQueues.aiQualificationEnabled,
    })
    .from(schema.leads)
    .leftJoin(schema.leadQueues, eq(schema.leadQueues.id, schema.leads.queueId))
    .where(and(
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      inArray(schema.leads.id, leadIds),
      context.role === "director" ? undefined : eq(schema.leads.branchId, context.branchId ?? ""),
    ))
    .limit(AI_SEND_FAILED_MAX_LEADS);
  const scopedIds = leadRows.map((lead) => lead.id);
  if (!scopedIds.length) return new Map<string, { decision: AiSendFailedDecision; lead: LeadRowForBulk }>();

  const outbound = await db
    .select({ leadId: schema.whatsappMessages.leadId, sentAt: schema.whatsappMessages.sentAt, providerStatus: schema.whatsappMessages.providerStatus, senderRole: schema.whatsappMessages.senderRole })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, scopedIds),
      inArray(schema.whatsappMessages.direction, ["outbound", "outgoing"]),
      gte(schema.whatsappMessages.sentAt, since),
    ));
  const inbound = await db
    .select({ leadId: schema.whatsappMessages.leadId, sentAt: schema.whatsappMessages.sentAt })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, scopedIds),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      gte(schema.whatsappMessages.sentAt, since),
    ));

  const lastInboundByLead = new Map<string, Date>();
  for (const row of inbound) {
    if (!row.leadId || !row.sentAt) continue;
    const current = lastInboundByLead.get(row.leadId);
    if (!current || row.sentAt > current) lastInboundByLead.set(row.leadId, row.sentAt);
  }
  const outboundByLead = new Map<string, typeof outbound>();
  for (const row of outbound) {
    if (!row.leadId) continue;
    outboundByLead.set(row.leadId, [...(outboundByLead.get(row.leadId) ?? []), row]);
  }

  const result = new Map<string, { decision: AiSendFailedDecision; lead: LeadRowForBulk }>();
  for (const lead of leadRows) {
    const messages = outboundByLead.get(lead.id) ?? [];
    const aiMessages = messages.filter((message) => message.senderRole === "assistant" && message.sentAt);
    const lastAi = aiMessages.sort((a, b) => (a.sentAt!.getTime() - b.sentAt!.getTime()))[aiMessages.length - 1];
    const deliveredAfterLastAi = lastAi?.sentAt
      ? messages.some((message) => message.sentAt && message.sentAt > lastAi.sentAt! && DELIVERED_STATUSES.includes(message.providerStatus ?? ""))
      : false;
    const facts: AiSendFailedLeadFacts = {
      leadId: lead.id,
      status: lead.status,
      corretorId: lead.corretorId,
      qualificationStatus: lead.qualificationStatus,
      queueAiEnabled: lead.queueAiEnabled ?? null,
      lastAiSentAt: lastAi?.sentAt ?? null,
      lastAiFailed: lastAi?.providerStatus === "failed",
      deliveredAfterLastAi,
      lastCustomerInboundAt: lastInboundByLead.get(lead.id) ?? null,
    };
    result.set(lead.id, { decision: decideAiSendFailedCandidate(facts, now), lead });
  }
  return result;
}

type LeadRowForBulk = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  corretorId: string | null;
  qualificationStatus: string | null;
  branchId: string | null;
  queueName: string | null;
  queueAiEnabled: boolean | null;
};

/** The list shown before confirming: only the leads the reopen would take. */
async function loadAiSendFailedCandidates(context: BulkContext) {
  const decisions = await loadAiSendFailedDecisions(context, new Date());
  return [...decisions.values()].flatMap(({ decision, lead }) => decision.eligible
    ? [{
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      status: lead.status,
      queueName: lead.queueName,
      failedAt: decision.failedAt.toISOString(),
      windowEndsAt: decision.windowEndsAt.toISOString(),
    }]
    : []);
}

/**
 * Reopens with the same action as the individual button ("Reabrir Qualificação por IA"), one by one.
 * The eligibility is recomputed here: a client-sent id that no longer qualifies is only counted as ignored.
 */
async function reopenAiSendFailedLeads(context: BulkContext, requestedIds: string[]) {
  // One run per tenant: a double click or a second tab would pass the eligibility before any send
  // and, with force, send the first message twice.
  const run = await withJobLease(`ai-send-failed-reopen:${context.tenantId}`, 10 * 60_000, () => runAiSendFailedReopen(context, requestedIds));
  if (!run.acquired) return { success: false as const, error: "Já há uma reabertura em andamento. Aguarde terminar." };
  return run.value;
}

const AI_RESEND_SKIP_LABEL = {
  no_failed_message: "a mensagem da IA que falhou não foi encontrada",
  missing_phone: "o lead não tem telefone",
  not_sent: "o reenvio em texto não foi aceito pelo WhatsApp",
} as const;

/** Sends the AI's last failed message again, as free text, and marks that same message as sent. */
async function resendFailedAiMessage(tenantId: string, leadId: string): Promise<{ sent: true } | { sent: false; reason: keyof typeof AI_RESEND_SKIP_LABEL }> {
  const db = getDatabase();
  const [failed] = await db.select({ id: schema.whatsappMessages.id, body: schema.whatsappMessages.body, phone: schema.whatsappMessages.phone })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.leadId, leadId),
      eq(schema.whatsappMessages.senderRole, "assistant"),
      eq(schema.whatsappMessages.providerStatus, "failed"),
      gte(schema.whatsappMessages.sentAt, new Date(Date.now() - AI_SEND_FAILED_LOOKBACK_MS)),
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(1);
  if (!failed?.body) return { sent: false, reason: "no_failed_message" };
  if (!failed.phone) return { sent: false, reason: "missing_phone" };
  const result = await sendAiOutbound({ tenantId, leadId, phone: failed.phone, body: failed.body, transport: "meta", currentMessageId: failed.id });
  if (result.status !== "sent" || !result.messageId) return { sent: false, reason: "not_sent" };
  await db.update(schema.whatsappMessages)
    .set({ providerStatus: "sent", messageId: result.messageId, sentAt: new Date() })
    .where(and(eq(schema.whatsappMessages.id, failed.id), eq(schema.whatsappMessages.tenantId, tenantId)));
  return { sent: true };
}

async function runAiSendFailedReopen(context: BulkContext, requestedIds: string[]) {
  const now = new Date();
  const decisions = await loadAiSendFailedDecisions(context, now);
  const requested = requestedIds.length ? new Set(requestedIds) : null;
  const ignored: Record<string, number> = {};
  const count = (reason: string) => { ignored[reason] = (ignored[reason] ?? 0) + 1; };
  const targets: string[] = [];
  for (const [leadId, { decision }] of decisions) {
    if (requested && !requested.has(leadId)) continue;
    if (decision.eligible) targets.push(leadId);
    else count(AI_SEND_FAILED_SKIP_LABEL[decision.reason]);
  }
  if (requested) {
    for (const leadId of requested) if (!decisions.has(leadId)) count("fora do filtro ou sem falha da IA");
  }

  // A batch that fits well inside the 10-minute lease: a longer run could outlive it and a second
  // run would resend (eligibility only blocks after the delivery). The rest goes in the next click.
  const batch = targets.slice(0, AI_SEND_FAILED_BATCH);
  for (let index = batch.length; index < targets.length; index++) count("fica para a próxima reabertura (lote de 20)");
  let reopened = 0;
  let sent = 0;
  for (const leadId of batch) {
    try {
      const result = await manuallyChangeQualificationStageAction({ leadId, targetStage: "qualificacoes" });
      if (!result.success) {
        count(result.error ?? "erro ao reabrir");
        continue;
      }
      reopened++;
      // The window and the delivery were checked above; the window is checked again now, at the send.
      const eligible = decisions.get(leadId)?.decision;
      if (!eligible?.eligible) continue;
      const dispatch = decideAiRestartDispatch({ windowEndsAt: eligible.windowEndsAt, now: new Date(), deliveredAfterLastAi: false });
      if (!dispatch.send) {
        count(AI_RESTART_SKIP_LABEL[dispatch.reason]);
        continue;
      }
      // The window is open, so the AI's own failed message goes again as free text through the number the
      // customer wrote to. The first-contact template is not used here: a coex number may not have it (132001)
      // and the conversation is already waiting for the answer to this exact question.
      const resent = await resendFailedAiMessage(context.tenantId, leadId);
      if (resent.sent) sent++;
      else count(AI_RESEND_SKIP_LABEL[resent.reason]);
    } catch {
      count("erro ao enviar a primeira mensagem");
    }
  }

  const ignoredCount = Object.values(ignored).reduce((total, value) => total + value, 0);
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "ai_qualification_bulk",
    entidadeId: context.tenantId,
    acao: "ai_qualification.bulk_reopened_ai_send_failed",
  });

  return {
    success: true as const,
    totalProcessed: batch.length + ignoredCount,
    successCount: reopened,
    failedCount: ignoredCount,
    reopenedCount: reopened,
    sentCount: sent,
    ignoredCount,
    ignoredReasons: Object.entries(ignored).map(([reason, count]) => ({ reason, count })),
  };
}
