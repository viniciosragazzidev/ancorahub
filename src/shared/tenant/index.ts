import "server-only";

import { and, eq } from "drizzle-orm";
import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

/**
 * The only domain-facing database capability. It accepts a context created on
 * the server and never accepts a tenant id from a request as an authority.
 */
export function createTenantDb(context: TenantContext) {
  return {
    async getCurrentTenant() {
      const [tenant] = await getDatabase()
        .select({ id: schema.tenants.id, name: schema.tenants.name, slug: schema.tenants.slug })
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.id, context.tenantId),
            eq(schema.tenants.status, "active"),
          ),
        )
        .limit(1);

      if (!tenant) {
        throw new AuthorizationError("The active tenant could not be resolved.");
      }

      return tenant;
    },
  };
}
