import "server-only";

import { and, count, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { type TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NocKpis = {
  leadsToday: number;
  leadsTodayVsYesterday: number; // percentage delta
  activeAttendances: number;
  conversionRateMonth: number; // 0-100
  conversionRateLastMonth: number;
  avgFirstContactSeconds: number | null;
  avgFirstContactSecondsYesterday: number | null;
  avgTicketMonth: number;
  avgTicketLastMonth: number;
};

export type LeadFlowDay = {
  dia: string; // "Seg", "Ter" etc
  date: string; // ISO
  leads: number;
  contatos: number;
  conversoes: number;
};

export type StatusBucket = {
  name: string;
  value: number;
  color: string;
};

export type HourlyBucket = {
  hora: string;
  leads: number;
  contatos: number;
};

export type TeamMemberPerf = {
  userId: string;
  nome: string;
  leads: number;
  conversoes: number;
  taxa: number;
};

export type ActivityItem = {
  id: string;
  type: "conversion" | "new_lead" | "quote" | "status_change" | "alert";
  message: string;
  time: Date;
  user: string;
  branchName: string | null;
};

export type BranchHealth = {
  id: string;
  name: string;
  acceptingLeads: boolean;
  leadsToday: number;
  activeAttendances: number;
  unassignedLeads: number;
  slaRiskLeads: number;
  availableBrokers: number;
  totalBrokers: number;
  health: "healthy" | "attention" | "critical";
  healthReason: string;
};

export type NocData = {
  kpis: NocKpis;
  leadFlow: LeadFlowDay[];
  statusDistribution: StatusBucket[];
  hourlyActivity: HourlyBucket[];
  teamPerformance: TeamMemberPerf[];
  recentActivity: ActivityItem[];
  branchHealth: BranchHealth[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_CONFIG: Record<string, { name: string; color: string }> = {
  new: { name: "Novos", color: "var(--chart-1)" },
  distributed: { name: "Distribuídos", color: "var(--chart-2)" },
  in_contact: { name: "Em Contato", color: "var(--chart-3)" },
  quote_sent: { name: "Cotação", color: "var(--chart-4)" },
  negotiation: { name: "Negociação", color: "var(--chart-5)" },
  documentation_pending: { name: "Documentação", color: "hsl(280 60% 60%)" },
  under_analysis: { name: "Em Análise", color: "hsl(30 80% 55%)" },
  converted: { name: "Convertidos", color: "hsl(145 60% 45%)" },
  lost: { name: "Perdidos", color: "hsl(0 60% 55%)" },
};

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function yesterdayBounds() {
  const { start } = todayBounds();
  return {
    start: new Date(start.getTime() - 86_400_000),
    end: start,
  };
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function lastMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end };
}

function tenantScope(context: TenantContext) {
  return context.role === "manager" && context.branchId
    ? { tenantId: context.tenantId, branchId: context.branchId }
    : { tenantId: context.tenantId, branchId: null };
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

async function getNocKpis(context: TenantContext): Promise<NocKpis> {
  const db = getDatabase();
  const scope = tenantScope(context);
  const today = todayBounds();
  const yesterday = yesterdayBounds();
  const month = monthBounds();
  const lastMonth = lastMonthBounds();

  function baseLeadWhere(start: Date, end: Date) {
    const base = and(
      eq(schema.leads.tenantId, scope.tenantId),
      gte(schema.leads.createdAt, start),
      lt(schema.leads.createdAt, end),
    );
    return scope.branchId
      ? and(base, eq(schema.leads.branchId, scope.branchId))
      : base;
  }

  const activeStatuses = [
    "in_contact", "quote_sent", "negotiation",
    "documentation_pending", "under_analysis",
  ] as const;

  const [
    todayLeads,
    yesterdayLeads,
    activeNow,
    monthMetrics,
    lastMonthMetrics,
    contactTimeToday,
    contactTimeYesterday,
    ticketMonth,
    ticketLastMonth,
  ] = await Promise.all([
    // Leads today
    db
      .select({ cnt: count() })
      .from(schema.leads)
      .where(baseLeadWhere(today.start, today.end)),

    // Leads yesterday
    db
      .select({ cnt: count() })
      .from(schema.leads)
      .where(baseLeadWhere(yesterday.start, yesterday.end)),

    // Active attendances right now (status in active set)
    db
      .select({ cnt: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, scope.tenantId),
          inArray(schema.leads.status, activeStatuses),
          ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
        ),
      ),

    // Month conversion metrics
    db
      .select({
        total: count(),
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
      })
      .from(schema.leads)
      .where(baseLeadWhere(month.start, month.end)),

    // Last month conversion
    db
      .select({
        total: count(),
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
      })
      .from(schema.leads)
      .where(baseLeadWhere(lastMonth.start, lastMonth.end)),

    // Avg first contact time today (seconds)
    db
      .select({
        avg: sql<number>`extract(epoch from avg(${schema.leads.firstContactAt} - ${schema.leads.createdAt}))`,
      })
      .from(schema.leads)
      .where(
        and(
          baseLeadWhere(today.start, today.end),
          isNotNull(schema.leads.firstContactAt),
        ),
      ),

    // Avg first contact time yesterday
    db
      .select({
        avg: sql<number>`extract(epoch from avg(${schema.leads.firstContactAt} - ${schema.leads.createdAt}))`,
      })
      .from(schema.leads)
      .where(
        and(
          baseLeadWhere(yesterday.start, yesterday.end),
          isNotNull(schema.leads.firstContactAt),
        ),
      ),

    // Avg ticket this month
    db
      .select({ avg: sql<number>`coalesce(avg(${schema.sales.saleValue}::numeric), 0)` })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.sales.tenantId, scope.tenantId),
          gte(schema.sales.saleDate, month.start),
          lt(schema.sales.saleDate, month.end),
          eq(schema.sales.status, "active"),
          ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
        ),
      ),

    // Avg ticket last month
    db
      .select({ avg: sql<number>`coalesce(avg(${schema.sales.saleValue}::numeric), 0)` })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.sales.tenantId, scope.tenantId),
          gte(schema.sales.saleDate, lastMonth.start),
          lt(schema.sales.saleDate, lastMonth.end),
          eq(schema.sales.status, "active"),
          ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
        ),
      ),
  ]);

  const leadsT = Number(todayLeads[0]?.cnt ?? 0);
  const leadsY = Number(yesterdayLeads[0]?.cnt ?? 0);
  const convM = Number(monthMetrics[0]?.converted ?? 0);
  const totalM = Number(monthMetrics[0]?.total ?? 0);
  const convLM = Number(lastMonthMetrics[0]?.converted ?? 0);
  const totalLM = Number(lastMonthMetrics[0]?.total ?? 0);

  return {
    leadsToday: leadsT,
    leadsTodayVsYesterday: leadsY === 0 ? 0 : Math.round(((leadsT - leadsY) / leadsY) * 100),
    activeAttendances: Number(activeNow[0]?.cnt ?? 0),
    conversionRateMonth: totalM > 0 ? Math.round((convM / totalM) * 100) : 0,
    conversionRateLastMonth: totalLM > 0 ? Math.round((convLM / totalLM) * 100) : 0,
    avgFirstContactSeconds: contactTimeToday[0]?.avg ? Number(contactTimeToday[0].avg) : null,
    avgFirstContactSecondsYesterday: contactTimeYesterday[0]?.avg ? Number(contactTimeYesterday[0].avg) : null,
    avgTicketMonth: Number(ticketMonth[0]?.avg ?? 0),
    avgTicketLastMonth: Number(ticketLastMonth[0]?.avg ?? 0),
  };
}

// ─── Lead Flow (7 days) ────────────────────────────────────────────────────────

async function getLeadFlow(context: TenantContext): Promise<LeadFlowDay[]> {
  const db = getDatabase();
  const scope = tenantScope(context);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const baseWhere = and(
    eq(schema.leads.tenantId, scope.tenantId),
    gte(schema.leads.createdAt, sevenDaysAgo),
    ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
  );

  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date::text`,
      total: count(),
      withContact: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} IS NOT NULL)`,
      converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
    })
    .from(schema.leads)
    .where(baseWhere)
    .groupBy(sql`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`)
    .orderBy(sql`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`);

  // Pad missing days
  const result: LeadFlowDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const isoDate = d.toISOString().split("T")[0];
    const row = rows.find((r) => r.day === isoDate);
    result.push({
      dia: DAYS_SHORT[d.getDay()],
      date: isoDate,
      leads: Number(row?.total ?? 0),
      contatos: Number(row?.withContact ?? 0),
      conversoes: Number(row?.converted ?? 0),
    });
  }
  return result;
}

// ─── Status Distribution ──────────────────────────────────────────────────────

async function getStatusDistribution(context: TenantContext): Promise<StatusBucket[]> {
  const db = getDatabase();
  const scope = tenantScope(context);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const rows = await db
    .select({
      status: schema.leads.status,
      cnt: count(),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, scope.tenantId),
        gte(schema.leads.createdAt, thirtyDaysAgo),
        ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
      ),
    )
    .groupBy(schema.leads.status);

  return rows
    .map((r) => ({
      name: STATUS_CONFIG[r.status]?.name ?? r.status,
      value: Number(r.cnt),
      color: STATUS_CONFIG[r.status]?.color ?? "var(--muted-foreground)",
    }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ─── Hourly Activity Today ────────────────────────────────────────────────────

async function getHourlyActivity(context: TenantContext): Promise<HourlyBucket[]> {
  const db = getDatabase();
  const scope = tenantScope(context);
  const today = todayBounds();

  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::int`,
      leads: count(),
      contatos: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} IS NOT NULL AND date_trunc('day', ${schema.leads.firstContactAt} AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo'))`,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, scope.tenantId),
        gte(schema.leads.createdAt, today.start),
        lt(schema.leads.createdAt, today.end),
        ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
      ),
    )
    .groupBy(sql`extract(hour from ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::int`)
    .orderBy(sql`extract(hour from ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::int`);

  // Build all hours 6h-20h
  const hoursToShow = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  return hoursToShow.map((h) => {
    const row = rows.find((r) => Number(r.hour) === h);
    return {
      hora: `${String(h).padStart(2, "0")}h`,
      leads: Number(row?.leads ?? 0),
      contatos: Number(row?.contatos ?? 0),
    };
  });
}

// ─── Team Performance Today ───────────────────────────────────────────────────

async function getTeamPerformance(context: TenantContext): Promise<TeamMemberPerf[]> {
  const db = getDatabase();
  const scope = tenantScope(context);
  const today = todayBounds();

  const rows = await db
    .select({
      userId: schema.user.id,
      nome: schema.user.name,
      leads: count(schema.leads.id),
      conversoes: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(
      schema.leads,
      and(
        eq(schema.leads.corretorId, schema.tenantMemberships.userId),
        eq(schema.leads.tenantId, scope.tenantId),
        gte(schema.leads.createdAt, today.start),
        lt(schema.leads.createdAt, today.end),
      ),
    )
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, scope.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        ...(scope.branchId
          ? [eq(schema.tenantMemberships.branchId, scope.branchId)]
          : []),
      ),
    )
    .groupBy(schema.user.id, schema.user.name)
    .orderBy(sql`count(*) filter (where ${schema.leads.status} = 'converted') desc, count(${schema.leads.id}) desc`)
    .limit(8);

  return rows.map((r) => {
    const leads = Number(r.leads);
    const conv = Number(r.conversoes);
    return {
      userId: r.userId,
      nome: r.nome.split(" ").slice(0, 2).join(" "), // first two name parts
      leads,
      conversoes: conv,
      taxa: leads > 0 ? Math.round((conv / leads) * 100) : 0,
    };
  });
}

// ─── Recent Activity Feed ─────────────────────────────────────────────────────

async function getRecentActivity(context: TenantContext): Promise<ActivityItem[]> {
  const db = getDatabase();
  const scope = tenantScope(context);

  // Lead interactions (status changes, quote generated)
  const interactions = await db
    .select({
      id: schema.leadInteractions.id,
      tipo: schema.leadInteractions.tipo,
      conteudo: schema.leadInteractions.conteudo,
      createdAt: schema.leadInteractions.createdAt,
      userName: schema.user.name,
      leadNome: schema.leads.nome,
      leadStatus: schema.leads.status,
      branchName: schema.branches.name,
    })
    .from(schema.leadInteractions)
    .innerJoin(schema.user, eq(schema.leadInteractions.userId, schema.user.id))
    .innerJoin(schema.leads, eq(schema.leadInteractions.leadId, schema.leads.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.leads.tenantId, scope.tenantId),
        sql`${schema.leadInteractions.tipo} = ANY(ARRAY['status_change','quote_generated','service_started']::lead_interaction_type[])`,
        ...(scope.branchId ? [eq(schema.leads.branchId, scope.branchId)] : []),
      ),
    )
    .orderBy(sql`${schema.leadInteractions.createdAt} desc`)
    .limit(15);

  const items: ActivityItem[] = interactions.map((r) => {
    let type: ActivityItem["type"] = "status_change";
    let message = r.conteudo;

    if (r.tipo === "quote_generated") {
      type = "quote";
      message = `Cotação gerada para ${r.leadNome}`;
    } else if (r.tipo === "service_started") {
      type = "status_change";
      message = `Atendimento iniciado para ${r.leadNome}`;
    } else if (r.tipo === "status_change") {
      if (r.leadStatus === "converted") {
        type = "conversion";
        message = `${r.leadNome} foi convertido`;
      } else if (r.leadStatus === "new" || r.leadStatus === "distributed") {
        type = "new_lead";
        message = `Lead ${r.leadNome} recebido`;
      } else {
        type = "status_change";
        message = r.conteudo || `Status de ${r.leadNome} atualizado`;
      }
    }

    return {
      id: r.id,
      type,
      message,
      time: new Date(r.createdAt),
      user: r.userName.split(" ")[0],
      branchName: r.branchName,
    };
  });

  // Sort by time desc, take top 12
  return items
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 12);
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

function safeSlaMinutes(value: string | null | undefined) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1_440 ? minutes : 15;
}

async function getBranchHealth(context: TenantContext): Promise<BranchHealth[]> {
  const db = getDatabase();
  const scope = tenantScope(context);
  const today = todayBounds();

  const [tenant, branches] = await Promise.all([
    db.select({ slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, scope.tenantId)).limit(1),
    db.select({ id: schema.branches.id, name: schema.branches.name, acceptingLeads: schema.branches.acceptingLeads }).from(schema.branches).where(and(eq(schema.branches.tenantId, scope.tenantId), eq(schema.branches.status, "active"), ...(scope.branchId ? [eq(schema.branches.id, scope.branchId)] : []))).orderBy(schema.branches.name),
  ]);

  if (!branches.length) return [];

  const branchIds = branches.map((branch) => branch.id);
  const slaDeadline = new Date(Date.now() - safeSlaMinutes(tenant[0]?.slaFirstContactMinutes) * 60_000);
  const [leadRows, brokerRows] = await Promise.all([
    db.select({
      branchId: schema.leads.branchId,
      leadsToday: sql<number>`count(*) filter (where ${schema.leads.createdAt} >= ${today.start.toISOString()} and ${schema.leads.createdAt} < ${today.end.toISOString()})`,
      activeAttendances: sql<number>`count(*) filter (where ${schema.leads.status} in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis'))`,
      unassignedLeads: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null and ${schema.leads.distributionStatus} in ('unassigned', 'queued', 'awaiting_unit', 'returned_to_queue'))`,
      slaRiskLeads: sql<number>`count(*) filter (where ${schema.leads.status} = 'distributed' and ${schema.leads.corretorId} is not null and ${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} is not null and ${schema.leads.assignedAt} < ${slaDeadline.toISOString()})`,
    }).from(schema.leads).where(and(eq(schema.leads.tenantId, scope.tenantId), inArray(schema.leads.branchId, branchIds))).groupBy(schema.leads.branchId),
    db.select({
      branchId: schema.tenantMemberships.branchId,
      totalBrokers: count(),
      availableBrokers: sql<number>`count(*) filter (where ${schema.tenantMemberships.availabilityStatus} = 'available')`,
    }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, scope.tenantId), inArray(schema.tenantMemberships.branchId, branchIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).groupBy(schema.tenantMemberships.branchId),
  ]);

  const leadsByBranch = new Map(leadRows.map((row) => [row.branchId, row]));
  const brokersByBranch = new Map(brokerRows.map((row) => [row.branchId, row]));

  return branches.map((branch) => {
    const leadMetrics = leadsByBranch.get(branch.id);
    const brokerMetrics = brokersByBranch.get(branch.id);
    const leadsToday = Number(leadMetrics?.leadsToday ?? 0);
    const activeAttendances = Number(leadMetrics?.activeAttendances ?? 0);
    const unassignedLeads = Number(leadMetrics?.unassignedLeads ?? 0);
    const slaRiskLeads = Number(leadMetrics?.slaRiskLeads ?? 0);
    const availableBrokers = Number(brokerMetrics?.availableBrokers ?? 0);
    const totalBrokers = Number(brokerMetrics?.totalBrokers ?? 0);
    const status = !branch.acceptingLeads
      ? { health: "attention" as const, healthReason: "Recebimento de leads pausado" }
      : slaRiskLeads > 0
        ? { health: "critical" as const, healthReason: `${slaRiskLeads} lead(s) fora do SLA de 1º contato` }
        : unassignedLeads > 0
          ? { health: "attention" as const, healthReason: `${unassignedLeads} lead(s) aguardando corretor` }
          : totalBrokers === 0
            ? { health: "attention" as const, healthReason: "Nenhum corretor ativo na unidade" }
            : availableBrokers === 0
              ? { health: "attention" as const, healthReason: "Nenhum corretor disponível agora" }
              : { health: "healthy" as const, healthReason: "Operação dentro dos indicadores acompanhados" };

    return { id: branch.id, name: branch.name, acceptingLeads: branch.acceptingLeads, leadsToday, activeAttendances, unassignedLeads, slaRiskLeads, availableBrokers, totalBrokers, ...status };
  });
}

export async function getNocData(context: TenantContext): Promise<NocData> {
  const [kpis, leadFlow, statusDistribution, hourlyActivity, teamPerformance, recentActivity, branchHealth] =
    await Promise.all([
      getNocKpis(context),
      getLeadFlow(context),
      getStatusDistribution(context),
      getHourlyActivity(context),
      getTeamPerformance(context),
      getRecentActivity(context),
      getBranchHealth(context),
    ]);

  return { kpis, leadFlow, statusDistribution, hourlyActivity, teamPerformance, recentActivity, branchHealth };
}
