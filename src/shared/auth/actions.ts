"use server";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getAuth } from "@/shared/auth";
import { headers } from "next/headers";
import type { TenantRole } from "@/shared/db/schema";
import { listEffectiveCapabilities } from "@/features/custom-roles/service";
import type { PermissionKey } from "@/shared/auth/permissions";
import { isUserProfileEnabled } from "@/features/user-profile/feature";

const ROLE_REDIRECT: Record<TenantRole, string> = {
  director: "/dashboard",
  manager: "/dashboard",
  broker: "/dashboard",
};

const ROLE_LABELS: Record<TenantRole, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
};

export type UserDisplayInfo = {
  name: string;
  role: string | null;
  roleKey: TenantRole | null;
  jobTitle: string | null;
  permissions?: PermissionKey[];
  redirectLogout: string;
  isPlatformAdmin?: boolean;
  activeRoleOverride?: string | null;
  userProfileEnabled?: boolean;
};

export async function getRoleRedirect(): Promise<string> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

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
    return "/leads";
  }

  return ROLE_REDIRECT[role] ?? "/corretor/resumo";
}

export async function getUserDisplayInfo(): Promise<UserDisplayInfo> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { name: "Usuário", role: null, roleKey: null, jobTitle: null, redirectLogout: "/login" };
  }

  const [dbUser] = await getDatabase()
    .select({ isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1);

  const isPlatformAdmin = !!dbUser?.isPlatformAdmin;

  const [membership] = await getDatabase()
    .select({ tenantId: schema.tenantMemberships.tenantId, role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, customRoleId: schema.tenantMemberships.customRoleId, customRoleName: schema.customRoles.name })
    .from(schema.tenantMemberships)
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  let role = membership?.role ?? null;
  let jobTitle: string | null = membership?.jobTitle ?? null;
  let activeRoleOverride: string | null = null;
  let displayRoleLabel = membership?.customRoleName ?? (role ? ROLE_LABELS[role] ?? role : null);

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
    ? await listEffectiveCapabilities({ tenantId: membership.tenantId, role: role ?? membership.role, jobTitle: jobTitle, customRoleId: membership.customRoleId })
    : [];
  const userProfileEnabled = await isUserProfileEnabled();

  return {
    name: session.user.name,
    role: displayRoleLabel,
    roleKey: role,
    jobTitle,
    permissions,
    redirectLogout,
    isPlatformAdmin,
    activeRoleOverride,
    userProfileEnabled,
  };
}
