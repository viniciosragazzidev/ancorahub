import "server-only";

import { and, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

/** O celular gravado no perfil do corretor, ou null se ele não tem perfil de corretor. */
export async function getOwnBrokerPhone(context: Pick<TenantContext, "tenantId" | "userId">) {
  const [profile] = await getDatabase().select({ phone: schema.brokerProfiles.phone })
    .from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), eq(schema.brokerProfiles.userId, context.userId)))
    .limit(1);
  return profile ? { phone: profile.phone } : null;
}
