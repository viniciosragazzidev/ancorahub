import "server-only";

import { and, desc, eq, isNotNull, isNull, ne, notInArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { enqueueAndProcessLeadDistribution } from "@/features/lead-distribution/jobs";
import { enqueueMetaQualificationConversion } from "@/features/meta-ads/meta-conversion-service";
import { transitionConversationState } from "./conversation-state-machine";
import { resolveQualificationTimeoutRoute } from "./qualification-timeout-routing";
import type { ConversationMemory } from "./memory";
import { hasQualificationTimedOut, qualificationTimeoutDistributionStatus, qualificationTimeoutOutcome } from "./qualification-timeout-policy";

export interface QualificationTimeoutSweepResult {
  tenantsChecked: number;
  timedOutLeads: number;
  distributedLeads: number;
}

/**
 * Statuses the sweep never touches. "hot" is not here: since 23/10 a lead with
 * plan type, lives and ages is hot while the conversation is still IN_PROGRESS,
 * and only this sweep closes it when the customer stops answering. Excluding it
 * left those hot leads out of distribution for good (incident 26/10).
 */
export const QUALIFICATION_TIMEOUT_SKIPPED_STATUSES = [
  "qualified",
  "warm",
  "cold",
  "disqualified",
  "not_qualified",
  "waiting_human",
  "no_whatsapp_contact",
  "meta_blocked",
] as const;

export async function runQualificationTimeoutSweep(tenantIdFilter?: string): Promise<QualificationTimeoutSweepResult> {
  let db;
  try {
    db = getDatabase();
  } catch {
    return { tenantsChecked: 0, timedOutLeads: 0, distributedLeads: 0 };
  }
  const now = Date.now();

  // Buscar os tenants ativos e suas configurações de qualificação
  const tenants = await db
    .select({
      id: schema.tenants.id,
    })
    .from(schema.tenants)
    .where(tenantIdFilter ? eq(schema.tenants.id, tenantIdFilter) : eq(schema.tenants.status, "active"));

  let timedOutLeadsCount = 0;
  let distributedLeadsCount = 0;

  for (const tenant of tenants) {
    // Buscar timeout configurado para o tenant (padrão: 15/20 minutos)
    const [config] = await db
      .select({
        timeoutMinutes: schema.aiQualificationConfigs.timeoutMinutes,
      })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, tenant.id))
      .limit(1);

    const timeoutMinutes = Math.max(1, config?.timeoutMinutes ?? 15);
    // Seleciona todos os leads em qualificação que não possuem corretor atribuído
    const qualifyingLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
        queueId: schema.leads.queueId,
        branchId: schema.leads.branchId,
        metaCampaignId: schema.leads.metaCampaignId,
        sourceCampaign: schema.leads.sourceCampaign,
        createdAt: schema.leads.createdAt,
        updatedAt: schema.leads.updatedAt,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenant.id),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.corretorId),
          // A lead a manager put on hold waits for a manual action: never back to automatic distribution.
          ne(schema.leads.distributionStatus, "manual_hold"),
          isNull(schema.leads.distributionRemovedAt),
          or(
            eq(schema.leads.qualificationState, "IN_PROGRESS"),
            eq(schema.leads.qualificationStatus, "qualifying"),
            eq(schema.leads.qualificationStatus, "pending"),
            isNull(schema.leads.qualificationStatus)
          ),
          notInArray(schema.leads.qualificationStatus, [...QUALIFICATION_TIMEOUT_SKIPPED_STATUSES])
        )
      );

    if (!qualifyingLeads.length) continue;

    const [anyMember] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.status, "active")))
      .limit(1);

    const systemUserId = anyMember?.userId || (await resolveSystemUserId(tenant.id));

    for (const lead of qualifyingLeads) {
      // 1. Localizar conversa de IA ativa (se houver)
      const [aiConv] = await db
        .select({
          id: schema.aiConversations.id,
          status: schema.aiConversations.status,
          automationState: schema.aiConversations.automationState,
          lastActivityAt: schema.aiConversations.lastActivityAt,
          updatedAt: schema.aiConversations.updatedAt,
          memory: schema.aiConversations.memory,
        })
        .from(schema.aiConversations)
        .where(
          and(
            eq(schema.aiConversations.tenantId, tenant.id),
            eq(schema.aiConversations.leadId, lead.id)
          )
        )
        .orderBy(desc(schema.aiConversations.updatedAt))
        .limit(1);

      // 2. Localizar última mensagem de WhatsApp trocada
      const [latestMsg] = await db
        .select({
          id: schema.whatsappMessages.id,
          sentAt: schema.whatsappMessages.sentAt,
          direction: schema.whatsappMessages.direction,
        })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, tenant.id),
            or(
              eq(schema.whatsappMessages.leadId, lead.id),
              and(isNotNull(schema.whatsappMessages.phone), eq(schema.whatsappMessages.phone, lead.telefone ?? ""))
            )
          )
        )
        .orderBy(desc(schema.whatsappMessages.sentAt))
        .limit(1);

      // 3. Determinar a data da última atividade real
      const lastActivityAt: Date =
        latestMsg?.sentAt ??
        aiConv?.lastActivityAt ??
        aiConv?.updatedAt ??
        lead.createdAt ??
        new Date();

      const [latestReopen] = await db
        .select({ createdAt: schema.auditLogs.createdAt })
        .from(schema.auditLogs)
        .innerJoin(
          schema.leads,
          and(
            eq(schema.auditLogs.entidade, "lead"),
            eq(schema.auditLogs.entidadeId, schema.leads.id),
          ),
        )
        .where(
          and(
            eq(schema.leads.id, lead.id),
            eq(schema.leads.tenantId, tenant.id),
            eq(schema.auditLogs.acao, "qualification.manually_reverted_to_qualifying"),
          ),
        )
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(1);

      // Reabrir manualmente reinicia a janela; atividade posterior ainda prevalece.
      if (!hasQualificationTimedOut({
        lastActivityAt,
        reopenedAt: latestReopen?.createdAt,
        now: new Date(now),
        timeoutMinutes,
      })) {
        continue;
      }

      timedOutLeadsCount += 1;
      const updateTime = new Date();

      // Somente uma resposta válida a uma pergunta já enviada classifica como morno.
      // A primeira mensagem de intake (ex.: "quero cotação empresarial") não basta.
      const conversationMessages = await db
        .select({
          id: schema.whatsappMessages.id,
          messageId: schema.whatsappMessages.messageId,
          senderRole: schema.whatsappMessages.senderRole,
          body: schema.whatsappMessages.body,
          direction: schema.whatsappMessages.direction,
          sentAt: schema.whatsappMessages.sentAt,
        })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, tenant.id),
            or(
              eq(schema.whatsappMessages.leadId, lead.id),
              and(isNotNull(schema.whatsappMessages.phone), eq(schema.whatsappMessages.phone, lead.telefone ?? ""))
            ),
          )
        )
        .orderBy(schema.whatsappMessages.sentAt);

      const timeoutOutcome = qualificationTimeoutOutcome(
        aiConv?.memory as ConversationMemory | null | undefined,
        conversationMessages,
      );
      const targetQualificationStatus = timeoutOutcome.qualificationStatus;
      const targetDistributionStatus = qualificationTimeoutDistributionStatus(targetQualificationStatus);

      const campaignId = lead.metaCampaignId || lead.sourceCampaign;
      const [configuredRoute] = campaignId
        ? await db
            .select({
              queueId: schema.leadQueues.id,
              branchId: schema.leadQueues.branchId,
            })
            .from(schema.metaCampaignQueueRoutes)
            .innerJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
            .where(
              and(
                eq(schema.metaCampaignQueueRoutes.tenantId, tenant.id),
                eq(schema.metaCampaignQueueRoutes.campaignId, campaignId),
                eq(schema.metaCampaignQueueRoutes.enabled, true),
                eq(schema.leadQueues.tenantId, tenant.id),
                eq(schema.leadQueues.status, "active")
              )
            )
            .limit(1)
        : [];

      const targetRoute = resolveQualificationTimeoutRoute({
        currentQueueId: lead.queueId,
        currentBranchId: lead.branchId,
        configuredRoute,
      });

      let resolvedBranchId = targetRoute.branchId;
      if (!resolvedBranchId) {
        const [defaultBranch] = await db
          .select({ id: schema.branches.id })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, tenant.id), eq(schema.branches.status, "active")))
          .limit(1);
        resolvedBranchId = defaultBranch?.id ?? null;
      }

      await db.transaction(async (tx) => {
        // 1. Preserve the queue and incomplete qualification. No-valid-data cold leads wait for manual requalification.
        await tx
          .update(schema.leads)
          .set({
            qualificationStatus: targetQualificationStatus,
            qualificationState: timeoutOutcome.qualificationState,
            qualificationCompletedAt: null,
            queueId: targetRoute.queueId || null,
            branchId: resolvedBranchId,
            status: "new",
            distributionStatus: targetDistributionStatus,
            distributionUpdatedAt: updateTime,
            updatedAt: updateTime,
          })
          .where(eq(schema.leads.id, lead.id));

        // 2. Registrar Interação de Alerta de SLA
        await tx.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: lead.id,
          userId: systemUserId,
          tipo: "system_alert",
          conteudo: targetQualificationStatus === "warm"
            ? `Tempo limite da qualificação excedido (${timeoutMinutes} min). Lead respondeu a uma pergunta com dado válido, foi classificado como Morno e permaneceu com qualificação parcial na fila configurada.`
            : `Tempo limite da qualificação excedido (${timeoutMinutes} min). Lead não informou dado válido em resposta à qualificação, foi classificado como Frio e permaneceu com qualificação parcial na fila configurada.`,
        });

        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: tenant.id,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: resolvedBranchId,
          toQueueId: targetRoute.queueId || null,
          action: targetDistributionStatus === "manual_hold" ? "qualification_timeout_manual_hold" : "qualification_timeout_queued",
          source: "qualification_timeout",
          strategy: targetDistributionStatus === "manual_hold" ? "manual" : "automatic",
          reason: targetDistributionStatus === "manual_hold"
            ? `Tempo limite excedido (${timeoutMinutes} min) sem dado válido. Aguarda requalificação manual.`
            : `Tempo de resposta da qualificação excedido (${timeoutMinutes} min).`,
          actorId: systemUserId,
          createdAt: updateTime,
        });

        // 3. Registrar Log de Auditoria
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: systemUserId,
          entidade: "lead",
          entidadeId: lead.id,
          acao: targetDistributionStatus === "manual_hold"
            ? "qualification.timeout_manual_hold"
            : "qualification.timeout_auto_distributed",
        });

        // 4. Encerrar Sessão legada de qualificação se existir
        await tx
          .update(schema.aiQualificationSessions)
          .set({ status: "expired", updatedAt: updateTime })
          .where(
            and(
              eq(schema.aiQualificationSessions.tenantId, tenant.id),
              eq(schema.aiQualificationSessions.leadId, lead.id)
            )
          );
      });

      // Conversions API for CRM: a warm timeout still counts as "Qualificado" (never throws).
      await enqueueMetaQualificationConversion({ tenantId: tenant.id, leadId: lead.id, qualificationStatus: targetQualificationStatus, at: updateTime });

      // 5. Encerrar Atendimento do Robô de IA para este Lead (se houver conversa)
      if (aiConv?.id) {
        await transitionConversationState({
          tenantId: tenant.id,
          conversationId: aiConv.id,
          newStatus: "CLOSED",
          reason: `Estouro do tempo limite de qualificação (${timeoutMinutes} min sem dado válido). IA encerrada.`,
        }).catch(() => undefined);
      }

      // Only an actual valid reply can be routed after timeout. Cold leads stay
      // visible to the manual requalification panel without entering a job.
      if (targetDistributionStatus === "queued") {
        await enqueueAndProcessLeadDistribution({
          tenantId: tenant.id,
          leadId: lead.id,
          source: "qualification_timeout",
        });
        distributedLeadsCount += 1;
      }
    }
  }

  return {
    tenantsChecked: tenants.length,
    timedOutLeads: timedOutLeadsCount,
    distributedLeads: distributedLeadsCount,
  };
}
