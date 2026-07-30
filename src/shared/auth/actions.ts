"use server";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getAuth } from "@/shared/auth";
import { headers } from "next/headers";
import type { TenantRole } from "@/shared/db/schema";
import { listEffectiveCapabilities } from "@/features/custom-roles/service";
import type { PermissionKey } from "@/shared/auth/permissions";

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
};

export async function getRoleRedirect(): Promise<string> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session) return "/login";

  const [membership] = await getDatabase()
    .select({ tenantId: schema.tenantMemberships.tenantId, role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, customRoleId: schema.tenantMemberships.customRoleId, customRoleName: schema.customRoles.name })
    .from(schema.tenantMemberships)
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) return "/login";

  if (membership.jobTitle === "marketing") {
    return "/leads";
  }

  return ROLE_REDIRECT[membership.role] ?? "/corretor/resumo";
}

export async function getUserDisplayInfo(): Promise<UserDisplayInfo> {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { name: "Usuário", role: null, roleKey: null, jobTitle: null, redirectLogout: "/login" };
  }

  const [membership] = await getDatabase()
    .select({ tenantId: schema.tenantMemberships.tenantId, role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, customRoleId: schema.tenantMemberships.customRoleId, customRoleName: schema.customRoles.name })
    .from(schema.tenantMemberships)
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, session.user.id))
    .limit(1);

  const role = membership?.role ?? null;
  const redirectLogout = role ? ROLE_REDIRECT[role] ?? "/login" : "/login";
  const permissions = membership ? await listEffectiveCapabilities({ tenantId: membership.tenantId, role: membership.role, jobTitle: membership.jobTitle, customRoleId: membership.customRoleId }) : [];

  return {
    name: session.user.name,
    role: membership?.customRoleName ?? (role ? ROLE_LABELS[role] ?? role : null),
    roleKey: role,
    jobTitle: membership?.jobTitle ?? null,
    permissions,
    redirectLogout,
  };
}
