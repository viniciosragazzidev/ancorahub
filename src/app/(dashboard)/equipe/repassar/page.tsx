import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { HandoffForm } from "@/features/supervisor-workspace/handoff-form";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

/**
 * Supervisor Lite P4: hand a stuck lead of the team to another broker of the
 * same team. The save goes through the existing reassignment (events, SLA,
 * history, notifications), which re-checks every rule on the server.
 */
export default async function HandoffPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope) notFound();
  const leadId = (await searchParams).lead?.slice(0, 80);
  if (!leadId) notFound();
  const db = getDatabase();
  // The lead must be one of the team (team scope inside buildLeadScopeWhere).
  const [lead] = await db.select({ id: schema.leads.id, name: schema.leads.nome, ownerId: schema.leads.corretorId, ownerName: schema.user.name, branchId: schema.leads.branchId })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt), buildLeadScopeWhere(context)))
    .limit(1);
  if (!lead) notFound();
  const memberships = schema.tenantMemberships;
  // A lead without a unit cannot be handed off by the supervisor (never list brokers of every unit).
  const team = !lead.branchId ? [] : await db.select({ userId: memberships.userId, name: schema.user.name, availability: memberships.availabilityStatus })
    .from(memberships)
    .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
    .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.supervisorId, context.userId), eq(memberships.status, "active"), eq(memberships.role, "broker"), eq(memberships.branchId, lead.branchId)));

  return (
    <HandoffForm
      lead={{ id: lead.id, name: lead.name, ownerName: lead.ownerName ?? "Sem corretor" }}
      brokers={team.filter((broker) => broker.userId !== lead.ownerId).map((broker) => ({ id: broker.userId, name: broker.name, availability: broker.availability }))}
    />
  );
}
