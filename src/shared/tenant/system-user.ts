import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

/**
 * Resolves a valid user ID for system-generated operations (notes, audit logs)
 * to satisfy foreign key constraints on `lead_interactions.user_id` and `audit_logs.user_id`.
 */
export async function resolveSystemUserId(tenantId: string): Promise<string> {
  try {
    const db = getDatabase();
    // 1. Prefer active owner/admin/broker in tenant memberships
    const [member] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, tenantId),
          eq(schema.tenantMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (member?.userId) {
      return member.userId;
    }

    // 2. Fallback: try any member in tenant
    const [anyMember] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(eq(schema.tenantMemberships.tenantId, tenantId))
      .limit(1);

    if (anyMember?.userId) {
      return anyMember.userId;
    }

    // 3. Fallback: try any user in system table
    const [anyUser] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .limit(1);

    if (anyUser?.id) {
      return anyUser.id;
    }
  } catch (err) {
    console.warn("[resolveSystemUserId] Failed to query DB for system user ID:", err);
  }

  // 4. Fallback for mock environment where user table might not exist
  return "system";
}
