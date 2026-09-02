import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { assertTenantAccess } from "@/shared/auth/authorization";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { publishDomainInvalidation } from "@/features/notifications/realtime-sync";
import type { TenantContext } from "@/shared/auth/types";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  MOTIVOS_PERDA,
  MOTIVO_PERDA_LABELS,
  VALID_TRANSITIONS,
} from "./lead-status-constants";
import type { MotivoPerda } from "./lead-status-constants";

// ─── Tipos ────────────────────────────────────────────────────────────

export type LeadStatus = (typeof schema.leadStatusValues)[number];

export type ChangeLeadStatusInput = {
  leadId: string;
  newStatus: string;
  motivoPerda?: string | null;
  justificativaRegressao?: string | null;
  expectedVersion?: number;
};

export type ChangeLeadStatusResult = {
  success: true;
  previousStatus: string;
  newStatus: string;
  reopened: boolean;
};

// ─── Validação do input ───────────────────────────────────────────────

const changeStatusInput = z.object({
  leadId: z.string().min(1, "ID do lead é obrigatório."),
  newStatus: z.enum(
    schema.leadStatusValues as unknown as [string, ...string[]],
    { message: "Status inválido." },
  ),
  motivoPerda: z.string().optional().nullable(),
  justificativaRegressao: z.string().optional().nullable(),
  expectedVersion: z.number().int().positive().optional(),
});

/**
 * Avalia se o lead foi diagnosticado pela IA como uma possível venda / alta oportunidade.
 */
export function isAiPotentialSale(qualificationDetails: unknown): {
  isPotentialSale: boolean;
  reason?: string;
} {
  if (!qualificationDetails || typeof qualificationDetails !== "object") {
    return { isPotentialSale: false };
  }
  const qual = qualificationDetails as Record<string, any>;
  const ai = qual.aiIntelligence;
  if (!ai || typeof ai !== "object") {
    return { isPotentialSale: false };
  }

  // 1. Alta ou altíssima intenção de compra
  if (ai.customerIntent === "VERY_HIGH" || ai.customerIntent === "HIGH") {
    return {
      isPotentialSale: true,
      reason: `Intenção de compra avaliada pela IA como '${ai.customerIntent}'`,
    };
  }

  // 2. Sinais de compra detectados
  if (Array.isArray(ai.buyingSignals) && ai.buyingSignals.length > 0) {
    return {
      isPotentialSale: true,
      reason: `Sinais de compra detectados pela IA: "${ai.buyingSignals.slice(0, 2).join(", ")}"`,
    };
  }

  // 3. Estágio avançado de negociação ou fechamento
  if (
    ai.conversationStage === "NEGOTIATION" ||
    ai.conversationStage === "DOCUMENT_COLLECTION" ||
    ai.conversationStage === "CLOSING"
  ) {
    return {
      isPotentialSale: true,
      reason: `Estágio da conversa diagnosticado pela IA como '${ai.conversationStage}'`,
    };
  }

  return { isPotentialSale: false };
}

// ─── Serviço principal ────────────────────────────────────────────────

async function assertCanChangeStatus(
  context: TenantContext,
  lead: { tenantId: string; corretorId: string | null; branchId: string | null; status?: string },
) {
  assertTenantAccess(context, lead.tenantId);

  if (!hasPermission(context.role, "alterar_status_lead")) {
    throw new AuthorizationError("Seu papel não pode alterar status de leads.");
  }

  // Se o lead tem um corretor responsável, apenas esse corretor pode alterar o status
  if (lead.corretorId) {
    if (context.userId !== lead.corretorId) {
      throw new AuthorizationError("Apenas o corretor responsável por este lead pode alterar o seu status.");
    }
  } else {
    // Se não tem corretor, apenas gestores/diretores podem alterar (corretores não)
    if (context.role === "broker") {
      throw new AuthorizationError("Este lead não está atribuído a você.");
    }
  }

  if (context.role === "broker" && lead.status === "distributed") {
    throw new AuthorizationError("Inicie o atendimento antes de alterar o status deste lead.");
  }

  // Gestor: só pode alterar leads da sua filial (caso não haja corretor atribuído)
  if (context.role === "manager" && !lead.corretorId) {
    if (!lead.branchId || !context.branchId || context.branchId !== lead.branchId) {
      throw new AuthorizationError("Você só pode alterar status de leads da sua filial.");
    }
  }
}

async function assertCanReopen(context: TenantContext) {
  if (!hasPermission(context.role, "reabrir_lead_perdido")) {
    throw new AuthorizationError(
      "Apenas gestores e diretores podem reabrir leads perdidos.",
    );
  }
}

export async function changeLeadStatus(
  rawInput: ChangeLeadStatusInput,
  contextOverride?: TenantContext,
): Promise<ChangeLeadStatusResult> {
  const input = changeStatusInput.parse(rawInput);
  const context = contextOverride ?? await getRequiredTenantContext();
  const db = getDatabase();

  // Buscar o lead
  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationDetails: schema.leads.qualificationDetails,
      version: schema.leads.version,
      nome: schema.leads.nome,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) {
    throw new Error("Lead não encontrado.");
  }

  const previousStatus = lead.status;
  const newStatus = input.newStatus;
  if (input.expectedVersion !== undefined && input.expectedVersion !== lead.version) {
    throw new Error("CONFLICT_VERSION");
  }

  // 1. validação de transição do pipeline
  const allowedNext = VALID_TRANSITIONS[previousStatus];
  if (allowedNext && !allowedNext.includes(newStatus)) {
    throw new Error(
      `Transição inválida: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}.`,
    );
  }

  // 3. Validação de obrigatoriedade de qualificação
  const { validateLeadStatusChangeQualification } = await import("./qualification-guard");
  const qualificationValidation = await validateLeadStatusChangeQualification({
    tenantId: context.tenantId,
    leadId: lead.id,
    newStatus,
    currentQualificationStatus: lead.qualificationStatus,
  });

  // 4. perdido: exige motivo
  if (newStatus === "lost") {
    if (!input.motivoPerda || !(MOTIVOS_PERDA as readonly string[]).includes(input.motivoPerda)) {
      throw new Error(
        "É obrigatório informar um motivo de perda válido para marcar o lead como perdido.",
      );
    }
    await assertCanChangeStatus(context, lead);
  }

  // 4.1. Proteção de Regressão da IA (bloqueia perda ou recuo de leads com alta intenção de compra sem justificativa)
  const isLost = newStatus === "lost";
  const prevRank = LEAD_STATUS_ORDER[previousStatus] ?? 0;
  const newRank = LEAD_STATUS_ORDER[newStatus] ?? 0;
  const isRegression = isLost || (previousStatus !== "lost" && newRank < prevRank);

  const potentialSaleCheck = isAiPotentialSale(lead.qualificationDetails);

  if (isRegression && potentialSaleCheck.isPotentialSale) {
    const justification = (input.justificativaRegressao ?? "").trim();
    if (justification.length < 15) {
      throw new Error(
        `PROTECAO_REGRESSAO_IA: A IA identificou este atendimento como uma possível venda (${potentialSaleCheck.reason}). Para regredir a etapa ou descartar o lead, é obrigatório fornecer uma justificativa detalhada com no mínimo 15 caracteres para a supervisão.`,
      );
    }
  }

  // 5. Reabertura (saindo de lost)
  const isReopening = previousStatus === "lost" && newStatus !== "lost";

  if (isReopening) {
    await assertCanReopen(context);
  } else {
    await assertCanChangeStatus(context, lead);
  }

  // ─── Executar mudança ───────────────────────────────────────────────
  const now = new Date();
  const motivoPerda = newStatus === "lost" ? input.motivoPerda! : null;

  await db.transaction(async (tx) => {
    // Atualizar lead
    const updated = await tx
      .update(schema.leads)
      .set({
        status: newStatus as LeadStatus,
        stageEnteredAt: now,
        motivoPerda,
        ...(qualificationValidation.newQualificationStatus
          ? { qualificationStatus: qualificationValidation.newQualificationStatus }
          : {}),
        version: lead.version + 1,
      })
      .where(and(eq(schema.leads.id, lead.id), ...(input.expectedVersion === undefined ? [] : [eq(schema.leads.version, input.expectedVersion)])))
      .returning({ id: schema.leads.id });
    if (updated.length !== 1) throw new Error("CONFLICT_VERSION");

    // Criar interação na timeline
    const interactionContent = isReopening
      ? `Lead reaberto (${previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}) por ${context.role === "director" ? "Diretor" : "Gestor"}.`
      : newStatus === "lost"
        ? `Status alterado: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → Perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`
        : `Status alterado: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}.`;

    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: lead.id,
      userId: context.userId,
      tipo: "status_change",
      conteudo: interactionContent,
    });

    // Se houve regressão justificada em lead de alta intenção, registrar alerta e justificativa
    if (isRegression && potentialSaleCheck.isPotentialSale && input.justificativaRegressao) {
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "system_alert",
        conteudo: `[Proteção de Regressão IA] Justificativa do usuário para recuo de lead com alta intenção: "${input.justificativaRegressao.trim()}". (${potentialSaleCheck.reason})`,
        metadata: {
          source: "AI_REGRESSION_PROTECTION",
          aiReason: potentialSaleCheck.reason,
          justification: input.justificativaRegressao.trim(),
          fromStatus: previousStatus,
          toStatus: newStatus,
        },
        createdAt: now,
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead_regression_protection",
        entidadeId: lead.id,
        acao: `regression.overridden:${previousStatus}->${newStatus}`,
        createdAt: now,
      });
    }

    // Criar auditoria
    const auditAction = isReopening
      ? "reabriu"
      : newStatus === "lost"
        ? "perdeu"
        : "alterou";

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: auditAction,
    });
  });

  // ─── Notificações fora da transação (push pode falhar sem efeito colateral) ───

  // Sinal opaco de invalidação de domínio (DEC-081/DEC-077): diretores e gestores
  // elegíveis, o corretor responsável e o autor veem listas e detalhes atualizados
  // sem F5. Best-effort; a mutação já está persistida.
  {
    const watcherScope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const watchers = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.status, "active"), watcherScope))
      .groupBy(schema.tenantMemberships.userId)
      .limit(20);
    const targets = watchers
      .map((watcher) => watcher.userId)
      .filter((userId) => userId !== context.userId);
    if (lead.corretorId && lead.corretorId !== context.userId) targets.push(lead.corretorId);
    void publishDomainInvalidation(
      targets.map((userId) => ({ tenantId: lead.tenantId, userId })),
      "leads",
    ).catch(() => { /* non-blocking */ });
  }

  if (newStatus === "lost") {
    const scope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const supervisors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.status, "active"), scope))
      .groupBy(schema.tenantMemberships.userId)
      .limit(5);

    await Promise.allSettled([
      // Notify the broker
      ...(lead.corretorId
        ? [publishNotification({
            capability: "lead_lost",
            tenantId: lead.tenantId,
            recipientUserId: lead.corretorId,
            leadId: lead.id,
            type: "lead_lost",
            title: "Lead perdido",
            message: `${lead.nome} foi marcado como perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`,
            pushTitle: "Lead Perdido 💔",
            pushBody: `${lead.nome} — ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}.`,
            url: `/leads/${lead.id}`,
            tag: `lead-${lead.id}`,
          })]
        : []),
      // Notify managers and directors
      ...supervisors.map((supervisor) =>
        publishNotification({
          capability: "lead_lost",
          tenantId: lead.tenantId,
          recipientUserId: supervisor.userId,
          leadId: lead.id,
          type: "lead_lost",
          title: "Lead perdido",
          message: `${lead.nome} foi perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`,
          pushTitle: "Lead Perdido! 📉",
          pushBody: `${lead.nome} foi perdido — ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}.`,
          url: `/leads/${lead.id}`,
          tag: `lead-${lead.id}`,
        }),
      ),
    ].map((p) => p.catch(() => { /* non-blocking */ })));
  }

  if (isReopening) {
    const roleLabel = context.role === "director" ? "Diretor" : "Gestor";
    const newStatusLabel = LEAD_STATUS_LABELS[newStatus] ?? newStatus;

    // Notify the broker (if they exist and it's not the re-opening user)
    if (lead.corretorId && lead.corretorId !== context.userId) {
      void publishNotification({
        capability: "lead_reopened",
        tenantId: lead.tenantId,
        recipientUserId: lead.corretorId,
        leadId: lead.id,
        type: "lead_reopened",
        title: "Lead reaberto",
        message: `${lead.nome} foi reaberto por ${roleLabel} e está agora em "${newStatusLabel}".`,
        pushTitle: "Lead Reaberto! 🔄",
        pushBody: `${lead.nome} foi reaberto por ${roleLabel} — status: ${newStatusLabel}.`,
        url: `/leads/${lead.id}`,
        tag: `lead-${lead.id}`,
      }).catch(() => { /* non-blocking */ });
    }

    // Notify managers and directors
    const scope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const supervisors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.status, "active"), scope))
      .groupBy(schema.tenantMemberships.userId)
      .limit(5);

    await Promise.allSettled(
      supervisors
        .filter((s) => s.userId !== context.userId)
        .map((supervisor) =>
          publishNotification({
            capability: "lead_reopened",
            tenantId: lead.tenantId,
            recipientUserId: supervisor.userId,
            leadId: lead.id,
            type: "lead_reopened",
            title: "Lead reaberto",
            message: `${lead.nome} foi reaberto por ${roleLabel} e está em "${newStatusLabel}".`,
            pushTitle: "Lead Reaberto! 🔄",
            pushBody: `${lead.nome} foi reaberto — novo status: ${newStatusLabel}.`,
            url: `/leads/${lead.id}`,
            tag: `lead-${lead.id}`,
          }).catch(() => { /* non-blocking */ }),
        ),
    );
  }

  if (newStatus === "lost") {
    const { triggerInstantAutomation } = await import("@/features/automations/engine");
    void triggerInstantAutomation(lead.tenantId, lead.id, "lead_perdido").catch(console.error);
  } else if (newStatus === "distributed" || newStatus === "novo") {
    const { triggerInstantAutomation } = await import("@/features/automations/engine");
    void triggerInstantAutomation(lead.tenantId, lead.id, "alerta_primeiro_atendimento").catch(console.error);
  }

  return {
    success: true,
    previousStatus,
    newStatus,
    reopened: isReopening,
  };
}
