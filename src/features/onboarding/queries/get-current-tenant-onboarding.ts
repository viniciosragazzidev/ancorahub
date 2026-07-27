import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { buildTenantOnboarding, type OnboardingData } from "../services/build-tenant-onboarding";
import type { TenantOnboarding } from "../types/onboarding.types";

export async function getCurrentTenantOnboarding(): Promise<TenantOnboarding | null> {
  let context;
  try {
    context = await getRequiredTenantContext();
  } catch {
    return null;
  }

  const db = getDatabase();

  // Check for active branches
  const [branchCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
      ),
    );

  // Check for other active members (besides current user)
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.status, "active"),
        sql`${schema.tenantMemberships.userId} != ${context.userId}`,
      ),
    );

  // Check for pending valid invites
  const now = new Date();
  const [inviteCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.invites)
    .innerJoin(
      schema.tenantMemberships,
      eq(schema.invites.userId, schema.tenantMemberships.userId),
    )
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        sql`${schema.invites.usedAt} IS NULL`,
        gt(schema.invites.expiresAt, now),
      ),
    );

  // Check onboarding dismissed state for current membership
  const [membership] = await db
    .select({
      onboardingDismissedAt: schema.tenantMemberships.onboardingDismissedAt,
      tenantName: schema.tenants.name,
      userName: schema.user.name,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.tenants, eq(schema.tenantMemberships.tenantId, schema.tenants.id))
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, context.userId),
      ),
    )
    .limit(1);

  if (!membership) return null;

  const data: OnboardingData = {
    tenantName: membership.tenantName,
    userName: membership.userName,
    hasBranches: branchCount.count > 0,
    hasActiveMembers: memberCount.count > 0,
    hasPendingInvites: inviteCount.count > 0,
    // Catalog, branding, and goals modules not yet implemented
    hasCatalogItems: false,
    hasBranding: false,
    hasActiveGoals: false,
    onboardingDismissedAt: membership.onboardingDismissedAt,
  };

  return buildTenantOnboarding(data);
}
