import "server-only";

import { cache } from "react";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import type { RadarFunnel, RadarLead, RadarTeamMember } from "./supervisor-leads-radar";
import { getLeadTimeline } from "@/features/leads/queries";
import { buildTeamLeadLightDetail, getTeamLeadPresentationSupplements } from "./team-lead-detail-presentation";

const ACTIVE_STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type ManagerLiteLeadData = { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number; viewerName: string; brokersWithoutWhatsApp: number };

const emptyData = (viewerName = "Gestor"): ManagerLiteLeadData => ({
  team: [], leads: [], funnel: { new: 0, firstContact: 0, service: 0, quote: 0, closing: 0 }, slaMinutes: 15, viewerName, brokersWithoutWhatsApp: 0,
});

export const getManagerLiteLeads = cache(async function getManagerLiteLeads(context: TenantContext): Promise<ManagerLiteLeadData> {
  if (context.role !== "manager") throw new Error("Esta área está disponível apenas para gestores.");
  const scope = getManagerUnitScope(context);
  if (!scope) return emptyData();

  const now = new Date();
  const db = getDatabase();
  const [[viewer], [tenant], members, rows, [awaitingFirstContact], counts] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, scope.tenantId)).limit(1),
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, image: schema.user.image, availability: schema.tenantMemberships.availabilityStatus })
      .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, scope.tenantId), eq(schema.tenantMemberships.branchId, scope.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))),
    db.select({ id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, status: schema.leads.status, ownerId: schema.leads.corretorId, ownerName: schema.user.name, ownerImage: schema.user.image, productName: schema.carrierPlans.name, assignedAt: schema.leads.assignedAt, firstContactAt: schema.leads.firstContactAt, stageEnteredAt: schema.leads.stageEnteredAt })
      .from(schema.leads).leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId)).leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.leads.planId))
      .where(and(eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), inArray(schema.leads.status, [...ACTIVE_STATUSES]), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
      .orderBy(desc(schema.leads.assignedAt), desc(schema.leads.createdAt)).limit(500),
    // Counted in the database, not from the 500 rows above: the funnel must not undercount a large unit.
    db.select({ total: count() }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.firstContactAt), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))),
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
  const readyConnections = team.length
    ? await db.select({ userId: schema.whatsappConnections.userId }).from(schema.whatsappConnections)
      .where(and(
        eq(schema.whatsappConnections.tenantId, scope.tenantId),
        eq(schema.whatsappConnections.status, "ready"),
        inArray(schema.whatsappConnections.userId, team.map((member) => member.id)),
      ))
    : [];
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
      firstContact: Number(awaitingFirstContact?.total ?? 0),
      service: Number(funnelCounts.get("in_contact") ?? 0), quote: Number(funnelCounts.get("quote_sent") ?? 0),
      closing: Number(funnelCounts.get("negotiation") ?? 0) + Number(funnelCounts.get("documentation_pending") ?? 0) + Number(funnelCounts.get("under_analysis") ?? 0),
    },
    slaMinutes,
    viewerName: viewer?.name ?? "Gestor",
    brokersWithoutWhatsApp: Math.max(0, team.length - new Set(readyConnections.map((connection) => connection.userId)).size),
  };
});

export async function getManagerLiteLeadDetail(context: TenantContext, leadId: string) {
  const scope = getManagerUnitScope(context);
  if (context.role !== "manager" || !scope) return null;
  const db = getDatabase();
  const [[lead], brokers] = await Promise.all([
    db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      phone: schema.leads.telefone,
      email: schema.leads.email,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationState: schema.leads.qualificationState,
      qualificationDetails: schema.leads.qualificationDetails,
      formData: schema.leads.formData,
      consentimentoLgpd: schema.leads.consentimentoLgpd,
      tipo: schema.leads.tipo,
      origem: schema.leads.origem,
      sourceCampaign: schema.leads.sourceCampaign,
      sourceChannel: schema.leads.sourceChannel,
      sourceMetadata: schema.leads.sourceMetadata,
      ownerId: schema.leads.corretorId,
      ownerName: schema.user.name,
      ownerImage: schema.user.image,
      productName: schema.carrierPlans.name,
      assignedAt: schema.leads.assignedAt,
      createdAt: schema.leads.createdAt,
      branchName: schema.branches.name,
    })
      .from(schema.leads).leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId)).leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.leads.planId)).leftJoin(schema.branches, and(eq(schema.branches.id, schema.leads.branchId), eq(schema.branches.tenantId, schema.leads.tenantId)))
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).limit(1),
    db.select({ id: schema.user.id, name: schema.user.name, image: schema.user.image, availability: schema.tenantMemberships.availabilityStatus }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, scope.tenantId), eq(schema.tenantMemberships.branchId, scope.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).orderBy(schema.user.name),
  ]);
  if (!lead) return null;
  const supplements = await getTeamLeadPresentationSupplements(context, leadId, lead.ownerId);
  if (!supplements) return null;
  // The lead is already inside the manager's unit (checked above), so its tasks and documents are read by lead id.
  const [timeline, tasks, documents] = await Promise.all([
    getLeadTimeline(leadId),
    db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt, completedAt: schema.leadTasks.completedAt, priority: schema.leadTasks.priority })
      .from(schema.leadTasks)
      .where(and(eq(schema.leadTasks.tenantId, scope.tenantId), eq(schema.leadTasks.leadId, leadId)))
      .orderBy(schema.leadTasks.completedAt, schema.leadTasks.dueAt),
    db.select({ id: schema.leadDocuments.id, filename: schema.leadDocuments.filename, status: schema.leadDocuments.status, requirementName: schema.documentRequirements.name })
      .from(schema.leadDocuments)
      .leftJoin(schema.documentRequirements, eq(schema.leadDocuments.requirementId, schema.documentRequirements.id))
      .where(and(eq(schema.leadDocuments.tenantId, scope.tenantId), eq(schema.leadDocuments.leadId, leadId), isNull(schema.leadDocuments.deletedAt)))
      .orderBy(desc(schema.leadDocuments.createdAt)),
  ]);
  return {
    lead: { id: lead.id, name: lead.name ?? "Lead", status: lead.status, ownerId: lead.ownerId, ownerName: lead.ownerName, ownerImage: lead.ownerImage, productName: lead.productName, assignedAt: lead.assignedAt, branchName: lead.branchName },
    lightLead: buildTeamLeadLightDetail({
      ...lead,
      planName: lead.productName,
    }, supplements.beneficiaries),
    timeline: timeline ?? [],
    tasks,
    documents,
    brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name ?? "Corretor", image: broker.image ?? null, availability: broker.availability ?? "offline" })),
    requirements: supplements.requirements,
    leadDocuments: supplements.documents,
    conversation: supplements.conversation,
    brokerWhatsAppConnected: supplements.brokerWhatsAppConnected,
  };
}
