import "server-only";

import { and, desc, eq, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { enqueueAndProcessLeadDistribution } from "@/features/lead-distribution/jobs";
import { transitionConversationState } from "./conversation-state-machine";
import { resolveQualificationTimeoutRoute } from "./qualification-timeout-routing";

export interface QualificationTimeoutSweepResult {
  tenantsChecked: number;
  timedOutLeads: number;
  distributedLeads: number;
}

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
    const cutoffDate = new Date(now - timeoutMinutes * 60 * 1000);

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
          or(
            eq(schema.leads.qualificationState, "IN_PROGRESS"),
            eq(schema.leads.qualificationStatus, "qualifying"),
            eq(schema.leads.qualificationStatus, "pending"),
            isNull(schema.leads.qualificationStatus)
          ),
          notInArray(schema.leads.qualificationStatus, [
            "qualified",
            "hot",
            "warm",
            "cold",
            "disqualified",
            "not_qualified",
            "waiting_human"
          ])
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

      // Se a última atividade ainda estiver dentro da janela de tolerância, não expirar
      if (lastActivityAt >= cutoffDate) {
        continue;
      }

      timedOutLeadsCount += 1;
      const updateTime = new Date();

      // Verificar se o lead interagiu (respondeu ao menos uma mensagem)
      const [incomingMessage] = await db
        .select({ id: schema.whatsappMessages.id })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, tenant.id),
            or(
              eq(schema.whatsappMessages.leadId, lead.id),
              and(isNotNull(schema.whatsappMessages.phone), eq(schema.whatsappMessages.phone, lead.telefone ?? ""))
            ),
            notInArray(schema.whatsappMessages.direction, ["outbound", "outgoing"])
          )
        )
        .limit(1);

      const hasInteracted = Boolean(incomingMessage);
      const targetQualificationStatus = hasInteracted ? "warm" : "cold";

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
        // 1. Atualizar Lead: Status Morno/Frio + Finalizar Qualificação + Mover p/ Fila de Distribuição
        await tx
          .update(schema.leads)
          .set({
            qualificationStatus: targetQualificationStatus,
            qualificationState: "QUALIFIED",
            qualificationCompletedAt: updateTime,
            queueId: targetRoute.queueId || null,
            branchId: resolvedBranchId,
            status: "new",
            distributionStatus: "queued",
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
          conteudo: hasInteracted
            ? `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead interagiu com o atendimento e foi qualificado como Morno (Warm), permanecendo na fila de distribuição configurada.`
            : `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead não respondeu a nenhuma mensagem e foi qualificado como Frio (Cold), permanecendo na fila de distribuição configurada.`,
        });

        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: tenant.id,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: resolvedBranchId,
          toQueueId: targetRoute.queueId || null,
          action: "qualification_timeout_queued",
          source: "qualification_timeout",
          strategy: "automatic",
          reason: `Tempo de resposta da qualificação excedido (${timeoutMinutes} min).`,
          actorId: systemUserId,
          createdAt: updateTime,
        });

        // 3. Registrar Log de Auditoria
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: systemUserId,
          entidade: "lead",
          entidadeId: lead.id,
          acao: "qualification.timeout_auto_distributed",
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

      // 5. Encerrar Atendimento do Robô de IA para este Lead (se houver conversa)
      if (aiConv?.id) {
        await transitionConversationState({
          tenantId: tenant.id,
          conversationId: aiConv.id,
          newStatus: "CLOSED",
          reason: `Estouro do tempo limite de qualificação (${timeoutMinutes} min sem resposta). IA encerrada.`,
        }).catch(() => undefined);
      }

      // 6. Tentativa imediata de distribuição para corretor da unidade
      await enqueueAndProcessLeadDistribution({
        tenantId: tenant.id,
        leadId: lead.id,
        source: "qualification_timeout",
      });

      distributedLeadsCount += 1;
    }
  }

  return {
    tenantsChecked: tenants.length,
    timedOutLeads: timedOutLeadsCount,
    distributedLeads: distributedLeadsCount,
  };
}
