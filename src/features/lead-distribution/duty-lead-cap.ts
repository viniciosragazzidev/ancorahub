import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { countDutyLeadsByBroker } from "./duty-attribution";

/** The cap of the plantão occurrence running now: leads each broker may receive in it. */
export type DutyLeadCap = { scheduleId: string; limit: number; startsAt: Date; endsAt: Date };

type Database = ReturnType<typeof getDatabase>;

/**
 * Brokers who can still receive a lead in this occurrence. A broker counts
 * the leads that came to them through this plantão since it started; an
 * offer that expired or was declined moved the lead to someone else and no
 * longer counts.
 */
export function brokersUnderDutyCap(brokerIds: readonly string[], received: ReadonlyMap<string, number>, limit: number) {
  return new Set(brokerIds.filter((brokerId) => (received.get(brokerId) ?? 0) < limit));
}

/**
 * Leads each broker holds from this plantão's occurrence: assigned to them
 * (accepted or still offered to them) since it started, from a queue served
 * by this plantão.
 */
export async function countLeadsReceivedInDuty(db: Database, tenantId: string, cap: DutyLeadCap, brokerIds: readonly string[]) {
  if (!brokerIds.length) return new Map<string, number>();
  const rows = await db
    .select({ brokerId: schema.leads.corretorId, leadId: schema.leads.id, dutyScheduleId: schema.leads.dutyScheduleId })
    .from(schema.leads)
    .innerJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .where(and(
      eq(schema.leads.tenantId, tenantId),
      inArray(schema.leads.corretorId, [...brokerIds]),
      or(eq(schema.leads.dutyScheduleId, cap.scheduleId), isNull(schema.leads.dutyScheduleId)),
      gte(schema.leads.assignedAt, cap.startsAt),
      lt(schema.leads.assignedAt, cap.endsAt),
      isNull(schema.leads.deletedAt),
      or(
        eq(schema.leadQueues.exclusiveDutyScheduleId, cap.scheduleId),
        sql`${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([cap.scheduleId])}::jsonb`,
      ),
    ));
  return countDutyLeadsByBroker(rows, cap.scheduleId);
}
