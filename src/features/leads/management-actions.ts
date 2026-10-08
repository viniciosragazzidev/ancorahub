"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

import { notifyLeadReassigned } from "@/features/notifications/send-push-helper";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { enqueueLeadEffectTx, runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { withServerActionTiming } from "@/shared/observability/request-timing";
import { canRemoveLeadAssignment, getLeadAssignmentBlockedReason } from "./assignment-domain";
import { getActiveQueueDutyRoster } from "@/features/lead-distribution/active-queue-duty-roster";
import { findPostSaleExemptionQueueName, postSaleTransferAuditAction } from "@/features/lead-distribution/post-sale-transfer";
import { ensureDefaultQueue, offerLeadToBrokerManually, routeLeadToBranch } from "@/features/lead-distribution/service";
import { enqueueAndProcessLeadDistribution, enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { getSystemSetting } from "@/features/system-settings/queries";
import { DISTRIBUTION_REMOVAL_NOTE_MAX, DISTRIBUTION_REMOVAL_REASONS, type DistributionRemovalReason } from "@/features/lead-distribution/distribution-removal";

const inputSchema = z.object({ leadId: z.string().uuid(), brokerId: z.string().uuid().nullable(), branchId: z.string().uuid().optional(), dutyScheduleId: z.string().uuid().optional(), assignmentMode: z.enum(["direct", "offer"]).optional() });

export type ManagementActionState = {
  success?: boolean;
  /** The lead has no broker: the screen must ask "direct or offer" and submit again. */
  needsAssignmentMode?: boolean;
  error?: string;
  warning?: string;
  message?: string;
  mutationId?: string;
  entity?: {
    leadId: string;
    branchId: string | null;
    corretorId: string | null;
    status: string;
    distributionStatus?: string;
    distributionRemovalReason?: string | null;
    distributionRemovalNote?: string | null;
  };
};

import { AuthorizationService } from "@/shared/auth/authorization-service";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";

async function getManagedLead(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, status: schema.leads.status, corretorId: schema.leads.corretorId, distributionStatus: schema.leads.distributionStatus, firstContactAt: schema.leads.firstContactAt, serviceStartedAt: schema.leads.serviceStartedAt, archivedAt: schema.leads.archivedAt, deletedAt: schema.leads.deletedAt, queueId: schema.leads.queueId, webhookCredentialId: schema.leads.webhookCredentialId })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");

  const resourceScope = buildLeadResourceScope(lead);
  const accessContext = toEffectiveLeadAccessContext(context);
  const legacyAllowed =
    context.role === "director" ||
    (context.role === "manager" && Boolean(context.branchId) && context.branchId === lead.branchId);

  await evaluateShadowAuthorization({
    operationKey: "lead.reassign",
    legacyAllowed,
    context: accessContext,
    capability: "leads_reassign",
    resource: resourceScope,
  });

  const isDirector = context.role === "director" || accessContext.canAccessAllUnits;
  const isAllowed = isDirector || AuthorizationService.can(accessContext, "leads_reassign", resourceScope) || (context.role === "manager" && accessContext.allowedUnitIds.includes(lead.branchId ?? ""));
  if (!isAllowed) {
    throw new AuthorizationError("Este lead está fora da sua filial ou escopo autorizado.");
  }

  return { context, db, lead };
}

export async function getLeadDutyReassignmentOptions(leadId: string) {
  try {
    const parsedLeadId = z.string().uuid().parse(leadId);
    const { context, db, lead } = await getManagedLead(parsedLeadId);
    const postSaleQueueName = await findPostSaleExemptionQueueName({ tenantId: context.tenantId, originQueueId: lead.queueId });
    if (postSaleQueueName) {
      const brokers = await db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.user.active, true),
          eq(schema.user.status, "active"),
        )).orderBy(asc(schema.user.name));
      // Livre movimentação (2026-10-08): qualquer unidade do tenant, sem exigir ativa/aceitando leads.
      const branches = await db.select({ id: schema.branches.id, name: schema.branches.name })
        .from(schema.branches)
        .where(and(
          eq(schema.branches.tenantId, context.tenantId),
          context.role === "director" ? undefined : eq(schema.branches.isDistributionHub, false),
        )).orderBy(asc(schema.branches.name));
      return { success: true as const, leadId: parsedLeadId, isPostSale: true, hasActiveDuty: false, brokers, branches };
    }
    const roster = await getActiveQueueDutyRoster({
      tenantId: context.tenantId,
      queueId: lead.queueId,
      webhookCredentialId: lead.webhookCredentialId,
    });
    return { success: true as const, leadId: parsedLeadId, isPostSale: false, branches: [], ...roster };
  } catch (error) {
    return {
      success: false as const,
      leadId,
      error: error instanceof AuthorizationError
        ? error.message
        : "Não foi possível consultar o plantão desta fila.",
    };
  }
}

export async function removeLeadAssignmentAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.remove_assignment", async () => {
    const mutationId = randomUUID();
    try {
      const leadId = z.string().uuid().parse(formData.get("leadId"));
      const { context, db, lead } = await getManagedLead(leadId);
      if (!canRemoveLeadAssignment(lead)) {
        throw new Error(getLeadAssignmentBlockedReason(lead) ?? "A atribuição deste lead não pode ser removida neste estado.");
      }

      const now = new Date();
      const currentBrokerId = lead.corretorId!;
      const changed = await db.transaction(async (tx) => {
        // Recheck ownership and service-start markers atomically. If the broker
        // starts a conversation at the same time, only one of the two writes wins.
        const updated = await tx.update(schema.leads).set({
          corretorId: null,
          distributionStatus: "manual_hold",
          assignmentSource: "manual_unassignment",
          distributionUpdatedAt: now,
          updatedAt: now,
        }).where(and(
          eq(schema.leads.id, lead.id),
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, currentBrokerId),
          eq(schema.leads.distributionStatus, "assigned"),
          inArray(schema.leads.status, ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.deletedAt),
        )).returning({ id: schema.leads.id });
        if (!updated.length) return false;

        const activeOffers = await tx.select({ outboundMessageId: schema.leadOffers.outboundMessageId })
          .from(schema.leadOffers)
          .where(and(
            eq(schema.leadOffers.tenantId, context.tenantId),
            eq(schema.leadOffers.leadId, lead.id),
            eq(schema.leadOffers.brokerId, currentBrokerId),
            inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
          ));
        const outboundIds = activeOffers.map((offer) => offer.outboundMessageId).filter((id): id is string => Boolean(id));
        await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          eq(schema.leadOffers.brokerId, currentBrokerId),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ));
        if (outboundIds.length) {
          await tx.update(schema.whatsappOutboundMessages).set({
            status: "cancelled",
            providerErrorCode: "LEAD_ASSIGNMENT_REMOVED",
            providerErrorMessage: "Oferta cancelada porque a atribuição do lead foi removida.",
            failedAt: now,
            updatedAt: now,
          }).where(and(
            eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
            inArray(schema.whatsappOutboundMessages.id, outboundIds),
            inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
          ));
        }
        await tx.update(schema.leadAssignmentAttempts).set({
          status: "released",
          releasedAt: now,
          releaseReason: "Atribuição removida manualmente; o histórico do atendimento foi preservado.",
        }).where(and(
          eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
          eq(schema.leadAssignmentAttempts.leadId, lead.id),
          eq(schema.leadAssignmentAttempts.brokerId, currentBrokerId),
          eq(schema.leadAssignmentAttempts.status, "open"),
        ));
        await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ));
        await tx.update(schema.leadDistributionJobs).set({
          status: "superseded",
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: "MANUAL_ASSIGNMENT_REMOVAL",
          lastErrorMessage: "Lead aguarda uma nova ação manual de distribuição.",
          updatedAt: now,
        }).where(and(
          eq(schema.leadDistributionJobs.tenantId, context.tenantId),
          eq(schema.leadDistributionJobs.leadId, lead.id),
          inArray(schema.leadDistributionJobs.status, ["pending", "retrying"]),
        ));
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: lead.branchId,
          fromQueueId: lead.queueId,
          toQueueId: lead.queueId,
          previousOwnerId: currentBrokerId,
          newOwnerId: null,
          action: "assignment_removed",
          source: context.role === "director" ? "manual_director" : "manual_manager",
          strategy: "manual",
          reason: "Atribuição removida por gestor; etapa e histórico preservados, aguardará ação manual.",
          actorId: context.userId,
          createdAt: now,
        });
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "lead_distribution",
          entidadeId: lead.id,
          acao: "lead.assignment_removed",
          createdAt: now,
        });
        return true;
      });

      if (!changed) throw new Error("O estado do lead mudou. Atualize a página antes de tentar novamente.");
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: [lead.branchId],
        brokerIds: [currentBrokerId],
      }).catch(() => undefined);
      return {
        success: true,
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: null, status: lead.status, distributionStatus: "manual_hold" },
      };
    } catch (error) {
      return { mutationId, error: error instanceof Error ? error.message : "Não foi possível remover a atribuição." };
    }
  });
}

const removalSchema = z.object({
  leadId: z.string().uuid(),
  reason: z.enum(Object.keys(DISTRIBUTION_REMOVAL_REASONS) as [DistributionRemovalReason, ...DistributionRemovalReason[]], { message: "Escolha o motivo da remoção." }),
  note: z.string().trim().max(DISTRIBUTION_REMOVAL_NOTE_MAX, `A observação pode ter até ${DISTRIBUTION_REMOVAL_NOTE_MAX} caracteres.`).optional(),
});

/**
 * Removes a lead without a broker from distribution, whatever its stage.
 * Definitive: the engine never offers it again; only a manual assignment to a
 * broker brings it back. Pending offers and distribution jobs are cancelled.
 */
export async function removeLeadFromDistributionAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.remove_from_distribution", async () => {
    const mutationId = randomUUID();
    try {
      const parsed = removalSchema.safeParse({ leadId: formData.get("leadId"), reason: formData.get("reason"), note: formData.get("note") || undefined });
      if (!parsed.success) return { mutationId, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
      const { context, db, lead } = await getManagedLead(parsed.data.leadId);
      if (context.role !== "director" && context.role !== "manager") throw new AuthorizationError("Apenas Gestores e Diretores podem remover leads da distribuição.");
      if (lead.corretorId) throw new Error("Este lead já tem corretor. Remova a atribuição antes de tirá-lo da distribuição.");
      if (lead.archivedAt || lead.deletedAt) throw new Error("Lead arquivado ou excluído.");

      const now = new Date();
      const note = parsed.data.note || null;
      const reasonLabel = DISTRIBUTION_REMOVAL_REASONS[parsed.data.reason].label;
      const changed = await db.transaction(async (tx) => {
        const updated = await tx.update(schema.leads).set({
          distributionStatus: "removed",
          distributionRemovedAt: now,
          distributionRemovalReason: parsed.data.reason,
          distributionRemovalNote: note,
          distributionRemovedBy: context.userId,
          distributionUpdatedAt: now,
          updatedAt: now,
        }).where(and(
          eq(schema.leads.id, lead.id),
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.corretorId),
          isNull(schema.leads.distributionRemovedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.deletedAt),
        )).returning({ id: schema.leads.id });
        if (!updated.length) return false;

        await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ));
        await tx.update(schema.leadDistributionJobs).set({
          status: "completed",
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: "REMOVED_FROM_DISTRIBUTION",
          lastErrorMessage: reasonLabel,
          updatedAt: now,
        }).where(and(
          eq(schema.leadDistributionJobs.tenantId, context.tenantId),
          eq(schema.leadDistributionJobs.leadId, lead.id),
          inArray(schema.leadDistributionJobs.status, ["pending", "retrying"]),
        ));
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: lead.branchId,
          fromQueueId: lead.queueId,
          toQueueId: lead.queueId,
          previousOwnerId: null,
          newOwnerId: null,
          action: "removed_from_distribution",
          source: context.role === "director" ? "manual_director" : "manual_manager",
          strategy: "manual",
          reason: note ? `${reasonLabel}. ${note}` : reasonLabel,
          actorId: context.userId,
          metadata: { removalReason: parsed.data.reason, note },
          createdAt: now,
        } as typeof schema.leadDistributionEvents.$inferInsert);
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "lead_distribution",
          entidadeId: lead.id,
          acao: `lead.removed_from_distribution:${parsed.data.reason}`,
          createdAt: now,
        });
        return true;
      });

      if (!changed) throw new Error("O estado do lead mudou. Atualize a página antes de tentar novamente.");
      void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [lead.branchId], brokerIds: [] }).catch(() => undefined);
      return {
        success: true,
        message: "Lead removido da distribuição.",
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: null, status: lead.status, distributionStatus: "removed", distributionRemovalReason: parsed.data.reason, distributionRemovalNote: note },
      };
    } catch (error) {
      return { mutationId, error: error instanceof Error ? error.message : "Não foi possível remover o lead da distribuição." };
    }
  });
}

export async function reassignLeadAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.reassign", async () => {
    const mutationId = randomUUID();
    try {
      const input = inputSchema.parse({ leadId: formData.get("leadId"), brokerId: String(formData.get("brokerId") || "") || null, branchId: String(formData.get("branchId") || "") || undefined, dutyScheduleId: String(formData.get("dutyScheduleId") || "") || undefined, assignmentMode: formData.get("assignmentMode") || undefined });
      const { context, db, lead } = await getManagedLead(input.leadId);
      if ((await getSystemSetting("feature_lead_management_actions_enabled")) === "false") throw new Error("As ações de gestão de leads estão desativadas pelo Super-admin.");
      if (lead.archivedAt || lead.deletedAt) throw new Error("Não é possível reatribuir um lead arquivado ou excluído.");
      // Pós Venda (2026-10-08): livre movimentação para qualquer unidade ou corretor,
      // inclusive lead vendido/perdido (o status é preservado nesse caso).
      const postSaleQueueName = await findPostSaleExemptionQueueName({ tenantId: context.tenantId, originQueueId: lead.queueId });
      const isPostSale = Boolean(postSaleQueueName);
      const isClosedLead = lead.status === "lost" || lead.status === "converted";
      const keepsClosedStatus = isPostSale && isClosedLead;
      if (isClosedLead && !isPostSale) throw new Error("Leads encerrados não podem ser reatribuídos.");
      const changesBranch = Boolean(input.branchId && input.branchId !== lead.branchId);
      if (input.brokerId && input.brokerId === lead.corretorId && !(isPostSale && changesBranch)) throw new Error("Selecione outro corretor para reiniciar o atendimento.");
      if (!input.brokerId) throw new Error("Selecione um corretor para reatribuir o lead.");
      const activeDutyRoster = lead.queueId && !isPostSale ? await getActiveQueueDutyRoster({
        tenantId: context.tenantId,
        queueId: lead.queueId,
        webhookCredentialId: lead.webhookCredentialId,
      }) : { hasActiveDuty: false, brokers: [] };
      const selectedDutyBroker = input.dutyScheduleId
        ? activeDutyRoster.brokers.find((candidate) => candidate.id === input.brokerId && candidate.scheduleId === input.dutyScheduleId)
        : undefined;
      if (activeDutyRoster.hasActiveDuty && !selectedDutyBroker) {
        throw new Error("Selecione um corretor escalado no plantão ativo desta fila.");
      }
      if (input.dutyScheduleId && !activeDutyRoster.hasActiveDuty) {
        throw new Error("Este plantão não está ativo para a fila do lead. Atualize o drawer e tente novamente.");
      }
      const dutyScheduleId = selectedDutyBroker?.scheduleId ?? null;
      const isDutyReassignment = Boolean(dutyScheduleId);
      const targetBranchId = isDutyReassignment ? lead.branchId : input.branchId ?? lead.branchId;
      if (!targetBranchId) throw new Error("Selecione uma unidade para reatribuir o lead.");
      const accessContext = toEffectiveLeadAccessContext(context);
      const targetResourceScope = buildLeadResourceScope({ tenantId: context.tenantId, branchId: targetBranchId });
      const targetScopeAllowed = context.role === "director" || accessContext.canAccessAllUnits ||
        AuthorizationService.can(accessContext, "leads_reassign", targetResourceScope);
      if (!targetScopeAllowed) throw new AuthorizationError("A unidade de destino está fora do seu escopo autorizado.");
      const [targetBranch] = await db.select({ id: schema.branches.id, status: schema.branches.status, acceptingLeads: schema.branches.acceptingLeads, isDistributionHub: schema.branches.isDistributionHub })
        .from(schema.branches).where(and(eq(schema.branches.id, targetBranchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
      if (isPostSale && (!targetBranch || (targetBranch.isDistributionHub && context.role !== "director"))) {
        throw new AuthorizationError("A unidade do lead não está disponível para esta operação.");
      }
      if (!isDutyReassignment && !isPostSale && (!targetBranch || targetBranch.status !== "active" || !targetBranch.acceptingLeads || targetBranch.isDistributionHub)) {
        throw new Error("A unidade escolhida não está ativa e apta a receber leads.");
      }
      const assignmentChoiceEnabled = (await getSystemSetting("feature_manual_lead_assignment_offer_choice_enabled")) !== "false";
      const serviceAlreadyStarted = Boolean(lead.firstContactAt || lead.serviceStartedAt) || ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status);
      if (!lead.corretorId && assignmentChoiceEnabled && !input.assignmentMode && !serviceAlreadyStarted) return { mutationId, needsAssignmentMode: true, error: "Escolha se deseja atribuir direto ou enviar uma oferta para aceite." };
      if (input.assignmentMode && (!assignmentChoiceEnabled || lead.corretorId)) throw new Error("Esta escolha está disponível somente para leads sem corretor e quando habilitada pelo Super-admin.");
      if (input.assignmentMode === "offer" && serviceAlreadyStarted) throw new Error("Para transferir um atendimento iniciado, use a atribuição direta.");
      const brokerId = input.brokerId;
      const assignmentEventId = randomUUID();
      const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.brokerId), isDutyReassignment || isPostSale ? undefined : eq(schema.tenantMemberships.branchId, targetBranchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).limit(1);
      if (!broker || (selectedDutyBroker && broker.branchId !== selectedDutyBroker.branchId)) throw new Error(isPostSale ? "O corretor selecionado não está ativo neste tenant." : isDutyReassignment ? "O corretor não pertence mais ao plantão ativo desta fila." : "O corretor selecionado não está ativo nesta unidade.");
      // Pós Venda na mesma unidade continua na fila Pós Venda; mudando de unidade, vai para a fila padrão do destino.
      const targetQueueId = isDutyReassignment || (isPostSale && targetBranchId === lead.branchId) ? lead.queueId : await ensureDefaultQueue(context.tenantId, targetBranchId, context.userId);
      if (!targetQueueId) throw new Error("A fila do lead não está mais disponível.");
      if (input.assignmentMode === "offer") {
        const offered = await offerLeadToBrokerManually(context, lead.id, brokerId, { targetBranchId, targetQueueId, ...(dutyScheduleId ? { dutyScheduleId } : {}) });
        if (offered.status === "conflict") throw new Error(offered.reason);
        if (offered.status === "fallback") {
          if (!isDutyReassignment && !isPostSale) {
            const routed = await routeLeadToBranch(context, lead.id, targetBranchId, "Fallback da oferta manual", true);
            if (routed.status !== "routed") throw new Error("A oferta falhou e o lead não pôde ser encaminhado à unidade selecionada.");
          }
          await enqueueAndProcessLeadDistribution({ tenantId: context.tenantId, leadId: lead.id, source: "manual_offer_delivery_failed" });
          return { success: true, message: offered.reason, mutationId, entity: { leadId: lead.id, branchId: targetBranchId, corretorId: null, status: lead.status, distributionStatus: "queued" } };
        }
        await enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: lead.id, runAfter: offered.expiresAt });
        void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [lead.branchId, targetBranchId].filter((id): id is string => Boolean(id)), brokerIds: [brokerId] }).catch(() => undefined);
        return { success: true, message: "Oferta enviada ao corretor. Se não houver aceite no prazo configurado, o lead volta à distribuição normal.", mutationId, entity: { leadId: lead.id, branchId: targetBranchId, corretorId: brokerId, status: "distributed", distributionStatus: "assigned" } };
      }
      const now = new Date();
      const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);

      await db.transaction(async (tx) => {
        const updated = await tx.update(schema.leads).set({
          branchId: targetBranchId,
          queueId: targetQueueId,
          dutyScheduleId,
          corretorId: input.brokerId,
          distributionStatus: "assigned",
          assignmentSource: context.role === "director" ? "manual_director" : "manual_manager",
          assignmentStrategy: "manual",
          distributionUpdatedAt: now,
          assignedAt: now,
          // Lead vendido/perdido na Pós Venda só troca de dono/unidade; venda e histórico ficam.
          ...(keepsClosedStatus ? {} : {
            status: "distributed" as const,
            firstContactAt: null,
            serviceStartedAt: null,
            serviceStartedBy: null,
            stageEnteredAt: now,
            motivoPerda: null,
          }),
          // A manual assignment is the only way back from "removed from distribution".
          distributionRemovedAt: null,
          distributionRemovalReason: null,
          distributionRemovalNote: null,
          distributionRemovedBy: null,
        }).where(and(
          eq(schema.leads.id, lead.id),
          eq(schema.leads.tenantId, context.tenantId),
          lead.queueId ? eq(schema.leads.queueId, lead.queueId) : isNull(schema.leads.queueId),
          isPostSale ? (lead.branchId ? eq(schema.leads.branchId, lead.branchId) : isNull(schema.leads.branchId)) : undefined,
          lead.corretorId ? eq(schema.leads.corretorId, lead.corretorId) : isNull(schema.leads.corretorId),
          eq(schema.leads.status, lead.status),
          lead.firstContactAt ? eq(schema.leads.firstContactAt, lead.firstContactAt) : isNull(schema.leads.firstContactAt),
          lead.serviceStartedAt ? eq(schema.leads.serviceStartedAt, lead.serviceStartedAt) : isNull(schema.leads.serviceStartedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.deletedAt),
        )).returning({ id: schema.leads.id });
        if (!updated.length) throw new Error("O estado do lead mudou. Atualize a página antes de tentar novamente.");
        await tx.update(schema.leadAssignmentAttempts).set({
          status: "released",
          releasedAt: now,
          releaseReason: "Reatribuição manual; atendimento reiniciado para outro corretor, com histórico preservado.",
        }).where(and(
          eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
          eq(schema.leadAssignmentAttempts.leadId, lead.id),
          eq(schema.leadAssignmentAttempts.status, "open"),
        ));
        if (tenantPolicy?.feedbackRequiredEnabled !== false && !keepsClosedStatus) await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: lead.tenantId, leadId: lead.id, brokerId, sequence: 1, assignedAt: now, feedbackDueAt: new Date(now.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000), status: "open", createdAt: now });
        await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: keepsClosedStatus ? `Lead da Pós Venda transferido por ${context.role === "director" ? "Diretor" : "Gestor"}; status e histórico preservados.` : `Lead reatribuído por ${context.role === "director" ? "Diretor" : "Gestor"}; atendimento e SLA reiniciados, com histórico preservado.` });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: isPostSale ? postSaleTransferAuditAction(postSaleQueueName) : "reatribuiu_lead" });
        await tx.insert(schema.leadDistributionEvents).values({
          id: assignmentEventId,
          tenantId: lead.tenantId,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          fromQueueId: lead.queueId,
          toQueueId: targetQueueId,
          toBranchId: targetBranchId,
          previousOwnerId: lead.corretorId,
          newOwnerId: brokerId,
          action: "assigned",
          source: context.role === "director" ? "manual_director" : "manual_manager",
          strategy: "manual",
          reason: isPostSale ? (changesBranch ? "Transferência livre da Pós Venda para outra unidade e corretor." : "Atribuição manual da Pós Venda; fila e unidade preservadas.")
            : isDutyReassignment
            ? "Reatribuição manual para corretor escalado no plantão ativo desta fila."
            : "Transferência manual entre unidades; fila e campanha não restringem a atribuição.",
          metadata: {
            assignmentScope: isPostSale ? "post_sale_transfer_exemption" : isDutyReassignment ? "active_duty_roster" : "manual_cross_unit_override",
            ...(isPostSale ? { exemptionQueueName: postSaleQueueName } : {}),
            ...(dutyScheduleId ? { dutyScheduleId } : {}),
            assignedBrokerBranchId: broker.branchId,
            previousStatus: lead.status,
            previousFirstContactAt: lead.firstContactAt?.toISOString() ?? null,
            previousServiceStartedAt: lead.serviceStartedAt?.toISOString() ?? null,
            serviceRestarted: !keepsClosedStatus,
          },
          actorId: context.userId,
          createdAt: now,
        });
        await enqueueLeadEffectTx(tx, {
          tenantId: lead.tenantId,
          leadId: lead.id,
          type: "NOTIFY_LEAD_ASSIGNED",
          idempotencyKey: `lead-assigned:${assignmentEventId}`,
          payload: {
            branchId: targetBranchId,
            brokerId,
            leadName: lead.nome,
            isRedistribution: lead.corretorId ? "true" : "false",
            ...(input.assignmentMode === "direct" ? { skipBrokerWhatsapp: "true" } : {}),
          },
        });
      });
      if (lead.corretorId && lead.corretorId !== brokerId) {
        void notifyLeadReassigned(lead.id, lead.tenantId, lead.corretorId, lead.nome).catch(console.error);
      }
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: Array.from(new Set([lead.branchId, targetBranchId, broker.branchId].filter((branchId): branchId is string => Boolean(branchId)))),
        brokerIds: [lead.corretorId, input.brokerId],
      }).catch(() => undefined);
      scheduleAfterResponse("lead-assignment-effects", async () => {
        await runLeadEffectOutboxProcessor({
          tenantId: context.tenantId,
          leadId: lead.id,
          limit: 5,
        });
      });
      return {
        success: true,
        mutationId,
        entity: { leadId: lead.id, branchId: targetBranchId, corretorId: input.brokerId, status: keepsClosedStatus ? lead.status : "distributed", distributionStatus: "assigned" },
      };
    } catch (error) {
      return { mutationId, error: error instanceof Error ? error.message : "Não foi possível reatribuir o lead." };
    }
  });
}

export async function assumeLeadForInvestigationAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  const mutationId = randomUUID();
  try {
    const leadId = z.string().uuid().parse(formData.get("leadId"));
    const reason = z.string().trim().min(3).max(200).parse(formData.get("reason"));
    const { context, db, lead } = await getManagedLead(leadId);
    if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está ativo em atendimento e não pode ser assumido por outro usuário.");
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ corretorId: context.userId, status: "under_analysis", distributionStatus: "assigned", assignedAt: now, stageEnteredAt: now, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null }).where(eq(schema.leads.id, lead.id));
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `Lead assumido para investigação por ${context.role === "director" ? "Diretor" : "Gestor"}. Motivo: ${reason}` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_lead_investigacao" });
    });
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [lead.branchId],
      brokerIds: [lead.corretorId, context.userId],
    }).catch(() => undefined);
    return {
      success: true,
      mutationId,
      entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: "under_analysis" },
    };
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível assumir o lead para investigação." };
  }
}

export async function assumeLeadForMessagingAction(leadId: string): Promise<ManagementActionState> {
  const mutationId = randomUUID();
  try {
    const { context, db, lead } = await getManagedLead(z.string().uuid().parse(leadId));
    if (lead.corretorId === context.userId) {
      return {
        success: true,
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: lead.status },
      };
    }
    if (!lead.corretorId) throw new Error("Este lead ainda não possui um corretor responsável.");
    const currentOwnerId = lead.corretorId;
    if (!["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) {
      throw new Error("O atendimento só pode ser assumido quando já estiver ativo.");
    }
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const result = await tx.update(schema.leads).set({ corretorId: context.userId, distributionStatus: "assigned", assignedAt: now, stageEnteredAt: now, serviceStartedBy: context.userId })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, currentOwnerId)))
        .returning({ id: schema.leads.id });
      if (!result.length) return false;
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `${context.role === "director" ? "Diretor" : "Gestor"} assumiu o atendimento para continuidade da conversa.` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_atendimento" });
      return true;
    });
    if (!updated) throw new Error("Este atendimento foi assumido por outra pessoa. Atualize a página.");
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [lead.branchId],
      brokerIds: [currentOwnerId, context.userId],
    }).catch(() => undefined);
    return {
      success: true,
      mutationId,
      entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: lead.status },
    };
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível assumir o atendimento." };
  }
}
