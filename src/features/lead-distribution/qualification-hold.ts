import "server-only";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { schema } from "@/shared/db";

/** DEC-153: a hot lead (alta aptidão) goes out the moment the AI marks it, before the conversation ends. */
export async function isHotLeadEarlyDistributionEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.HOT_LEAD_EARLY_DISTRIBUTION).catch(() => "true")) === "true";
}

/** SQL twin of isHeldByRunningQualification: leads the running AI qualification does not hold. */
export function notHeldByRunningQualificationSql(earlyHot: boolean) {
  const notRunning = and(
    or(isNull(schema.leads.qualificationState), ne(schema.leads.qualificationState, "IN_PROGRESS")),
    or(isNull(schema.leads.qualificationStatus), ne(schema.leads.qualificationStatus, "qualifying")),
  );
  return earlyHot ? or(notRunning, eq(schema.leads.qualificationStatus, "hot")) : notRunning;
}
