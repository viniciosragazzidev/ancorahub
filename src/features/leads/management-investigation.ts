import { and, eq, inArray, not, type SQL } from "drizzle-orm";

import { schema } from "@/shared/db";

/**
 * Removes leads temporarily owned by management for investigation from
 * broker-facing performance aggregates. A broker's normal `under_analysis`
 * stage remains part of the funnel and its statistics.
 */
export function managementInvestigationWhere(managementUserIds: readonly string[]): SQL | undefined {
  if (!managementUserIds.length) return undefined;

  const condition = and(
    eq(schema.leads.status, "under_analysis"),
    inArray(schema.leads.corretorId, managementUserIds),
  );
  return condition ? not(condition) : undefined;
}
