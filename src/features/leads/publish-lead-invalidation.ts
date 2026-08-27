import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";

import { publishDomainInvalidation } from "@/features/notifications/realtime-sync";
import { getDatabase, schema } from "@/shared/db";

/**
 * Signals only the people whose server-authorized lead view can have changed.
 * The event carries no lead data; recipients re-read through their own scope.
 */
export async function publishLeadInvalidation(input: {
  tenantId: string;
  actorId: string;
  branchIds?: Array<string | null | undefined>;
  brokerIds?: Array<string | null | undefined>;
}): Promise<void> {
  const branchIds = [...new Set(input.branchIds?.filter((id): id is string => Boolean(id)) ?? [])];
  const brokerIds = input.brokerIds?.filter((id): id is string => Boolean(id)) ?? [];
  const supervisorScope = branchIds.length
    ? or(
        eq(schema.tenantMemberships.role, "director"),
        and(
          eq(schema.tenantMemberships.role, "manager"),
          inArray(schema.tenantMemberships.branchId, branchIds),
        ),
      )
    : eq(schema.tenantMemberships.role, "director");

  const supervisors = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, input.tenantId),
        eq(schema.tenantMemberships.status, "active"),
        supervisorScope,
      ),
    )
    .groupBy(schema.tenantMemberships.userId)
    .limit(50);

  const userIds = new Set([input.actorId, ...brokerIds, ...supervisors.map((item) => item.userId)]);
  await publishDomainInvalidation(
    [...userIds].map((userId) => ({ tenantId: input.tenantId, userId })),
    "leads",
  );
}
