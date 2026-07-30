import "server-only";

import { maskPhone } from "@/features/quotes/utils";
import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const activeLeadStatuses = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type BrokerDashboardData = {
  userName: string;
  branchName: string;
  availabilityStatus: "available" | "paused" | "offline";
  leads: Array<{ id: string; name: string; phone: string; source: string; status: string; createdAt: Date; lastInteractionAt: Date | null }>;
  activeLeads: Array<{ id: string; name: string; status: string; serviceStartedAt: Date | null }>;
  totals: { all: number; active: number; new: number; distributed: number; inContact: number; lost: number; converted: number };
  pendingStaleness: { oldestMinutes: number | null; overdueCount: number };
  trend: LeadTrend;
};

export async function getBrokerDashboardData(): Promise<BrokerDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [user, membership, leads, trendRaw] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ availabilityStatus: schema.tenantMemberships.availabilityStatus, branchName: schema.branches.name }).from(schema.tenantMemberships).leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId))).limit(1),
    db.select({ id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, source: schema.leads.origem, status: schema.leads.status, createdAt: schema.leads.createdAt, assignedAt: schema.leads.assignedAt, serviceStartedAt: schema.leads.serviceStartedAt })
      .from(schema.leads)
      .innerJoin(schema.tenants, eq(schema.leads.tenantId, schema.tenants.id))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.corretorId, context.userId),
        or(
          ne(schema.leads.status, "distributed"),
          isNotNull(schema.leads.firstContactAt),
          isNull(schema.leads.assignedAt),
          gte(schema.leads.assignedAt, sql`now() - (COALESCE(NULLIF(${schema.tenants.slaFirstContactMinutes}, ''), '15')::integer * interval '1 minute')`),
        ),
      ))
      .orderBy(desc(schema.leads.createdAt)),
    // Lead trend: last 30 days grouped by date
    db
      .select({
        date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          gte(schema.leads.createdAt, sql`now() - interval '29 days'`),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  const interactions = leads.length ? await db.select({ leadId: schema.leadInteractions.leadId, createdAt: schema.leadInteractions.createdAt }).from(schema.leadInteractions).where(inArray(schema.leadInteractions.leadId, leads.map((lead) => lead.id))).orderBy(desc(schema.leadInteractions.createdAt)) : [];
  const latest = new Map<string, Date>();
  for (const interaction of interactions) if (!latest.has(interaction.leadId)) latest.set(interaction.leadId, interaction.createdAt);

  const nowMs = Date.now();
  const distributedLeads = leads.filter((lead) => lead.status === "distributed");
  const pendingStaleness = {
    oldestMinutes: distributedLeads.length > 0 && distributedLeads.some((l) => l.assignedAt)
      ? Math.round(distributedLeads.reduce((max, lead) => {
          const diff = lead.assignedAt ? nowMs - lead.assignedAt.getTime() : 0;
          return diff > max ? diff : max;
        }, 0) / 60_000)
      : null,
    overdueCount: distributedLeads.filter((lead) => lead.assignedAt && nowMs - lead.assignedAt.getTime() > 15 * 60 * 1000).length,
  };

  // Fill missing days with zeros
  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend: LeadTrend = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const existing = trendMap.get(key);
    trend.push({
      date: key,
      leads: existing?.leads ?? 0,
      converted: existing?.converted ?? 0,
    });
  }

  return {
    userName: user[0]?.name ?? "Corretor",
    branchName: membership[0]?.branchName ?? "Unidade não identificada",
    availabilityStatus: membership[0]?.availabilityStatus ?? "available",
    leads: leads.map((lead) => ({ ...lead, phone: maskPhone(lead.phone), lastInteractionAt: latest.get(lead.id) ?? null })),
    activeLeads: leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status) && lead.status !== "new" && lead.status !== "distributed").map((lead) => ({ id: lead.id, name: lead.name, status: lead.status, serviceStartedAt: lead.serviceStartedAt })),
    totals: {
      all: leads.length,
      active: leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status)).length,
      new: leads.filter((lead) => lead.status === "new").length,
      distributed: distributedLeads.length,
      inContact: leads.filter((lead) => lead.status === "in_contact").length,
      lost: leads.filter((lead) => lead.status === "lost").length,
      converted: leads.filter((lead) => lead.status === "converted").length,
    },
    pendingStaleness,
    trend,
  };
}

export type ManagerDashboardData = {
  branchName: string;
  teamSize: number;
  activeMembers: number;
  leadsTotal: number;
  newLeads: number;
  inContact: number;
  unassigned: number;
  unworked: number;
  stalled: number;
  branchId: string;
  autoDistribute: boolean;
};

export async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [branch, members, leads] = await Promise.all([
    db.select({ autoDistribute: schema.branches.autoDistribute, branchName: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.id, context.branchId!), eq(schema.branches.tenantId, context.tenantId))).limit(1),
    db.select({ userId: schema.tenantMemberships.userId, status: schema.tenantMemberships.status }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.branchId, context.branchId!), eq(schema.tenantMemberships.role, "broker"))),
    db.select({ status: schema.leads.status, corretorId: schema.leads.corretorId, assignedAt: schema.leads.assignedAt, stageEnteredAt: schema.leads.stageEnteredAt }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.branchId, context.branchId!))),
  ]);
  const now = Date.now();
  const unworked = leads.filter((lead) => lead.status === "distributed" && lead.assignedAt && now - lead.assignedAt.getTime() > 15 * 60 * 1000).length;
  const stalled = leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status) && now - lead.stageEnteredAt.getTime() > 3 * 24 * 60 * 60 * 1000).length;
  return { branchName: branch[0]?.branchName ?? "Unidade não identificada", teamSize: members.length, activeMembers: members.filter((member) => member.status === "active").length, leadsTotal: leads.length, newLeads: leads.filter((lead) => lead.status === "new").length, inContact: leads.filter((lead) => lead.status === "in_contact").length, unassigned: leads.filter((lead) => !lead.corretorId).length, unworked, stalled, branchId: context.branchId!, autoDistribute: branch[0]?.autoDistribute ?? true };
}

export type LeadTrend = Array<{ date: string; leads: number; converted: number }>;

export type DirectorDashboardData = {
  user: { name: string; email: string; image: string | null };
  tenant: { name: string; slug: string; legalName: string | null; cnpj: string | null; subscriptionPlan: string };
  totals: { leads: number; activeLeads: number; converted: number; branches: number; members: number; activeBrokers: number; unworked: number; stalled: number };
  funnel: Array<{ stage: string; volume: number }>;
  branches: Array<{ name: string; leads: number; activeLeads: number; conversion: string }>;
  trend: LeadTrend;
};

export async function getDirectorDashboardData(): Promise<DirectorDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [user, tenant, leads, branches, members, trendRaw] = await Promise.all([
    db.select({ name: schema.user.name, email: schema.user.email, image: schema.user.image }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ name: schema.tenants.name, slug: schema.tenants.slug, legalName: schema.tenants.legalName, cnpj: schema.tenants.cnpj, subscriptionPlan: schema.tenants.subscriptionPlan }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    db.select({ status: schema.leads.status, branchId: schema.leads.branchId, assignedAt: schema.leads.assignedAt, stageEnteredAt: schema.leads.stageEnteredAt }).from(schema.leads).where(eq(schema.leads.tenantId, context.tenantId)),
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.tenantId, context.tenantId)),
    db.select({ role: schema.tenantMemberships.role, status: schema.tenantMemberships.status }).from(schema.tenantMemberships).where(eq(schema.tenantMemberships.tenantId, context.tenantId)),
    // Lead trend: last 30 days grouped by date
    db
      .select({
        date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          gte(schema.leads.createdAt, sql`now() - interval '29 days'`),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  if (!user[0] || !tenant[0]) throw new Error("User or tenant not found");
  const active = leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status));
  const now = Date.now();
  const unworked = leads.filter((lead) => lead.status === "distributed" && lead.assignedAt && now - lead.assignedAt.getTime() > 15 * 60 * 1000).length;
  const stalled = leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status) && now - lead.stageEnteredAt.getTime() > 3 * 24 * 60 * 60 * 1000).length;
  const stage = (status: string) => status === "new" || status === "distributed" ? "Novo" : status === "in_contact" ? "Contato" : status === "quote_sent" ? "Cotação" : status === "negotiation" ? "Negociação" : status === "converted" ? "Conversão" : "Em análise";
  const stageNames = ["Novo", "Contato", "Cotação", "Negociação", "Conversão"];
  const funnel = stageNames.map((name) => ({ stage: name, volume: leads.filter((lead) => stage(lead.status) === name).length }));

  // Fill missing days with zeros
  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend: LeadTrend = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const existing = trendMap.get(key);
    trend.push({
      date: key,
      leads: existing?.leads ?? 0,
      converted: existing?.converted ?? 0,
    });
  }

  return { user: user[0], tenant: tenant[0], totals: { leads: leads.length, activeLeads: active.length, converted: leads.filter((lead) => lead.status === "converted").length, branches: branches.length, members: members.length, activeBrokers: members.filter((member) => member.role === "broker" && member.status === "active").length, unworked, stalled }, funnel, trend, branches: branches.map((branch) => { const branchLeads = leads.filter((lead) => lead.branchId === branch.id); const converted = branchLeads.filter((lead) => lead.status === "converted").length; return { name: branch.name, leads: branchLeads.length, activeLeads: branchLeads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status)).length, conversion: branchLeads.length ? `${((converted / branchLeads.length) * 100).toFixed(1)}%` : "0,0%" }; }) };
}
