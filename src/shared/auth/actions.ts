"use server";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getAuth } from "@/shared/auth";
import { headers } from "next/headers";
import { getCachedSession } from "./cached-session";
import { TtlCache } from "@/shared/cache/ttl-cache";
import type { TenantRole } from "@/shared/db/schema";
import { listEffectiveCapabilities, listEffectiveRoutes } from "@/features/custom-roles/service";
import { isUserProfileEnabled } from "@/features/user-profile/feature";

const ROLE_REDIRECT: Record<TenantRole, string> = {
  director: "/dashboard",
  manager: "/dashboard",
  supervisor: "/dashboard",
  broker: "/dashboard",
};

const ROLE_LABELS: Record<TenantRole, string> = {
  director: "Diretor",
  manager: "Gestor",
  supervisor: "Supervisor",
  broker: "Corretor",
};

export type UserDisplayInfo = {
  name: string;
  role: string | null;
  roleKey: TenantRole | null;
  jobTitle: string | null;
  branchId?: string | null;
  permissions?: string[];
  redirectLogout: string;
  isPlatformAdmin?: boolean;
  activeRoleOverride?: string | null;
  userProfileEnabled?: boolean;
};

export async function getRoleRedirect(): Promise<string> {
  const session = await getCachedSession(await headers());

  if (!session) return "/login";

  const [dbUser] = await getDatabase()
    .select({ isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1);

  const [membership] = await getDatabase()
    .select({ tenantId: schema.tenantMemberships.tenantId, role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, customRoleId: schema.tenantMemberships.customRoleId, customRoleName: schema.customRoles.name })
    .from(schema.tenantMemberships)
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) return "/login";

  let role = membership.role;
  let jobTitle: string | null = membership.jobTitle;

  if (dbUser?.isPlatformAdmin) {
    const { getSuperAdminRoleOverride } = await import("@/features/super-admin/role-impersonation");
    const override = await getSuperAdminRoleOverride();
    if (override) {
      role = override.role;
      jobTitle = override.jobTitle;
    }
  }

  if (jobTitle === "marketing") {
    return "/dashboard";
  }

  return ROLE_REDIRECT[role] ?? "/corretor/resumo";
}

const JOB_TITLE_LABELS: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  supervisor: "Supervisor",
  broker: "Corretor",
  marketing: "Marketing",
  finance: "Financeiro",
  operations: "Operações",
  support: "Suporte",
};

/**
 * Sidebars, the command palette and the agent drawer each call this on every
 * page: kept 30s per user (not for platform admins, whose role simulation is
 * per browser).
 */
const displayInfoCache = new TtlCache<UserDisplayInfo>(30_000, 2000);

export async function getUserDisplayInfo(): Promise<UserDisplayInfo> {
  const session = await getCachedSession(await headers());

  if (!session) {
    return { name: "Usuário", role: null, roleKey: null, jobTitle: null, redirectLogout: "/login" };
  }

  const cached = displayInfoCache.get(session.user.id);
  if (cached) return cached;
  const info = await loadUserDisplayInfo(session);
  if (!info.isPlatformAdmin) displayInfoCache.set(session.user.id, info);
  return info;
}

async function loadUserDisplayInfo(session: NonNullable<Awaited<ReturnType<typeof getCachedSession>>>): Promise<UserDisplayInfo> {
  const [dbUser] = await getDatabase()
    .select({ isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1);

  const isPlatformAdmin = !!dbUser?.isPlatformAdmin;

  const [membership] = await getDatabase()
    .select({
      tenantId: schema.tenantMemberships.tenantId,
      role: schema.tenantMemberships.role,
      jobTitle: schema.tenantMemberships.jobTitle,
      branchId: schema.tenantMemberships.branchId,
      customRoleId: schema.tenantMemberships.customRoleId,
      customRoleName: schema.customRoles.name,
    })
    .from(schema.tenantMemberships)
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  let role = membership?.role ?? null;
  let jobTitle: string | null = membership?.jobTitle ?? null;
  let activeRoleOverride: string | null = null;
  let displayRoleLabel =
    membership?.customRoleName ??
    (jobTitle && jobTitle !== "broker" && JOB_TITLE_LABELS[jobTitle]
      ? JOB_TITLE_LABELS[jobTitle]
      : role
        ? ROLE_LABELS[role] ?? role
        : null);

  if (isPlatformAdmin) {
    const { getSuperAdminRoleOverride } = await import("@/features/super-admin/role-impersonation");
    const override = await getSuperAdminRoleOverride();
    if (override) {
      role = override.role;
      jobTitle = override.jobTitle;
      activeRoleOverride = override.key;
      displayRoleLabel = `${override.label} (Simulação)`;
    }
  }

  const redirectLogout = role ? ROLE_REDIRECT[role] ?? "/login" : "/login";
  const permissions = membership
    ? [
      ...(await listEffectiveCapabilities({ tenantId: membership.tenantId, role: role ?? membership.role, jobTitle, customRoleId: membership.customRoleId })),
      ...(await listEffectiveRoutes({ tenantId: membership.tenantId, customRoleId: membership.customRoleId })),
    ]
    : [];
  const userProfileEnabled = await isUserProfileEnabled();

  return {
    name: session.user.name,
    role: displayRoleLabel,
    roleKey: role,
    jobTitle,
    branchId: membership?.branchId ?? null,
    permissions,
    redirectLogout,
    isPlatformAdmin,
    activeRoleOverride,
    userProfileEnabled,
  };
}
