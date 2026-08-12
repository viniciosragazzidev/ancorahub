import "server-only";

import { and, count, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { MetaCampaignItem } from "./types";

export async function getTenantMetaCampaignsPerformance(tenantId: string): Promise<{
  campaigns: MetaCampaignItem[];
  totals: {
    leads: number;
    conversations: number;
    sales: number;
    revenue: number;
    conversionRate: number;
  };
}> {
  const db = getDatabase();

  // 1. Buscar campanhas do tenant
  const campaignsList = await db
    .select()
    .from(schema.metaCampaigns)
    .where(eq(schema.metaCampaigns.tenantId, tenantId));

  // 2. Buscar estatísticas agregadas por campanha via relacionamentos do lead
  const leadsPerCampaign = await db
    .select({
      metaCampaignId: schema.leads.metaCampaignId,
      sourceCampaign: schema.leads.sourceCampaign,
      status: schema.leads.status,
      totalCount: count(),
    })
    .from(schema.leads)
    .where(eq(schema.leads.tenantId, tenantId))
    .groupBy(schema.leads.metaCampaignId, schema.leads.sourceCampaign, schema.leads.status);

  // 3. Buscar propostas / vendas fechadas
  const salesPerCampaign = await db
    .select({
      metaCampaignId: schema.leads.metaCampaignId,
      sourceCampaign: schema.leads.sourceCampaign,
      totalSales: count(schema.quotes.id),
      revenue: sql<number>`COALESCE(SUM(CAST(${schema.quotes.totalMonthly} AS NUMERIC)), 0)`,
    })
    .from(schema.quotes)
    .innerJoin(schema.leads, eq(schema.quotes.leadId, schema.leads.id))
    .where(and(eq(schema.quotes.tenantId, tenantId), eq(schema.quotes.status, "accepted")))
    .groupBy(schema.leads.metaCampaignId, schema.leads.sourceCampaign);

  // Mapear agregações
  const leadsMap = new Map<string, { total: number; active: number; converted: number }>();
  for (const item of leadsPerCampaign) {
    const key = item.metaCampaignId || item.sourceCampaign || "unknown";
    const current = leadsMap.get(key) || { total: 0, active: 0, converted: 0 };
    current.total += Number(item.totalCount);
    if (item.status === "converted") {
      current.converted += Number(item.totalCount);
    } else if (item.status !== "lost") {
      current.active += Number(item.totalCount);
    }
    leadsMap.set(key, current);
  }

  const salesMap = new Map<string, { count: number; revenue: number }>();
  for (const item of salesPerCampaign) {
    const key = item.metaCampaignId || item.sourceCampaign || "unknown";
    salesMap.set(key, { count: Number(item.totalSales), revenue: Number(item.revenue) });
  }

  let totalLeadsOverall = 0;
  let totalConversationsOverall = 0;
  let totalSalesOverall = 0;
  let totalRevenueOverall = 0;

  const resultCampaigns: MetaCampaignItem[] = campaignsList.map((c) => {
    const leadStats = leadsMap.get(c.campaignId) || leadsMap.get(c.name) || { total: 0, active: 0, converted: 0 };
    const saleStats = salesMap.get(c.campaignId) || salesMap.get(c.name) || { count: 0, revenue: 0 };

    const leadsCount = leadStats.total;
    // Do not infer conversations from an arbitrary percentage. Until the
    // communication attribution is persisted, expose the verified CRM state.
    const conversationsCount = leadStats.active;
    const salesCount = Math.max(leadStats.converted, saleStats.count);
    const revenueTotal = saleStats.revenue;
    const conversionRate = leadsCount > 0 ? Number(((salesCount / leadsCount) * 100).toFixed(1)) : 0;

    totalLeadsOverall += leadsCount;
    totalConversationsOverall += conversationsCount;
    totalSalesOverall += salesCount;
    totalRevenueOverall += revenueTotal;

    return {
      id: c.id,
      campaignId: c.campaignId,
      name: c.name,
      objective: c.objective,
      status: c.status,
      dailyBudget: c.dailyBudget,
      lifetimeBudget: c.lifetimeBudget,
      startTime: c.startTime,
      stopTime: c.stopTime,
      leadsCount,
      conversationsCount,
      salesCount,
      revenueTotal,
      conversionRate,
    };
  });

  const overallConversionRate = totalLeadsOverall > 0 ? Number(((totalSalesOverall / totalLeadsOverall) * 100).toFixed(1)) : 0;

  return {
    campaigns: resultCampaigns,
    totals: {
      leads: totalLeadsOverall,
      conversations: totalConversationsOverall,
      sales: totalSalesOverall,
      revenue: totalRevenueOverall,
      conversionRate: overallConversionRate,
    },
  };
}
