import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { getDatabase, schema } from "@/shared/db";

import { getNoticeRecipients } from "./closing-director-alert";
import {
  closingEnteredAt,
  dispatchLeadConvertedDirectorAlert,
  LEAD_CONVERTED_DIRECTOR_NOTICE_KEY,
  LEAD_CONVERTED_DIRECTOR_PURPOSE,
  leadConvertedDirectorAlertVariables,
} from "./lead-converted-director-alert-core";

export type LeadConvertedOrigin =
  | { kind: "ai"; signals: readonly string[]; quote: string | null }
  | { kind: "person"; actorUserId: string | null };

function positive(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

async function loadVariables(input: {
  tenantId: string;
  leadId: string;
  previousStatus: string | null;
  previousStageEnteredAt: Date | null;
  convertedAt: Date;
  origin: LeadConvertedOrigin;
}) {
  const db = getDatabase();
  const [lead] = await db
    .select({
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      tipo: schema.leads.tipo,
      livesCount: schema.leads.livesCount,
      monthlyValue: schema.leads.monthlyValue,
      planId: schema.leads.planId,
      brokerName: schema.user.name,
      legacyPlanName: schema.carrierPlans.name,
      globalPlanName: schema.globalPlans.name,
      tenantPrivatePlanName: schema.tenantPrivatePlans.name,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .leftJoin(schema.carrierPlans, and(eq(schema.leads.planId, schema.carrierPlans.id), eq(schema.carrierPlans.tenantId, input.tenantId)))
    .leftJoin(schema.globalPlans, eq(schema.leads.planId, schema.globalPlans.id))
    .leftJoin(schema.tenantPrivatePlans, and(eq(schema.leads.planId, schema.tenantPrivatePlans.id), eq(schema.tenantPrivatePlans.tenantId, input.tenantId)))
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);
  if (!lead) return null;

  const [sales, approvedDocuments, history, actor] = await Promise.all([
    db.select({
      approvedValue: schema.sales.approvedValue,
      saleValue: schema.sales.saleValue,
      carrierPlanId: schema.sales.carrierPlanId,
      carrierPlanName: schema.carrierPlans.name,
      confirmationDocumentId: schema.sales.confirmationDocumentId,
      policyNumber: schema.sales.policyNumber,
    })
      .from(schema.sales)
      .leftJoin(schema.carrierPlans, and(eq(schema.sales.carrierPlanId, schema.carrierPlans.id), eq(schema.carrierPlans.tenantId, input.tenantId)))
      .where(and(eq(schema.sales.leadId, input.leadId), eq(schema.sales.tenantId, input.tenantId), eq(schema.sales.status, "active")))
      .orderBy(desc(schema.sales.createdAt))
      .limit(1),
    db.select({ id: schema.leadDocuments.id })
      .from(schema.leadDocuments)
      .where(and(eq(schema.leadDocuments.leadId, input.leadId), eq(schema.leadDocuments.tenantId, input.tenantId), eq(schema.leadDocuments.status, "approved")))
      .limit(1),
    db.select({ fromStatus: schema.leadStageHistory.fromStatus, toStatus: schema.leadStageHistory.toStatus, changedAt: schema.leadStageHistory.changedAt })
      .from(schema.leadStageHistory)
      .where(and(eq(schema.leadStageHistory.leadId, input.leadId), eq(schema.leadStageHistory.tenantId, input.tenantId)))
      .orderBy(desc(schema.leadStageHistory.changedAt))
      .limit(200),
    input.origin.kind === "person" && input.origin.actorUserId
      ? db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, input.origin.actorUserId)).limit(1)
      : Promise.resolve([] as Array<{ name: string | null }>),
  ]);
  const sale = sales[0];
  const monthlyValue = positive(lead.monthlyValue) ? lead.monthlyValue : sale?.approvedValue ?? sale?.saleValue ?? null;
  return leadConvertedDirectorAlertVariables({
    leadId: input.leadId,
    leadName: lead.nome,
    leadPhone: lead.telefone,
    leadType: lead.tipo,
    livesCount: lead.livesCount,
    monthlyValue,
    planName: lead.legacyPlanName ?? lead.globalPlanName ?? lead.tenantPrivatePlanName ?? sale?.carrierPlanName ?? null,
    brokerName: lead.brokerName,
    closingEnteredAt: closingEnteredAt({ history, previousStatus: input.previousStatus, previousStageEnteredAt: input.previousStageEnteredAt }),
    convertedAt: input.convertedAt,
    origin: input.origin.kind === "ai"
      ? { kind: "ai", signals: input.origin.signals, quote: input.origin.quote }
      : { kind: "person", actorName: actor[0]?.name ?? null },
    hasPlan: Boolean(lead.planId || sale?.carrierPlanId),
    // Documento aprovado, comprovante anexado à venda ou nº da proposta/apólice da operadora.
    hasOperatorConfirmation: approvedDocuments.length > 0 || Boolean(sale?.confirmationDocumentId || sale?.policyNumber?.trim()),
  });
}

/**
 * "Venda fechada para a direção" (11/11): o lead virou venda, pela IA ou por uma pessoa. Manda aos números do
 * aviso (sem lista própria, os do Fechamento para a direção) pelo número da empresa. Uma vez por lead e número
 * (chave idempotente na outbox). Nunca lança erro: a conversão já está salva.
 */
export async function notifyDirectorsLeadConverted(input: {
  tenantId: string;
  leadId: string;
  previousStatus: string | null;
  newStatus: string;
  /** Quando o lead entrou na etapa de onde saiu para Convertido (fallback dos dias no fechamento). */
  previousStageEnteredAt: Date | null;
  convertedAt: Date;
  origin: LeadConvertedOrigin;
}) {
  return dispatchLeadConvertedDirectorAlert(input, {
    recipients: () => getNoticeRecipients(input.tenantId, LEAD_CONVERTED_DIRECTOR_NOTICE_KEY),
    enabled: async () => {
      // Desligado em Avisos da equipe: nada sai (a outbox também pularia; isto poupa as consultas).
      const notice = teamNoticeByKey(LEAD_CONVERTED_DIRECTOR_NOTICE_KEY);
      return Boolean(notice && (await getTeamNoticeSetting(input.tenantId, notice)).enabled);
    },
    variables: () => loadVariables(input),
    send: async (phone, variables, idempotencyKey) => {
      const queued = await enqueueMetaTemplateMessage({
        tenantId: input.tenantId,
        recipientType: "user",
        destinationPhone: phone,
        purpose: LEAD_CONVERTED_DIRECTOR_PURPOSE,
        variables,
        requestedBy: null,
        idempotencyKey,
      });
      if (queued.duplicate || (queued.status as string) === "skipped") return false;
      // Envio pelo id exato: uma mensagem antiga na fila nunca toma o lugar desta.
      await processMetaOutboundBatch(1, input.tenantId, queued.id);
      return true;
    },
  });
}
