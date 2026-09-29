import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Leads that went to a broker, were NOT accepted / attended in time (offer
 * expired or declined, or first-contact SLA recovery) and are now back without
 * an owner. Used to highlight them while they wait for a new assignment.
 * A manual "remover atribuição" is deliberately not counted.
 */
export async function getReturnedUnacceptedLeadIds(tenantId: string, leadIds: string[]): Promise<Set<string>> {
  if (!leadIds.length) return new Set();
  const db = getDatabase();

  const [orphans, offers, events] = await Promise.all([
    db.select({ id: schema.leads.id }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, tenantId),
      inArray(schema.leads.id, leadIds),
      isNull(schema.leads.corretorId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )),
    db.select({ leadId: schema.leadOffers.leadId }).from(schema.leadOffers).where(and(
      eq(schema.leadOffers.tenantId, tenantId),
      inArray(schema.leadOffers.leadId, leadIds),
      inArray(schema.leadOffers.status, ["EXPIRED", "DECLINED"]),
    )),
    db.select({ leadId: schema.leadDistributionEvents.leadId, action: schema.leadDistributionEvents.action })
      .from(schema.leadDistributionEvents)
      .where(and(
        eq(schema.leadDistributionEvents.tenantId, tenantId),
        inArray(schema.leadDistributionEvents.leadId, leadIds),
        inArray(schema.leadDistributionEvents.action, ["assignment_recovered", "returned_to_queue", "assignment_removed"]),
      ))
      .orderBy(desc(schema.leadDistributionEvents.createdAt)),
  ]);

  const latestRelease = new Map<string, string>();
  for (const event of events) if (!latestRelease.has(event.leadId)) latestRelease.set(event.leadId, event.action);
  const hadOffer = new Set(offers.map((offer) => offer.leadId));

  const flagged = new Set<string>();
  for (const { id } of orphans) {
    const latest = latestRelease.get(id);
    if (latest === "assignment_recovered" || latest === "returned_to_queue") flagged.add(id);
    else if (hadOffer.has(id) && latest !== "assignment_removed") flagged.add(id);
  }
  return flagged;
}
