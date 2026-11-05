import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";

/** Planning only (DEC-130/168). Never use this relaxed filter in lead distribution. */
export async function pendingBrokerPlanningEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_INACTIVE_BROKERS)) === "true";
}

export async function getRosterBrokerAccountFilter() {
  const allowInactive = await pendingBrokerPlanningEnabled();
  if (allowInactive) return inArray(schema.user.status, ["active", "disabled"]);
  return and(
    eq(schema.tenantMemberships.status, "active"),
    eq(schema.user.active, true),
    eq(schema.user.status, "active"),
  );
}
