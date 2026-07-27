"use server";

import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext, type TenantContext } from "@/shared/auth/tenant-context";
import type { TenantRole } from "@/shared/db/schema";

const ROLE_DASHBOARD: Record<TenantRole, string> = {
  director: "/dashboard",
  manager: "/dashboard",
  broker: "/minha-fila",
};

/**
 * Checks if the current user has dismissed onboarding and returns the
 * appropriate redirect URL: /welcome if not dismissed, or the role's
 * default dashboard if already dismissed/completed.
 *
 * This is intentionally lightweight — only queries tenantMemberships.onboardingDismissedAt.
 */
export async function checkOnboardingRedirect(): Promise<{
  redirectTo: string;
}> {
  let context: TenantContext;
  try {
    context = await getRequiredTenantContext();
  } catch {
    return { redirectTo: "/login" };
  }

  const [membership] = await getDatabase()
    .select({ onboardingDismissedAt: schema.tenantMemberships.onboardingDismissedAt })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.userId, context.userId),
        eq(schema.tenantMemberships.tenantId, context.tenantId),
      )
    )
    .limit(1);

  // Not dismissed → send to welcome
  if (!membership?.onboardingDismissedAt) {
    return { redirectTo: "/welcome" };
  }

  // Already dismissed → send to role dashboard
  const defaultPath = ROLE_DASHBOARD[context.role] ?? "/dashboard";
  return { redirectTo: defaultPath };
}
