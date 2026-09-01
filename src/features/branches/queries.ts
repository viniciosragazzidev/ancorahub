import "server-only";

import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { brazilDayKey } from "@/shared/trends";
import { DEFAULT_PERIOD, periodStart, type PeriodValue } from "@/shared/period";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BranchMember = {
  userId: string;
  name: string;
  email: string;
  role: "director" | "manager" | "broker";
  jobTitle: string;
  availabilityStatus: "available" | "paused";
  membershipStatus: "active" | "inactive";
  activeLeads: number;
};

export type BranchTopBroker = {
  userId: string;
  name: string;
  totalLeads: number;
  converted: number;
  conversionRate: number;
};

export type BranchMetrics = {
  period: string;
  totalLeads: number;
  leadsConvertidos: number;
  leadsPerdidos: number;
  leadsAtivos: number;
  leadsDistribuidos: number;
  taxaConversao: number;
  taxaPerda: number;
  /** Leads criados por dia (últimos 7 dias, mais antigo → hoje). */
  leadsTrend: number[];
};

export type BranchProfileData = {
  branch: {
    id: string;
    name: string;
    status: "active" | "inactive";
    acceptingLeads: boolean;
    autoDistribute: boolean;
    createdAt: Date;
  };
  metrics: BranchMetrics;
  members: BranchMember[] | null; // null = caller has no permission to see members
  topBrokers: BranchTopBroker[] | null; // null = caller has no permission
};

import { resolveAccessContext } from "@/shared/auth/access-context";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";

// ─── Authorization helper ─────────────────────────────────────────────────────

async function assertBranchProfileAccess(branchId: string) {
  const accessContext = await resolveAccessContext();

  const legacyAllowed =
    accessContext.role === "director" ||
    (Boolean(accessContext.branchId) && accessContext.branchId === branchId);

  await evaluateShadowAuthorization({
    operationKey: "branches.getBranchProfileData",
    legacyAllowed,
    context: accessContext,
    capability: "ver_perfil_unidade",
    resource: {
      tenantId: accessContext.tenantId,
      unitId: branchId,
    },
  });

  AuthorizationService.require(accessContext, "ver_perfil_unidade", {
    tenantId: accessContext.tenantId,
    unitId: branchId,
  });

  return accessContext;
}


// ─── Main query ───────────────────────────────────────────────────────────────

export async function getBranchProfileData(
  branchId: string,
  period: PeriodValue = DEFAULT_PERIOD,
): Promise<BranchProfileData> {
  const context = await assertBranchProfileAccess(branchId);
  const db = getDatabase();

  // 1. Fetch the branch itself (must belong to the tenant).
  const [branch] = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      status: schema.branches.status,
      acceptingLeads: schema.branches.acceptingLeads,
      autoDistribute: schema.branches.autoDistribute,
      createdAt: schema.branches.createdAt,
    })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.id, branchId),
        eq(schema.branches.tenantId, context.tenantId),
      ),
    )
    .limit(1);

  if (!branch) {
    throw new Error("BRANCH_NOT_FOUND");
  }

  const start = periodStart(period);
  const end = new Date(start.getTime() + period * 86_400_000);
  const label = `últimos ${period} dias`;

  // 2. Lead metrics for the period.
  const activeStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

  const [metricsRaw] = await db
    .select({
      totalLeads: count(schema.leads.id),
      leadsConvertidos: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
      leadsPerdidos: sql<number>`count(*) filter (where ${schema.leads.status} = 'lost')`,
      leadsAtivos: sql<number>`count(*) filter (where ${schema.leads.status} in (${sql.join(activeStatuses.map((s) => sql`${s}`), sql`, `)}))`,
      leadsDistribuidos: sql<number>`count(*) filter (where ${schema.leads.status} = 'distributed')`,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.branchId, branchId),
        gte(schema.leads.createdAt, start),
        lt(schema.leads.createdAt, end),
      ),
    );

  const total = Number(metricsRaw?.totalLeads ?? 0);
  const converted = Number(metricsRaw?.leadsConvertidos ?? 0);
  const lost = Number(metricsRaw?.leadsPerdidos ?? 0);

  // 2b. Tendência diária de leads (últimos N dias) para os cards
  const trendStart = periodStart(period);
  const dailyRows = await db
    .select({
      day: sql<string>`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date::text`,
      total: count(),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.branchId, branchId),
        gte(schema.leads.createdAt, trendStart),
      ),
    )
    .groupBy(sql`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`)
    .orderBy(sql`date_trunc('day', ${schema.leads.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date`);

  const leadsTrend: number[] = [];
  for (let i = period - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    const isoDate = brazilDayKey(d);
    const row = dailyRows.find((r) => r.day === isoDate);
    leadsTrend.push(Number(row?.total ?? 0));
  }

  const metrics: BranchMetrics = {
    period: label,
    totalLeads: total,
    leadsConvertidos: converted,
    leadsPerdidos: lost,
    leadsAtivos: Number(metricsRaw?.leadsAtivos ?? 0),
    leadsDistribuidos: Number(metricsRaw?.leadsDistribuidos ?? 0),
    taxaConversao: total > 0 ? Math.round((converted / total) * 100) : 0,
    taxaPerda: total > 0 ? Math.round((lost / total) * 100) : 0,
    leadsTrend,
  };

  // 3. Members and top brokers — visible only to director and manager.
  const canSeeTeam = context.role === "director" || context.role === "manager";

  let members: BranchMember[] | null = null;
  let topBrokers: BranchTopBroker[] | null = null;

  if (canSeeTeam) {
    // 3a. Fetch all members of the branch.
    const rawMembers = await db
      .select({
        userId: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.tenantMemberships.role,
        jobTitle: schema.tenantMemberships.jobTitle,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        membershipStatus: schema.tenantMemberships.status,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.branchId, branchId),
          eq(schema.tenantMemberships.status, "active"),
        ),
      )
      .orderBy(schema.user.name);

    // 3b. Count active leads per broker in this branch.
    const brokerIds = rawMembers.map((m) => m.userId);
    let activeLeadsPerBroker: { corretorId: string | null; cnt: number }[] = [];

    if (brokerIds.length > 0) {
      activeLeadsPerBroker = await db
        .select({
          corretorId: schema.leads.corretorId,
          cnt: count(schema.leads.id),
        })
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.tenantId, context.tenantId),
            eq(schema.leads.branchId, branchId),
            inArray(schema.leads.status, [...activeStatuses]),
            inArray(schema.leads.corretorId, brokerIds),
          ),
        )
        .groupBy(schema.leads.corretorId);
    }

    const activeLeadsMap = new Map(
      activeLeadsPerBroker.map((r) => [r.corretorId, Number(r.cnt)]),
    );

    members = rawMembers.map((m) => ({
      ...m,
      activeLeads: activeLeadsMap.get(m.userId) ?? 0,
    })) as BranchMember[];

    // 3c. Top brokers by conversion in current period.
    if (brokerIds.length > 0) {
      const topRaw = await db
        .select({
          userId: schema.user.id,
          name: schema.user.name,
          totalLeads: count(schema.leads.id),
          converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
        })
        .from(schema.leads)
        .innerJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
        .where(
          and(
            eq(schema.leads.tenantId, context.tenantId),
            eq(schema.leads.branchId, branchId),
            gte(schema.leads.createdAt, start),
            lt(schema.leads.createdAt, end),
            inArray(schema.leads.corretorId, brokerIds),
          ),
        )
        .groupBy(schema.user.id, schema.user.name)
        .orderBy(sql`count(*) filter (where ${schema.leads.status} = 'converted') desc`)
        .limit(5);

      topBrokers = topRaw.map((r) => {
        const tot = Number(r.totalLeads);
        const conv = Number(r.converted);
        return {
          userId: r.userId,
          name: r.name,
          totalLeads: tot,
          converted: conv,
          conversionRate: tot > 0 ? Math.round((conv / tot) * 100) : 0,
        };
      });
    } else {
      topBrokers = [];
    }
  }

  return { branch, metrics, members, topBrokers };
}
