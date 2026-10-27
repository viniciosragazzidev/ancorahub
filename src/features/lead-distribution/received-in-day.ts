import { and, eq, gte, inArray, ne } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { countReceivedInDayByBroker, NON_COUNTING_OFFER_STATUS, type DutyScheduleIdByBroker } from "./received-in-day-core";

export { countsAsReceived, countReceivedInDayByBroker, getDutyScheduleReceiptScope, NON_COUNTING_OFFER_STATUS, pickNextByReceivedInDay } from "./received-in-day-core";
export type { DayReceipt, DutyScheduleIdByBroker } from "./received-in-day-core";

type DatabaseLike = Pick<ReturnType<typeof getDatabase>, "select">;

/** Lê indicações do dia por corretor e pelo plantão usado nesta escolha. */
export async function loadReceivedInDayByBroker(
  db: DatabaseLike,
  tenantId: string,
  brokerIds: readonly string[],
  since: Date,
  scheduleIdByBroker: DutyScheduleIdByBroker = {},
) {
  if (!brokerIds.length) return new Map<string, number>();
  const ids = [...brokerIds];
  const leads = await db.select({ brokerId: schema.leads.corretorId, leadId: schema.leads.id, receivedAt: schema.leads.assignedAt, dutyScheduleId: schema.leads.dutyScheduleId })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.corretorId, ids), gte(schema.leads.assignedAt, since)));
  const attempts = await db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, leadId: schema.leadAssignmentAttempts.leadId, receivedAt: schema.leadAssignmentAttempts.assignedAt, dutyScheduleId: schema.leadAssignmentAttempts.dutyScheduleId })
    .from(schema.leadAssignmentAttempts)
    .where(and(eq(schema.leadAssignmentAttempts.tenantId, tenantId), inArray(schema.leadAssignmentAttempts.brokerId, ids), gte(schema.leadAssignmentAttempts.assignedAt, since)));
  const offers = await db.select({ brokerId: schema.leadOffers.brokerId, leadId: schema.leadOffers.leadId, receivedAt: schema.leadOffers.offeredAt, dutyScheduleId: schema.leadOffers.dutyScheduleId, offerStatus: schema.leadOffers.status })
    .from(schema.leadOffers)
    .where(and(
      eq(schema.leadOffers.tenantId, tenantId),
      inArray(schema.leadOffers.brokerId, ids),
      gte(schema.leadOffers.offeredAt, since),
      ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS),
    ));
  return countReceivedInDayByBroker([...leads, ...attempts, ...offers], since, scheduleIdByBroker);
}
