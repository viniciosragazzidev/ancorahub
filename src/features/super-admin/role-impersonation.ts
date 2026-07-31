import "server-only";

import { cookies } from "next/headers";
import type { TenantRole } from "@/shared/db/schema";

export const SUPERADMIN_ROLE_OVERRIDE_COOKIE = "corretop_superadmin_role_override";

export type RoleOverrideOption = "none" | "director" | "manager" | "broker" | "marketing" | "finance";

export type RoleOverrideConfig = {
  key: RoleOverrideOption;
  label: string;
  role: TenantRole;
  jobTitle: string;
};

export const ROLE_OVERRIDE_CONFIGS: Record<Exclude<RoleOverrideOption, "none">, RoleOverrideConfig> = {
  director: {
    key: "director",
    label: "Diretor",
    role: "director",
    jobTitle: "director",
  },
  manager: {
    key: "manager",
    label: "Gestor / Gerente",
    role: "manager",
    jobTitle: "manager",
  },
  broker: {
    key: "broker",
    label: "Corretor",
    role: "broker",
    jobTitle: "broker",
  },
  marketing: {
    key: "marketing",
    label: "Marketing (Especialista)",
    role: "broker",
    jobTitle: "marketing",
  },
  finance: {
    key: "finance",
    label: "Financeiro (Backoffice)",
    role: "manager",
    jobTitle: "finance",
  },
};

export async function getSuperAdminRoleOverride(): Promise<RoleOverrideConfig | null> {
  try {
    const cookieStore = await cookies();
    const rawValue = cookieStore.get(SUPERADMIN_ROLE_OVERRIDE_COOKIE)?.value;

    if (!rawValue || rawValue === "none") {
      return null;
    }

    if (rawValue in ROLE_OVERRIDE_CONFIGS) {
      return ROLE_OVERRIDE_CONFIGS[rawValue as keyof typeof ROLE_OVERRIDE_CONFIGS];
    }

    return null;
  } catch (err) {
    console.error("[getSuperAdminRoleOverride] Error reading cookie:", err);
    return null;
  }
}
