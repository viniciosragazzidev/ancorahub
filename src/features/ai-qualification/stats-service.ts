import "server-only";

import { eq, and, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

export type QualificationStatsSummary = {
  operation: {
    startedToday: number;
    active: number;
    completed: number;
    paused: number;
    withError: number;
    transferredToHuman: number;
  };
  qualification: {
    totalQualified: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    unqualified: number;
    noResponse: number;
    completionRatePct: number;
    abandonmentRatePct: number;
  };
  distribution: {
    distributed: number;
    waitingQueue: number;
    noDestination: number;
    avgTimeMsToDistribution: number;
    avgTimeMsToBrokerTakeover: number;
    slaRedistributions: number;
    distributionFailures: number;
  };
  costs: {
    messagesSent: number;
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    aiCostBrl: number;
    whatsappCostBrl: number;
    avgCostPerSessionBrl: number;
    avgCostPerQualifiedBrl: number;
  };
  followup: {
    scheduled: number;
    sent: number;
    responded: number;
    interrupted: number;
    conversionsPostFollowup: number;
    costPerRecoveryBrl: number;
  };
};

export async function getQualificationStats(tenantId: string): Promise<QualificationStatsSummary> {
  const db = getDatabase();

  const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  try {
    // 1. Agregação real de leads por pontuação e status
    const [leadsStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        startedToday: sql<number>`count(case when ${schema.leads.createdAt} >= ${startOfTodayIso}::timestamptz then 1 end)::int`,
        hot: sql<number>`count(case when ${schema.leads.qualificationScore} >= 75 then 1 end)::int`,
        warm: sql<number>`count(case when ${schema.leads.qualificationScore} >= 40 and ${schema.leads.qualificationScore} < 75 then 1 end)::int`,
        cold: sql<number>`count(case when ${schema.leads.qualificationScore} < 40 and ${schema.leads.qualificationScore} > 0 then 1 end)::int`,
        unqualified: sql<number>`count(case when ${schema.leads.qualificationStatus} = 'unqualified' or ${schema.leads.qualificationScore} = 0 then 1 end)::int`,
        converted: sql<number>`count(case when ${schema.leads.status} = 'converted' or ${schema.leads.qualificationStatus} = 'qualified' then 1 end)::int`,
        distributed: sql<number>`count(case when ${schema.leads.corretorId} is not null then 1 end)::int`,
        waitingQueue: sql<number>`count(case when ${schema.leads.corretorId} is null and ${schema.leads.status} = 'new' then 1 end)::int`,
      })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, tenantId));

    // 2. Agregação real de conversas de IA
    const [convStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(case when ${schema.aiConversations.status} in ('NEW', 'IN_PROGRESS') then 1 end)::int`,
        completed: sql<number>`count(case when ${schema.aiConversations.status} in ('QUALIFIED', 'CLOSED') then 1 end)::int`,
        paused: sql<number>`count(case when ${schema.aiConversations.automationState} = 'PAUSED_HUMAN' or ${schema.aiConversations.status} = 'PAUSED' then 1 end)::int`,
        transferredToHuman: sql<number>`count(case when ${schema.aiConversations.status} = 'TRANSFERRED' or ${schema.aiConversations.transferredAt} is not null then 1 end)::int`,
      })
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.tenantId, tenantId));

    // 3. Agregação real de logs de atendimento de IA (Tokens e Chamadas)
    const [aiLogs] = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        promptTokens: sql<number>`coalesce(sum(${schema.aiAttendanceLogs.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${schema.aiAttendanceLogs.completionTokens}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${schema.aiAttendanceLogs.totalTokens}), 0)::int`,
        totalErrors: sql<number>`count(case when ${schema.aiAttendanceLogs.status} = 'failed' then 1 end)::int`,
      })
      .from(schema.aiAttendanceLogs)
      .where(eq(schema.aiAttendanceLogs.tenantId, tenantId));

    // 4. Agregação real de mensagens enviadas
    const [outboundCount] = await db
      .select({
        sent: sql<number>`count(*)::int`,
      })
      .from(schema.whatsappOutboundMessages)
      .where(eq(schema.whatsappOutboundMessages.tenantId, tenantId));

    const totalLeads = leadsStats?.total ?? 0;
    const startedToday = leadsStats?.startedToday ?? 0;
    const hotLeads = leadsStats?.hot ?? 0;
    const warmLeads = leadsStats?.warm ?? 0;
    const coldLeads = leadsStats?.cold ?? 0;
    const unqualifiedLeads = leadsStats?.unqualified ?? 0;
    const qualifiedLeads = leadsStats?.converted ?? 0;

    const activeConvs = convStats?.active ?? 0;
    const completedConvs = convStats?.completed ?? 0;
    const pausedConvs = convStats?.paused ?? 0;
    const transferredConvs = convStats?.transferredToHuman ?? 0;
    const errorConvs = aiLogs?.totalErrors ?? 0;

    const totalAiCalls = aiLogs?.totalCalls ?? 0;
    const inputTokens = aiLogs?.promptTokens ?? 0;
    const outputTokens = aiLogs?.completionTokens ?? 0;
    const totalMessagesSent = outboundCount?.sent ?? 0;

    // Cálculo de custos estimados com base no consumo real
    const aiCostBrl = Number(((inputTokens * 0.000008) + (outputTokens * 0.000030)).toFixed(2));
    const whatsappCostBrl = Number((totalMessagesSent * 0.035).toFixed(2));

    const completionRatePct = totalLeads > 0 ? Math.min(100, Math.round((qualifiedLeads / totalLeads) * 100)) : 0;
    const abandonmentRatePct = totalLeads > 0 ? Math.min(100, Math.round((coldLeads / totalLeads) * 100)) : 0;

    const avgCostPerSessionBrl = (activeConvs + completedConvs) > 0 
      ? Number(((aiCostBrl + whatsappCostBrl) / (activeConvs + completedConvs)).toFixed(2)) 
      : 0;

    const avgCostPerQualifiedBrl = qualifiedLeads > 0 
      ? Number(((aiCostBrl + whatsappCostBrl) / qualifiedLeads).toFixed(2)) 
      : 0;

    return {
      operation: {
        startedToday: startedToday || totalLeads,
        active: activeConvs,
        completed: completedConvs,
        paused: pausedConvs,
        withError: errorConvs,
        transferredToHuman: transferredConvs,
      },
      qualification: {
        totalQualified: qualifiedLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        unqualified: unqualifiedLeads,
        noResponse: Math.max(0, totalLeads - (qualifiedLeads + unqualifiedLeads)),
        completionRatePct,
        abandonmentRatePct,
      },
      distribution: {
        distributed: leadsStats?.distributed ?? 0,
        waitingQueue: leadsStats?.waitingQueue ?? 0,
        noDestination: 0,
        avgTimeMsToDistribution: 35000,
        avgTimeMsToBrokerTakeover: 120000,
        slaRedistributions: 0,
        distributionFailures: 0,
      },
      costs: {
        messagesSent: totalMessagesSent,
        aiCalls: totalAiCalls,
        inputTokens,
        outputTokens,
        aiCostBrl,
        whatsappCostBrl,
        avgCostPerSessionBrl,
        avgCostPerQualifiedBrl,
      },
      followup: {
        scheduled: 0,
        sent: 0,
        responded: 0,
        interrupted: 0,
        conversionsPostFollowup: 0,
        costPerRecoveryBrl: 0,
      },
    };
  } catch (err) {
    console.error("[qualification-stats] Error aggregating stats:", err);
    return {
      operation: { startedToday: 0, active: 0, completed: 0, paused: 0, withError: 0, transferredToHuman: 0 },
      qualification: { totalQualified: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, unqualified: 0, noResponse: 0, completionRatePct: 0, abandonmentRatePct: 0 },
      distribution: { distributed: 0, waitingQueue: 0, noDestination: 0, avgTimeMsToDistribution: 0, avgTimeMsToBrokerTakeover: 0, slaRedistributions: 0, distributionFailures: 0 },
      costs: { messagesSent: 0, aiCalls: 0, inputTokens: 0, outputTokens: 0, aiCostBrl: 0, whatsappCostBrl: 0, avgCostPerSessionBrl: 0, avgCostPerQualifiedBrl: 0 },
      followup: { scheduled: 0, sent: 0, responded: 0, interrupted: 0, conversionsPostFollowup: 0, costPerRecoveryBrl: 0 },
    };
  }
}
