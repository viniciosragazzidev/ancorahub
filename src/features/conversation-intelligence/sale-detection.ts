import "server-only";

import { and, desc, eq, gt, inArray, isNull, notInArray, or } from "drizzle-orm";

import { conversationMessageBody } from "@/features/conversations/message-media-text";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { publishNotification } from "@/features/notifications/send-push-helper";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import {
  aiSaleBrokerNotice,
  aiSaleDirectorNotice,
  aiSaleMissingItems,
  aiSaleNotificationKey,
  aiSaleSuggestionNotice,
  decideAiSaleConversion,
  saleEvidenceProven,
  validateSaleEvidence,
  type AiSaleDetection,
  type SaleCompleted,
  type SaleEvidenceMessage,
} from "./sale-detection-core";

type LeadForSale = {
  id: string;
  tenantId: string;
  nome: string;
  status: string;
  version: number;
  corretorId: string | null;
};

/** Janela de mensagens onde o trecho citado pela IA precisa estar. */
const EVIDENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Mensagens reais do lead nos últimos 30 dias: texto, legenda e nome do arquivo. */
async function loadEvidenceMessages(tenantId: string, leadId: string): Promise<SaleEvidenceMessage[]> {
  const rows = await getDatabase()
    .select({
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      body: schema.whatsappMessages.body,
      mediaKind: schema.whatsappMessages.mediaKind,
      mediaFilename: schema.whatsappMessages.mediaFilename,
    })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.leadId, leadId),
      gt(schema.whatsappMessages.sentAt, new Date(Date.now() - EVIDENCE_WINDOW_MS)),
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(500);
  return rows.map((row) => ({
    sender: row.direction === "incoming" ? "customer" : row.senderRole === "assistant" || row.senderRole === "system" ? "system" : "broker",
    text: conversationMessageBody(row),
  }));
}

export type AiSaleOutcome =
  | { marker: AiSaleDetection; why?: undefined }
  | { marker: null; why: string };

/**
 * Venda detectada pela IA (10/11): confere as travas no banco (dono diretor, venda já registrada, pessoa que
 * tirou o lead de Convertido) e os trechos citados pela IA contra as mensagens reais. Com trecho real de
 * pagamento ou de proposta transmitida: no modo automático move o lead para Convertido pelo mesmo serviço da
 * mudança manual (ator IA); no modo sugestão só pede a confirmação. Sem trecho real: marca "unverified", sem
 * aviso. Devolve o marcador a guardar em qualificationDetails.aiSaleDetected, ou null. Nunca lança erro.
 */
export async function applyAiSaleDetection(input: {
  lead: LeadForSale;
  saleCompleted: SaleCompleted;
  mode: "auto" | "suggest" | "off";
  alreadyDetected: boolean;
  alreadySuggested: boolean;
  recentlyUndone: boolean;
  actorUserId: string;
}): Promise<AiSaleOutcome> {
  const { lead } = input;
  try {
    // Sem confirmação nem custa ir ao banco.
    if (input.saleCompleted.status !== "confirmed") return { marker: null, why: "A IA não confirmou a venda." };
    const db = getDatabase();
    const [ownerRole, revertedByPerson, activeSale] = await Promise.all([
      lead.corretorId
        ? db.select({ role: schema.tenantMemberships.role }).from(schema.tenantMemberships)
          .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.userId, lead.corretorId), eq(schema.tenantMemberships.status, "active")))
          .limit(5)
        : Promise.resolve([] as Array<{ role: string }>),
      db.select({ id: schema.leadStageHistory.id }).from(schema.leadStageHistory)
        .where(and(
          eq(schema.leadStageHistory.leadId, lead.id),
          eq(schema.leadStageHistory.fromStatus, "converted"),
          notInArray(schema.leadStageHistory.actorType, ["ai", "rule", "system"]),
        ))
        .limit(1),
      db.select({ id: schema.sales.id }).from(schema.sales)
        .where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, lead.tenantId), eq(schema.sales.status, "active")))
        .limit(1),
    ]);

    const decision = decideAiSaleConversion({
      status: lead.status,
      saleCompleted: input.saleCompleted,
      mode: input.mode,
      hasBroker: Boolean(lead.corretorId),
      ownerIsDirector: ownerRole.some((row) => row.role === "director"),
      alreadyDetected: input.alreadyDetected,
      alreadySuggested: input.alreadySuggested,
      personMovedOutOfConverted: revertedByPerson.length > 0,
      hasActiveSale: activeSale.length > 0,
      recentlyUndone: input.recentlyUndone,
    });
    if (!decision.convert && !decision.suggest) return { marker: null, why: decision.why };

    // O trecho precisa existir na conversa (Vigia, 10/11): citação inventada ou mal lida nunca converte.
    const validated = validateSaleEvidence(input.saleCompleted.evidence, await loadEvidenceMessages(lead.tenantId, lead.id));
    const base = { at: new Date().toISOString(), fromStatus: lead.status, signals: decision.signals, registrationPending: false };
    if (!saleEvidenceProven(validated)) {
      return {
        marker: {
          ...base,
          status: "unverified",
          evidence: [...input.saleCompleted.evidence],
          reason: "A IA viu a venda, mas o trecho de pagamento ou de proposta transmitida não foi encontrado na conversa. Confira antes de registrar.",
        },
      };
    }
    const quotes = validated.map((item) => item.quote);

    if (decision.suggest) {
      return { marker: { ...base, status: "suggested", evidence: quotes, reason: decision.reason } };
    }

    const evidenceLine = `\nTrechos da conversa: ${quotes.map((quote) => `"${quote}"`).join(" · ")}`;
    const systemContext: TenantContext = { userId: input.actorUserId, tenantId: lead.tenantId, role: "director", jobTitle: "system", branchId: null };
    await changeLeadStatus({ leadId: lead.id, newStatus: "converted", expectedVersion: lead.version }, systemContext, {
      actorUserId: input.actorUserId,
      actorType: "ai",
      expectedStatus: lead.status,
      reason: decision.reason,
      auditAction: `ai_sale_detected:${lead.status}->converted`,
      interactionContent: `Status alterado automaticamente pela IA: ${LEAD_STATUS_LABELS[lead.status] ?? lead.status} → ${LEAD_STATUS_LABELS.converted}.\n${decision.reason}.${evidenceLine}\nFalta o corretor completar o Registrar venda (valor, operadora e vidas).`,
      interactionMetadata: {
        source: "AI_SALE_DETECTED",
        fromStatus: lead.status,
        toStatus: "converted",
        signals: decision.signals,
        evidence: quotes,
      },
    });

    return { marker: { ...base, status: "converted", evidence: quotes, reason: decision.reason, registrationPending: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "erro";
    console.warn("[ai-sale] not_converted", { leadId: lead.id, error: message });
    return { marker: null, why: `Conversão automática não aplicada (${message}).` };
  }
}

/** Modo sugestão: "A IA detectou a venda: confirmar?" ao corretor e aos diretores, uma vez por lead e pessoa. */
export async function notifyAiSaleSuggested(input: { tenantId: string; leadId: string; leadName: string | null; brokerId: string | null; marker: AiSaleDetection }) {
  try {
    const directors = await getDatabase()
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.role, "director")))
      .groupBy(schema.tenantMemberships.userId)
      .limit(20);
    const recipients = [...new Set([...(input.brokerId ? [input.brokerId] : []), ...directors.map((director) => director.userId)])];
    const notice = aiSaleSuggestionNotice({ leadName: input.leadName, reason: input.marker.reason });
    await Promise.allSettled(recipients.map((userId) => publishNotification({
      capability: "lead_ai_insight",
      tenantId: input.tenantId,
      recipientUserId: userId,
      leadId: input.leadId,
      type: "lead_ai_insight",
      ...notice,
      url: `/leads/${input.leadId}`,
      tag: `lead-${input.leadId}`,
      idempotencyKey: `lead-ai-sale-suggested:${input.leadId}:${userId}`,
    })));
  } catch (error) {
    console.error("[ai-sale] suggest_notify_failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
  }
}


/** O que falta para registrar a venda: documentos obrigatórios, confirmação da operadora, valor, plano e vidas. */
async function loadMissingItems(tenantId: string, leadId: string) {
  const db = getDatabase();
  const [lead] = await db
    .select({ planId: schema.leads.planId, monthlyValue: schema.leads.monthlyValue, livesCount: schema.leads.livesCount })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);
  if (!lead) return [];
  const [beneficiaries, requirements, documents] = await Promise.all([
    db.select({ id: schema.leadBeneficiaries.id }).from(schema.leadBeneficiaries)
      .where(and(eq(schema.leadBeneficiaries.leadId, leadId), eq(schema.leadBeneficiaries.tenantId, tenantId))),
    db.select({ id: schema.documentRequirements.id, required: schema.documentRequirements.required, appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary })
      .from(schema.documentRequirements)
      .where(and(eq(schema.documentRequirements.tenantId, tenantId), or(isNull(schema.documentRequirements.planId), eq(schema.documentRequirements.planId, lead.planId ?? "")))),
    db.select({ requirementId: schema.leadDocuments.requirementId, beneficiaryId: schema.leadDocuments.beneficiaryId, status: schema.leadDocuments.status })
      .from(schema.leadDocuments)
      .where(and(eq(schema.leadDocuments.leadId, leadId), eq(schema.leadDocuments.tenantId, tenantId))),
  ]);
  const approved = documents.filter((document) => document.status === "approved");
  let pending = 0;
  for (const requirement of requirements.filter((item) => item.required)) {
    if (requirement.appliesPerBeneficiary && beneficiaries.length) {
      pending += beneficiaries.filter((beneficiary) => !approved.some((document) => document.requirementId === requirement.id && document.beneficiaryId === beneficiary.id)).length;
    } else if (!approved.some((document) => document.requirementId === requirement.id)) {
      pending += 1;
    }
  }
  return aiSaleMissingItems({
    pendingRequiredDocuments: pending,
    hasApprovedDocument: approved.length > 0,
    monthlyValue: lead.monthlyValue,
    hasPlan: Boolean(lead.planId),
    livesCount: lead.livesCount,
  });
}

/**
 * Depois da conversão: parabéns e pedido da documentação ao corretor (o mesmo aviso que a direção manda à
 * mão, com o que falta) e aviso no app a cada diretor (a Keyla, na Âncora). Uma vez por lead e pessoa.
 * Nunca lança erro.
 */
export async function notifyAiSaleDetected(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  brokerId: string | null;
  marker: AiSaleDetection;
}) {
  try {
    const db = getDatabase();
    const missing = await loadMissingItems(input.tenantId, input.leadId).catch(() => [] as string[]);
    const [broker] = input.brokerId
      ? await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, input.brokerId)).limit(1)
      : [];
    const directors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.role, ["director"])))
      .groupBy(schema.tenantMemberships.userId)
      .limit(20);

    const { notifyBrokerAiSaleDocuments } = await import("@/features/leads/closing-stage-notice");
    const directorNotice = aiSaleDirectorNotice({ leadName: input.leadName, brokerName: broker?.name ?? null, reason: input.marker.reason, evidence: input.marker.evidence });
    const settled = await Promise.allSettled([
      input.brokerId
        ? notifyBrokerAiSaleDocuments({
          tenantId: input.tenantId,
          leadId: input.leadId,
          leadName: input.leadName,
          brokerId: input.brokerId,
          idempotencyKey: aiSaleNotificationKey(input.leadId, input.brokerId),
          inApp: aiSaleBrokerNotice(input.leadName, missing),
        })
        : Promise.resolve(null),
      ...directors.map((director) => publishNotification({
        capability: "lead_converted",
        tenantId: input.tenantId,
        recipientUserId: director.userId,
        leadId: input.leadId,
        type: "lead_converted",
        ...directorNotice,
        url: `/leads/${input.leadId}`,
        tag: `lead-${input.leadId}`,
        idempotencyKey: aiSaleNotificationKey(input.leadId, director.userId),
      })),
    ]);
    settled.forEach((item) => {
      if (item.status === "rejected") console.warn("[ai-sale] notice_failed", { leadId: input.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
    });
    return { missing, directors: directors.length };
  } catch (error) {
    console.error("[ai-sale] notify_failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { missing: [], directors: 0 };
  }
}
