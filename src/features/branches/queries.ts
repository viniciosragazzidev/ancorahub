import "server-only";

import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

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

// ─── Period helpers ───────────────────────────────────────────────────────────

function currentMonthBounds(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, label };
}

// ─── Authorization helper ─────────────────────────────────────────────────────

async function assertBranchProfileAccess(branchId: string) {
  const context = await getRequiredTenantContext();

  // Director: any branch in the same tenant.
  // Manager & Broker: only their own branch.
  if (context.role !== "director") {
    if (!context.branchId || context.branchId !== branchId) {
      throw new AuthorizationError(
        "Você não tem permissão para acessar o perfil desta unidade.",
      );
    }
  }

  return context;
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function getBranchProfileData(
  branchId: string,
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

  const { start, end, label } = currentMonthBounds();

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

  const metrics: BranchMetrics = {
    period: label,
    totalLeads: total,
    leadsConvertidos: converted,
    leadsPerdidos: lost,
    leadsAtivos: Number(metricsRaw?.leadsAtivos ?? 0),
    leadsDistribuidos: Number(metricsRaw?.leadsDistribuidos ?? 0),
    taxaConversao: total > 0 ? Math.round((converted / total) * 100) : 0,
    taxaPerda: total > 0 ? Math.round((lost / total) * 100) : 0,
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
