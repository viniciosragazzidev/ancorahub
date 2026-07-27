import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { routeOnboardingDefinitions } from "./route-onboarding";

export const ROUTE_ONBOARDING_SETTING = "feature_route_onboarding_enabled";

function getDefinition(routeKey: string) {
  const definition = routeOnboardingDefinitions.find((item) => item.key === routeKey);
  if (!definition) throw new Error("Rota de onboarding inválida.");
  return definition;
}

export async function getRouteOnboardingState(routeKey: string) {
  getDefinition(routeKey);
  const context = await getRequiredTenantContext();
  const globallyEnabled = (await getSystemSetting(ROUTE_ONBOARDING_SETTING)) !== "false";
  if (!globallyEnabled) return { enabled: false, shouldShow: false, completedAt: null, version: 1 };

  const db = getDatabase();
  const [existing] = await db
    .select({ enabled: schema.routeOnboardingProgress.enabled, completedAt: schema.routeOnboardingProgress.completedAt, version: schema.routeOnboardingProgress.version })
    .from(schema.routeOnboardingProgress)
    .where(and(
      eq(schema.routeOnboardingProgress.tenantId, context.tenantId),
      eq(schema.routeOnboardingProgress.userId, context.userId),
      eq(schema.routeOnboardingProgress.routeKey, routeKey),
    ))
    .limit(1);

  if (!existing) {
    return { enabled: true, shouldShow: true, completedAt: null, version: 1 };
  }

  return {
    enabled: existing.enabled,
    shouldShow: existing.enabled && !existing.completedAt,
    completedAt: existing.completedAt,
    version: existing.version,
  };
}

export async function completeRouteOnboarding(routeKey: string) {
  getDefinition(routeKey);
  const context = await getRequiredTenantContext();
  const now = new Date();
  const db = getDatabase();
  await db.insert(schema.routeOnboardingProgress).values({
    id: randomUUID(),
    tenantId: context.tenantId,
    userId: context.userId,
    routeKey,
    completedAt: now,
    lastSeenAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [schema.routeOnboardingProgress.tenantId, schema.routeOnboardingProgress.userId, schema.routeOnboardingProgress.routeKey],
    set: { completedAt: now, lastSeenAt: now, enabled: true, updatedAt: now },
  });
}

export async function searchPlatformOnboardingUsers(query: string) {
  await getRequiredPlatformAdmin();
  const normalized = query.trim();
  if (!normalized) return [];
  const pattern = `%${normalized}%`;
  return getDatabase().select({
    userId: schema.user.id,
    name: schema.user.name,
    email: schema.user.email,
    tenantId: schema.tenants.id,
    tenantName: schema.tenants.name,
    role: schema.tenantMemberships.role,
    branchName: schema.branches.name,
  }).from(schema.user)
    .innerJoin(schema.tenantMemberships, eq(schema.tenantMemberships.userId, schema.user.id))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMemberships.tenantId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.tenantMemberships.branchId))
    .where(or(eq(schema.user.id, normalized), ilike(schema.user.name, pattern), ilike(schema.user.email, pattern)))
    .orderBy(asc(schema.user.name), asc(schema.tenants.name))
    .limit(50);
}

export async function resetPlatformUserRouteOnboarding(userId: string, tenantId: string) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const [membership] = await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.userId, userId), eq(schema.tenantMemberships.tenantId, tenantId)))
    .limit(1);
  if (!membership) throw new Error("Usuário não pertence à corretora informada.");

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const definition of routeOnboardingDefinitions) {
      await tx.insert(schema.routeOnboardingProgress).values({
        id: randomUUID(), tenantId, userId, routeKey: definition.key, enabled: true, resetAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [schema.routeOnboardingProgress.tenantId, schema.routeOnboardingProgress.userId, schema.routeOnboardingProgress.routeKey],
        set: { enabled: true, completedAt: null, resetAt: now, version: sql`${schema.routeOnboardingProgress.version} + 1`, updatedAt: now },
      });
    }
    await tx.insert(schema.platformAuditLogs).values({
      id: randomUUID(), actorUserId: admin.userId, action: "route_onboarding.reset", targetType: "user", targetId: userId,
      metadata: { tenantId, routeCount: String(routeOnboardingDefinitions.length) }, createdAt: now,
    });
  });
}
