import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export function shouldHoldDisqualifiedLead(input: {
  holdDisqualifiedLeads: boolean;
  matchedRuleMode?: "automatic" | "manual" | null;
}) {
  return input.holdDisqualifiedLeads && input.matchedRuleMode !== "manual";
}

/**
 * Reads the tenant-wide safety switch used before automatic broker offers.
 * The fallback keeps older deployments usable until migration 0148 is applied.
 */
export async function getHoldDisqualifiedLeads(tenantId: string): Promise<boolean> {
  try {
    const [tenant] = await getDatabase()
      .select({ holdDisqualifiedLeads: schema.tenants.holdDisqualifiedLeads })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    return tenant?.holdDisqualifiedLeads ?? false;
  } catch {
    return false;
  }
}
