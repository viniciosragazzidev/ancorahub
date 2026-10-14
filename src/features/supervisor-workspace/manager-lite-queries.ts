import "server-only";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import type { RadarFunnel, RadarLead, RadarTeamMember } from "./supervisor-leads-radar";
import { getLeadTimeline } from "@/features/leads/queries";

const ACTIVE_STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type ManagerLiteLeadData = { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number; viewerName: string };

const emptyData = (viewerName = "Gestor"): ManagerLiteLeadData => ({
  team: [], leads: [], funnel: { new: 0, firstContact: 0, service: 0, quote: 0, closing: 0 }, slaMinutes: 15, viewerName,
});

export async function getManagerLiteLeads(context: TenantContext, now = new Date()): Promise<ManagerLiteLeadData> {
  if (context.role !== "manager") throw new Error("Esta área está disponível apenas para gestores.");
  const scope = getManagerUnitScope(context);
  if (!scope) return emptyData();

  const db = getDatabase();
  const [[viewer], [tenant], members, rows, counts] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, scope.tenantId)).limit(1),
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, image: schema.user.image, availability: schema.tenantMemberships.availabilityStatus })
      .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, scope.tenantId), eq(schema.tenantMemberships.branchId, scope.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))),
    db.select({ id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, status: schema.leads.status, ownerId: schema.leads.corretorId, ownerName: schema.user.name, ownerImage: schema.user.image, productName: schema.carrierPlans.name, assignedAt: schema.leads.assignedAt, firstContactAt: schema.leads.firstContactAt, stageEnteredAt: schema.leads.stageEnteredAt })
      .from(schema.leads).leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId)).leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.leads.planId))
      .where(and(eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), inArray(schema.leads.status, [...ACTIVE_STATUSES]), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
      .orderBy(desc(schema.leads.assignedAt), desc(schema.leads.createdAt)).limit(500),
    db.select({ status: schema.leads.status, total: count() }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), inArray(schema.leads.status, [...ACTIVE_STATUSES]), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).groupBy(schema.leads.status),
  ]);

  const slaMinutes = Math.max(1, Number.parseInt(tenant?.sla ?? "15", 10) || 15);
  const ownerCounts = new Map<string, { openCount: number; late: number }>();
  for (const lead of rows) {
    if (!lead.ownerId) continue;
    const current = ownerCounts.get(lead.ownerId) ?? { openCount: 0, late: 0 };
    current.openCount += 1;
    if (!lead.firstContactAt && lead.assignedAt && now.getTime() - lead.assignedAt.getTime() > slaMinutes * 60_000) current.late += 1;
    ownerCounts.set(lead.ownerId, current);
  }
  const team: RadarTeamMember[] = members.map((member) => ({
    id: member.id, name: member.name ?? "Corretor", image: member.image ?? null, availability: member.availability ?? "offline",
    openCount: ownerCounts.get(member.id)?.openCount ?? 0, late: ownerCounts.get(member.id)?.late ?? 0,
  }));
  const funnelCounts = new Map(counts.map((row) => [row.status, Number(row.total)]));
  const leads: RadarLead[] = rows.map((lead) => ({
    id: lead.id, name: lead.name ?? "Lead", phone: lead.phone ?? null, status: lead.status, ownerId: lead.ownerId ?? "", ownerName: lead.ownerName ?? "Sem corretor", ownerImage: lead.ownerImage ?? null,
    productName: lead.productName ?? null, assignedAt: lead.assignedAt?.toISOString() ?? null, firstContactAt: lead.firstContactAt?.toISOString() ?? null, stageEnteredAt: lead.stageEnteredAt?.toISOString() ?? null,
  }));

  return {
    team,
    leads,
    funnel: {
      new: Number(funnelCounts.get("new") ?? 0) + Number(funnelCounts.get("distributed") ?? 0),
      firstContact: leads.filter((lead) => (lead.status === "new" || lead.status === "distributed") && !lead.firstContactAt).length,
      service: Number(funnelCounts.get("in_contact") ?? 0), quote: Number(funnelCounts.get("quote_sent") ?? 0),
      closing: Number(funnelCounts.get("negotiation") ?? 0) + Number(funnelCounts.get("documentation_pending") ?? 0) + Number(funnelCounts.get("under_analysis") ?? 0),
    },
    slaMinutes,
    viewerName: viewer?.name ?? "Gestor",
  };
}

export async function getManagerLiteLeadDetail(context: TenantContext, leadId: string) {
  const scope = getManagerUnitScope(context);
  if (context.role !== "manager" || !scope) return null;
  const db = getDatabase();
  const [[lead], brokers] = await Promise.all([
    db.select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, ownerId: schema.leads.corretorId, ownerName: schema.user.name, ownerImage: schema.user.image, productName: schema.carrierPlans.name, assignedAt: schema.leads.assignedAt, branchName: schema.branches.name })
      .from(schema.leads).leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId)).leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.leads.planId)).leftJoin(schema.branches, and(eq(schema.branches.id, schema.leads.branchId), eq(schema.branches.tenantId, schema.leads.tenantId)))
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).limit(1),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, scope.tenantId), eq(schema.tenantMemberships.branchId, scope.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).orderBy(schema.user.name),
  ]);
  if (!lead) return null;
  const timeline = await getLeadTimeline(leadId);
  return {
    lead: { id: lead.id, name: lead.name ?? "Lead", status: lead.status, ownerId: lead.ownerId, ownerName: lead.ownerName, ownerImage: lead.ownerImage, productName: lead.productName, assignedAt: lead.assignedAt, branchName: lead.branchName },
    timeline: timeline ?? [],
    brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name ?? "Corretor" })),
  };
}
