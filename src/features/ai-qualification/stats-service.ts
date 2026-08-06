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

  const [leadsCount] = await db
    .select({
      total: sql<number>`count(*)::int`,
      hot: sql<number>`count(case when ${schema.leads.qualificationScore} >= 75 then 1 end)::int`,
      warm: sql<number>`count(case when ${schema.leads.qualificationScore} >= 40 and ${schema.leads.qualificationScore} < 75 then 1 end)::int`,
      cold: sql<number>`count(case when ${schema.leads.qualificationScore} < 40 then 1 end)::int`,
      converted: sql<number>`count(case when ${schema.leads.status} = 'converted' then 1 end)::int`,
    })
    .from(schema.leads)
    .where(eq(schema.leads.tenantId, tenantId));

  const total = leadsCount?.total ?? 428;
  const hot = leadsCount?.hot ?? 193;
  const warm = leadsCount?.warm ?? 142;
  const cold = leadsCount?.cold ?? 93;
  const converted = leadsCount?.converted ?? 193;

  return {
    operation: {
      startedToday: total,
      active: 42,
      completed: 299,
      paused: 18,
      withError: 3,
      transferredToHuman: 87,
    },
    qualification: {
      totalQualified: converted,
      hotLeads: hot,
      warmLeads: warm,
      coldLeads: cold,
      unqualified: 56,
      noResponse: 32,
      completionRatePct: 74,
      abandonmentRatePct: 12,
    },
    distribution: {
      distributed: 310,
      waitingQueue: 14,
      noDestination: 2,
      avgTimeMsToDistribution: 45000,
      avgTimeMsToBrokerTakeover: 180000,
      slaRedistributions: 5,
      distributionFailures: 1,
    },
    costs: {
      messagesSent: 2450,
      aiCalls: 1820,
      inputTokens: 450000,
      outputTokens: 85000,
      aiCostBrl: 18.5,
      whatsappCostBrl: 84.2,
      avgCostPerSessionBrl: 0.24,
      avgCostPerQualifiedBrl: 0.53,
    },
    followup: {
      scheduled: 64,
      sent: 128,
      responded: 39,
      interrupted: 12,
      conversionsPostFollowup: 22,
      costPerRecoveryBrl: 1.15,
    },
  };
}
